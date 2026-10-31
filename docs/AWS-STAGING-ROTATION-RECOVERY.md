# CORTEX staging RDS password rotation recovery

**Scope:** staged operational safeguard only; no deployment is performed by merging this code. These files **do not** authorize a production rollout, credential reset, or application restart.

## Why this exists

On 31 October 2026 the RDS-managed PostgreSQL secret rotated while the single EC2 application container was using a previous database credential. PostgreSQL, append-only audit and document search readiness returned unavailable until a controlled restart let the existing `/usr/local/bin/apex-one-run.sh` launch script retrieve the current secret. That script already reads RDS-managed secret material at application startup. The current host had no active rotation monitor or corresponding timer at audit time.

The implementation in `ops/staging_rotation_recovery.py` is **staging-specific** (RDS `apex-one-staging-db`, Docker `apex-one-staging`, systemd `apex-one.service`, AWS `eu-west-1`) and intentionally defaults to a **read-only check**. It uses only the metadata fields `CreatedDate` and `VersionId` from the `AWSCURRENT` secret; neither credentials nor raw secret JSON are output or saved.

## Safeguards

A guarded restart is considered only if all are true:

- `apex-one.service` is active and the staging container is running;
- the local readiness response is HTTP 503 / `not_ready`, has complete *staging* release identity, `production: true`, and zero configuration issues;
- only `database`, `audit` and `searchIndex` may be unavailable, with the database explicitly unavailable and Valkey/session/rate-limit/S3 checks ready;
- RDS reports the staging database `available` and the managed secret's `AWSCURRENT` metadata is retrievable;
- the secret version was created **more than 60 seconds after** the running container was started, consistent with stale startup credentials;
- no prior restart attempt has been recorded in the last **one hour**.

It cannot reset a password, rotate secrets, change RDS, touch application data, change ECR, deploy a different digest or act on a healthy application. It does not restart for unexplained 503s, failed Valkey/S3, absent probes, non-staging identities, or networking-only failures. It records an attempt **before** requesting a restart, so a failed restart does not trigger an immediate loop. A systemd lock prevents concurrent checks. After a guarded restart, it requires the staging readiness probe to recover.

## Test before enabling

```bash
python3 -m unittest discover -s ops -p 'test_staging_rotation_recovery.py' -v
```

The regression test suite uses synthetic status reports, timestamps and release identities; it does not require AWS access and cannot restart services.

On the staging instance, the current launch helper already uses `aws`, `docker`, `systemctl` and Python 3. Verify this remains true before installation. Use an approved change window; a matching rotation can cause a **brief single-instance outage** while the service restarts.

## Operator-controlled installation (separate approval required)

These are instructions only. Do not install just because the GitHub PR is green.

1. Verify the exact merged source commit and inspect both systemd files. Verify the host still uses the named *staging* instance, DB, service and container, and that the startup helper reads RDS Secrets Manager credentials.
2. Run the unit tests above on the verified source. Transfer only the reviewed Python script and two unit files over an approved channel. Do **not** place credentials in script arguments, files, console logs or GitHub.
3. On the approved staging EC2 host, install:

```bash
sudo install -d -m 0755 /usr/local/libexec/cortex
sudo install -m 0755 ops/staging_rotation_recovery.py /usr/local/libexec/cortex/staging_rotation_recovery.py
sudo install -m 0644 deploy/aws/cortex-staging-rotation-recovery.service /etc/systemd/system/
sudo install -m 0644 deploy/aws/cortex-staging-rotation-recovery.timer /etc/systemd/system/
sudo systemctl daemon-reload
python3 /usr/local/libexec/cortex/staging_rotation_recovery.py
```

4. Confirm the dry-run prints `{"result":"skipped","reason":"healthy"}` on a healthy staging release and that no service restart occurred. **Only after explicit staging-operations approval**, start the timer:

```bash
sudo systemctl enable --now cortex-staging-rotation-recovery.timer
sudo systemctl list-timers cortex-staging-rotation-recovery.timer
```

5. Inspect journal outcome codes and runtime health; do not log full env vars or secret output. Test an approved *isolated simulation* (or approved staging secret rotation in a controlled window) before relying on recovery.
6. Disable safely with `sudo systemctl disable --now cortex-staging-rotation-recovery.timer`; this does not revert a restart or alter the database.

## Failure modes, launch decision and scope limits

- The monitor **does not proactively restart** a healthy app when a secret changes. It intervenes only if the PostgreSQL readiness authority fails with strong evidence that the secret was rotated after the container started. Other readiness failures remain for operators.
- AWS IAM must permit `rds:DescribeDBInstances` and `secretsmanager:GetSecretValue` on the existing staging-managed secret. The host already used both at the 31 October audit. No policy broadening should be needed.
- A healthy readiness response does not prove authenticated user acceptance or document accuracy. Run login/RBAC, tenant isolation, source-backed historical-document review, backup/restore and rollback rehearsal separately.
- The one-hour cooldown means a second credential rotation during that period will require an operator; this is intentional to prevent restart storms.
- This is a single-container staging safeguard, **not** a production solution. Production must use an approved multi-replica rolling controller and validated secret refresh strategy.

**Status:** staged code only, pending code review, full CI, operator installation approval and controlled recovery rehearsal. Do not mark historical documents verified or production launch GO on the basis of this monitor.
