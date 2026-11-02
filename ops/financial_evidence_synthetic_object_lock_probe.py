"""CORTEX — opt-in synthetic-only real AWS S3 Object Lock version proof.

Default behavior is read-only. With independent change approval and explicit
operator opt-in, creates TWO tiny synthetic versions of one new key in the
already approved financial evidence bucket and verifies the first remains
readable and COMPLIANCE-protected after a second version becomes latest.

NEVER deletes, shortens retention, creates a bucket, changes policy, or handles
live bank data. An interrupted AWS request may still have written an object:
always inventory the reported key manually under the retention policy.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import re
import secrets
from typing import Any

from financial_evidence_bucket_preflight import evaluate_bucket, inspect_bucket

SYNTHETIC_PREFIX = "cortex-synthetic-probes/"
VERSION_RE = re.compile(r"^[A-Za-z0-9+./=_-]{1,256}$")
MIME = "application/vnd.cortex.synthetic-object-lock-probe"
SAFE_ID = re.compile(r"^[A-Za-z0-9._/-]{6,100}$")


class ProbeFailure(Exception):
    """Safe-to-report status code, not an AWS SDK error body."""


def _require_version(receipt: dict[str, Any]) -> str:
    value = receipt.get("VersionId")
    if not isinstance(value, str) or not VERSION_RE.fullmatch(value) or value == "null":
        raise ProbeFailure("s3_version_receipt_missing")
    return value


def _read_body(result: dict[str, Any]) -> bytes:
    body = result.get("Body")
    if body is None:
        raise ProbeFailure("s3_object_body_missing")
    data = body.read() if hasattr(body, "read") else body
    if not isinstance(data, bytes) or len(data) > 4096:
        raise ProbeFailure("s3_object_body_invalid")
    return data


def _retention_check(
    s3: Any, bucket: str, key: str, version: str,
    at_least_days: int, expected: bytes
) -> dict[str, Any]:
    """Read exact version, independent S3 retention API and HEAD metadata."""
    obj = s3.get_object(Bucket=bucket, Key=key, VersionId=version)
    if obj.get("VersionId") != version:
        raise ProbeFailure("pinned_version_read_mismatch")
    actual = _read_body(obj)
    if not hmac.compare_digest(hashlib.sha256(actual).digest(), hashlib.sha256(expected).digest()):
        raise ProbeFailure("pinned_version_checksum_mismatch")

    retained = s3.get_object_retention(Bucket=bucket, Key=key, VersionId=version)
    policy = retained.get("Retention") or {}
    if policy.get("Mode") != "COMPLIANCE":
        raise ProbeFailure("object_version_not_in_compliance_mode")
    retain_until = policy.get("RetainUntilDate")
    if not isinstance(retain_until, datetime) or retain_until.tzinfo is None:
        raise ProbeFailure("object_version_retention_missing")
    if retain_until <= datetime.now(timezone.utc) + timedelta(days=at_least_days) - timedelta(minutes=5):
        raise ProbeFailure("object_version_retention_too_short")

    head = s3.head_object(Bucket=bucket, Key=key, VersionId=version)
    if head.get("VersionId") != version:
        raise ProbeFailure("pinned_version_head_mismatch")
    if head.get("ObjectLockMode") != "COMPLIANCE":
        raise ProbeFailure("head_object_lock_mode_missing")
    head_until = head.get("ObjectLockRetainUntilDate")
    if not isinstance(head_until, datetime) or head_until != retain_until:
        raise ProbeFailure("head_retention_disagrees_with_retention_api")

    return {
        "versionId": version,
        "digestSha256": hashlib.sha256(actual).hexdigest(),
        "retainUntil": retain_until.astimezone(timezone.utc).isoformat(),
        "complianceModeObserved": True,
        "exactVersionBytesMatched": True,
    }


def synthetic_payload(run_id: str, generation: int) -> bytes:
    if not re.fullmatch(r"[0-9a-f]{32}", run_id) or generation not in (1, 2):
        raise ValueError("Invalid synthetic fixture identifier")
    # Deliberately not a financial CSV or a record with a bank reference.
    return (
        "CORTEX-SYNTHETIC-OBJECT-LOCK-PROBE-V1\\n"
        + "NOT-A-BANK-FEED\\n"
        + "run=" + run_id + "\\n"
        + "generation=" + str(generation) + "\\n"
    ).encode("ascii")


def execute_probe(
    s3: Any, bucket: str, min_days: int, run_id: str
) -> dict[str, Any]:
    """Makes exactly two writes to a NEW opaque key; retains both versions."""
    if not isinstance(bucket, str) or not bucket or not isinstance(min_days, int) or min_days < 1:
        raise ValueError("Explicit bucket and positive minimum required")
    key = SYNTHETIC_PREFIX + run_id + ".txt"
    output: dict[str, Any] = {
        "syntheticOnly": True,
        "bucket": bucket,
        "key": key,
        "createdVersionIds": [],
        "retainedVersionCount": 0,
        "technicalObjectVersionProofPassed": False,
        "bankDataAuthorized": False,
        "institutionRetentionPolicyVerified": False,
        "objectsDeleted": 0,
        "partialWriteMayExist": False,
    }
    try:
        first = synthetic_payload(run_id, 1)
        # Mark uncertainty BEFORE making a network request: a client timeout
        # does not prove that S3 failed to store the protected object.
        output["partialWriteMayExist"] = True
        one = s3.put_object(Bucket=bucket, Key=key, Body=first, ContentType=MIME)
        first_version = _require_version(one)
        output["createdVersionIds"].append(first_version)

        first_check = _retention_check(s3, bucket, key, first_version, min_days, first)

        second = synthetic_payload(run_id, 2)
        two = s3.put_object(Bucket=bucket, Key=key, Body=second, ContentType=MIME)
        second_version = _require_version(two)
        output["createdVersionIds"].append(second_version)
        if first_version == second_version:
            raise ProbeFailure("versioning_not_immutable")

        second_check = _retention_check(s3, bucket, key, second_version, min_days, second)
        # Re-read the ORIGINAL protected version after the latest version moved.
        first_after = _retention_check(s3, bucket, key, first_version, min_days, first)
        latest = s3.get_object(Bucket=bucket, Key=key)
        if latest.get("VersionId") != second_version or _read_body(latest) != second:
            raise ProbeFailure("latest_version_not_expected")
        if first_after != first_check:
            raise ProbeFailure("original_version_changed_after_new_write")

        output.update({
            "first": first_after,
            "second": second_check,
            "retainedVersionCount": 2,
            "technicalObjectVersionProofPassed": True,
            "partialWriteMayExist": False,
            "result": "PASS_SYNTHETIC_TECHNICAL_EVIDENCE_ONLY",
        })
    except Exception as error:
        # Avoid printing SDK errors, credentials, HTTP headers or payloads.
        output["result"] = "FAIL_NEEDS_MANUAL_REVIEW"
        output["safeErrorCode"] = str(error) if isinstance(error, ProbeFailure) else "aws_request_failed_or_ambiguous"
        output["partialWriteMayExist"] = True
    return output


def _account_matches(sts: Any, expected: str) -> bool:
    if not re.fullmatch(r"\d{12}", expected):
        return False
    try:
        return sts.get_caller_identity().get("Account") == expected
    except Exception:
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Synthetic-only S3 Object Lock proof (read-only by default)")
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--region", required=True)
    parser.add_argument("--minimum-retention-days", required=True, type=int)
    parser.add_argument("--approved-change-ticket", required=True)
    parser.add_argument("--expected-aws-account-id", required=True,
                        help="Explicit 12-digit target AWS account; not printed in report")
    parser.add_argument("--synthetic-only", action="store_true")
    parser.add_argument("--execute-synthetic-write", action="store_true",
                        help="Opt in to two retained, irreversible synthetic object versions")
    parser.add_argument("--independent-approver", default=None,
                        help="Named infrastructure change approver; value is not independently attested")
    parser.add_argument("--acknowledge-retention-cost", action="store_true",
                        help="Acknowledge that two S3 versions will be COMPLIANCE-retained and billed")
    args = parser.parse_args()

    if not args.synthetic_only:
        parser.error("--synthetic-only is required; real-bank intake is never authorized")
    if not re.fullmatch(r"\d{12}", args.expected_aws_account_id):
        parser.error("Expected AWS account ID must be 12 digits")
    if not SAFE_ID.fullmatch(args.approved_change_ticket):
        parser.error("A safe, explicit approved change-ticket identifier is required")
    if args.execute_synthetic_write and (
        not args.acknowledge_retention_cost or
        not isinstance(args.independent_approver, str) or
        not SAFE_ID.fullmatch(args.independent_approver)
    ):
        parser.error("Writes require a named independent approver and explicit retention-cost acknowledgement")

    try:
        import boto3  # type: ignore[import-not-found]
        session = boto3.session.Session(region_name=args.region)
        if not _account_matches(session.client("sts"), args.expected_aws_account_id):
            raise ProbeFailure("aws_account_identity_mismatch_or_unavailable")
        s3 = session.client("s3")
        preflight = evaluate_bucket(
            args.bucket, inspect_bucket(s3, args.bucket),
            args.minimum_retention_days, args.approved_change_ticket, args.region,
        )
        if not preflight["technicalControlsPassed"]:
            print(json.dumps({
                "result": "NO_GO_BUCKET_PREFLIGHT_FAILED",
                "failedChecks": preflight["failedChecks"],
                "writesPerformed": 0, "bankDataAuthorized": False,
            }, sort_keys=True))
            return 2
        if not args.execute_synthetic_write:
            print(json.dumps({
                "result": "READ_ONLY_PREFLIGHT_PASS",
                "writesPerformed": 0,
                "syntheticProofPerformed": False,
                "bankDataAuthorized": False,
                "operatorExecutionRequiresSeparateChangeApproval": True,
            }, sort_keys=True))
            return 0

        run_id = secrets.token_hex(16)
        result = execute_probe(s3, args.bucket, args.minimum_retention_days, run_id)
        # Deliberately never auto-delete protected object versions.
        print(json.dumps(result, sort_keys=True, indent=2))
        return 0 if result["technicalObjectVersionProofPassed"] else 2
    except Exception as error:
        message = str(error) if isinstance(error, ProbeFailure) else "aws_preflight_request_failed"
        print(json.dumps({
            "result": "NO_GO", "safeErrorCode": message,
            "bankDataAuthorized": False,
            "writesPerformed": 0,
        }, sort_keys=True))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
