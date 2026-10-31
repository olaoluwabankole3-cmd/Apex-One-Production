#!/usr/bin/env python3
"""CORTEX staging-only RDS rotation recovery.

No secrets are printed or persisted. Runs in report-only mode by default.
Install the supplied systemd timer only after separate operator approval.
"""
import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request

REGION = "eu-west-1"
DB_INSTANCE = "apex-one-staging-db"
CONTAINER = "apex-one-staging"
SERVICE = "apex-one.service"
LOCAL_READY_URL = "http://127.0.0.1:3000/api/v1/health/ready"
STATE_DIR = Path("/var/lib/cortex-staging-rotation-recovery")
STATE_FILE = STATE_DIR / "last-attempt.json"
LOCK_PATH = "/run/lock/cortex-staging-rotation-recovery.lock"
COOLDOWN_SECONDS = 60 * 60
MAX_POST_RESTART_SECONDS = 90


def fail(message):
    # All messages in this module are static and cannot contain credentials.
    raise RuntimeError(message)


def command(argv, *, timeout=25):
    try:
        completed = subprocess.run(argv, text=True, capture_output=True, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        fail("Required local command could not run")
    if completed.returncode != 0:
        fail("Required local command returned an error")
    return completed.stdout.strip()


def json_command(argv):
    try:
        return json.loads(command(argv))
    except (ValueError, TypeError):
        fail("Required local command did not return JSON")


def aws_json(service, operation, *options):
    return json_command(["aws", service, operation, "--region", REGION, *options, "--output", "json"])


def current_secret_metadata():
    response = aws_json(
        "rds", "describe-db-instances", "--db-instance-identifier", DB_INSTANCE,
        "--query", "DBInstances[0].{SecretArn:MasterUserSecret.SecretArn,Status:DBInstanceStatus}"
    )
    if not isinstance(response, dict) or response.get("Status") != "available":
        fail("Staging database is not available")
    arn = response.get("SecretArn")
    if not isinstance(arn, str) or ":secretsmanager:" not in arn or ":secret:" not in arn:
        fail("RDS-managed secret metadata is missing")
    response = aws_json(
        "secretsmanager", "get-secret-value", "--secret-id", arn,
        "--version-stage", "AWSCURRENT",
        "--query", "{VersionId:VersionId,CreatedDate:CreatedDate}"
    )
    if not isinstance(response, dict) or not response.get("VersionId") or not response.get("CreatedDate"):
        fail("Current secret version metadata is missing")
    # The AWS CLI query returns ONLY version metadata; never SecretString.
    return response


def read_container_state():
    return json_command(["docker", "inspect", "--format", "{{json .State}}", CONTAINER])


def probe_ready():
    request = urllib.request.Request(LOCAL_READY_URL, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            status, payload = response.status, response.read(100_000)
    except urllib.error.HTTPError as error:
        status, payload = error.code, error.read(100_000)
    except (OSError, TimeoutError, ValueError):
        fail("Local readiness probe is unreachable")
    try:
        report = json.loads(payload)
    except (ValueError, TypeError):
        fail("Local readiness probe returned invalid JSON")
    return status, report


def utc_timestamp(value):
    if not isinstance(value, str):
        fail("Required UTC timestamp is missing")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        fail("Required UTC timestamp is invalid")
    if parsed.tzinfo is None:
        fail("Required UTC timestamp has no timezone")
    return parsed.astimezone(dt.timezone.utc)


def decision(http_status, report, container, secret):
    """Pure decision function, used by isolated tests."""
    if not isinstance(report, dict) or not isinstance(container, dict):
        return "invalid_readiness"
    release = report.get("release") or {}
    if not isinstance(release, dict) or release.get("deploymentEnvironment") != "staging":
        return "not_staging"
    if report.get("production") is not True or release.get("complete") is not True:
        return "invalid_release"
    if not container.get("Running"):
        return "container_not_running"
    if http_status == 200 and report.get("status") == "ready":
        return "healthy"
    if http_status != 503 or report.get("status") != "not_ready":
        return "unexpected_probe_state"
    if report.get("configurationIssueCount") != 0:
        return "configuration_issue"
    unavailable = report.get("unavailableAuthorities")
    checks = report.get("checks")
    if not isinstance(unavailable, list) or not isinstance(checks, list):
        return "invalid_checks"
    if "database" not in unavailable or any(a not in {"database", "audit", "searchIndex"} for a in unavailable):
        return "unrelated_dependency_failure"
    check_states = {c.get("authority"): c.get("state") for c in checks if isinstance(c, dict)}
    if check_states.get("database") != "unavailable":
        return "database_probe_inconsistent"
    if any(check_states.get(key) != "ready" for key in ("session", "rateLimit", "objectStorage")):
        return "other_dependency_unhealthy"
    # RDS credentials are fetched at container creation. A secret version
    # created AFTER the container started is evidence of stale credentials.
    try:
        secret_time = utc_timestamp(secret.get("CreatedDate"))
        started = utc_timestamp(container.get("StartedAt"))
    except RuntimeError:
        return "invalid_timestamps"
    if secret_time <= started + dt.timedelta(seconds=60):
        return "credentials_not_proven_stale"
    return "rotation_recovery_candidate"


def last_attempt_time():
    try:
        payload = json.loads(STATE_FILE.read_text())
        return float(payload.get("attemptedAt", 0))
    except (OSError, ValueError, TypeError):
        return 0


def record_attempt(now):
    STATE_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(STATE_DIR, 0o700)
    target = STATE_FILE.with_suffix(".new")
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as handle:
        json.dump({"attemptedAt": now}, handle)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(target, STATE_FILE)


def run_recovery(*, apply=False, now=None):
    # Reads and actions stay strictly bound to one known STAGING service.
    lock_fd = os.open(LOCK_PATH, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {"result": "skipped", "reason": "another_check_running"}
        if command(["systemctl", "is-active", SERVICE]) != "active":
            return {"result": "skipped", "reason": "service_not_active"}
        http_status, report = probe_ready()
        container = read_container_state()
        # Resolve the secret only when an unhealthy, staging-scoped process
        # is observed; healthy probes do not need an AWS credential fetch.
        if http_status == 200 and report.get("status") == "ready":
            reason = decision(http_status, report, container, {})
        else:
            secret = current_secret_metadata()
            reason = decision(http_status, report, container, secret)
        if reason != "rotation_recovery_candidate":
            return {"result": "skipped", "reason": reason}
        timestamp = now if now is not None else time.time()
        if timestamp - last_attempt_time() < COOLDOWN_SECONDS:
            return {"result": "skipped", "reason": "cooldown"}
        if not apply:
            return {"result": "candidate", "reason": reason, "actionTaken": False}

        # State recorded *before* restart protects against repeated disruption.
        record_attempt(timestamp)
        command(["systemctl", "restart", SERVICE], timeout=75)
        end = time.monotonic() + MAX_POST_RESTART_SECONDS
        while time.monotonic() < end:
            time.sleep(5)
            try:
                status, state = probe_ready()
                if (
                    status == 200 and state.get("status") == "ready"
                    and state.get("production") is True
                    and state.get("release", {}).get("deploymentEnvironment") == "staging"
                    and state.get("configurationIssueCount") == 0
                    and state.get("unavailableAuthorities") == []
                ):
                    return {"result": "recovered", "actionTaken": True}
            except RuntimeError:
                pass
        return {"result": "restart_not_ready", "actionTaken": True}
    finally:
        os.close(lock_fd)


def main():
    parser = argparse.ArgumentParser(description="Staging-only RDS rotation recovery; dry-run by default")
    parser.add_argument("--apply", action="store_true", help="Authorize one guarded staging app restart")
    args = parser.parse_args()
    try:
        output = run_recovery(apply=args.apply)
        print(json.dumps(output, sort_keys=True))
        if output["result"] in ("restart_not_ready",):
            return 1
    except RuntimeError as error:
        print(json.dumps({"result": "error", "reason": str(error)}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
