"""CORTEX: read-only AWS S3 Object Lock evidence-bucket preflight.

This tool makes only AWS S3 Get* control-plane calls. It does not create a
bucket, write an object, set retention, issue credentials, or certify live
financial data. Operational approval is OUTSIDE this technical gate.
"""
from __future__ import annotations

import argparse
import json
import re
from typing import Any

DOC_BUCKET = "apex-one-staging-documents-apexsync"
CHECKS = (
    "separate_financial_bucket",
    "region_known",
    "versioning_enabled",
    "object_lock_enabled",
    "compliance_default_retention",
    "retention_meets_synthetic_minimum",
    "all_public_access_blocked",
    "not_public_by_policy",
    "server_side_encryption",
    "owner_enforced",
    "deny_plaintext_transport",
    "deny_tls_below_1_2",
    "staging_synthetic_tags",
    "change_ticket_matches",
)


def _get(source: dict[str, Any], name: str) -> dict[str, Any]:
    result = source.get(name)
    return result if isinstance(result, dict) else {}


def _statements(policy: Any) -> list[dict[str, Any]]:
    if isinstance(policy, str):
        try:
            policy = json.loads(policy)
        except (ValueError, TypeError):
            return []
    if not isinstance(policy, dict):
        return []
    raw = policy.get("Statement", [])
    if isinstance(raw, dict):
        raw = [raw]
    return [item for item in raw if isinstance(item, dict)] if isinstance(raw, list) else []


def _contains_action(actions: Any, required: str) -> bool:
    items = actions if isinstance(actions, list) else [actions]
    return required in items or "s3:*" in items or "*" in items


def _has_resource(resources: Any, target: str) -> bool:
    items = resources if isinstance(resources, list) else [resources]
    return target in items


def _denies_transport(policy: Any, bucket: str, tls_minimum: bool) -> bool:
    bucket_arn = "arn:aws:s3:::" + bucket
    object_arn = bucket_arn + "/*"
    for statement in _statements(policy):
        if statement.get("Effect") != "Deny" or statement.get("Principal") != "*":
            continue
        if not _has_resource(statement.get("Resource"), object_arn):
            continue
        condition = statement.get("Condition")
        if not isinstance(condition, dict):
            continue
        if tls_minimum:
            if not _contains_action(statement.get("Action"), "s3:PutObject"):
                continue
            tls = _get(condition, "NumericLessThan").get("s3:TlsVersion")
            try:
                if tls is not None and float(tls) >= 1.2:
                    return True
            except (ValueError, TypeError):
                pass
        else:
            if not _contains_action(statement.get("Action"), "s3:PutObject"):
                continue
            if not _has_resource(statement.get("Resource"), bucket_arn):
                continue
            secure = _get(condition, "Bool").get("aws:SecureTransport")
            if secure is False or secure == "false":
                return True
    return False


def evaluate_bucket(
    bucket: str,
    raw: dict[str, Any],
    minimum_retention_days: int,
    change_ticket: str,
    expected_region: str | None = None,
) -> dict[str, Any]:
    """Pure fail-closed evaluator for AWS Get* responses, with no AWS calls."""
    if not isinstance(bucket, str) or not re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", bucket):
        raise ValueError("A valid, explicit bucket name is required")
    if not isinstance(minimum_retention_days, int) or isinstance(minimum_retention_days, bool) or minimum_retention_days < 1:
        raise ValueError("A positive minimum synthetic retention period is required")
    if not isinstance(change_ticket, str) or not re.fullmatch(r"[A-Za-z0-9._/-]{6,100}", change_ticket):
        raise ValueError("A non-secret approved change-ticket identifier is required")

    version = _get(raw, "versioning")
    locking = _get(raw, "object_lock")
    config = _get(locking, "ObjectLockConfiguration")
    retain = _get(_get(config, "Rule"), "DefaultRetention")
    public = _get(_get(raw, "public_block"), "PublicAccessBlockConfiguration")
    encryption = _get(_get(raw, "encryption"), "ServerSideEncryptionConfiguration")
    enc_rules = encryption.get("Rules", [])
    ownership_rules = _get(_get(raw, "ownership"), "OwnershipControls").get("Rules", [])
    tags_list = _get(raw, "tags").get("TagSet", [])
    tags = {str(t.get("Key")): t.get("Value") for t in tags_list if isinstance(t, dict)} if isinstance(tags_list, list) else {}
    location_available = isinstance(raw.get("location"), dict) and bool(raw["location"])
    region = (_get(raw, "location").get("LocationConstraint") or "us-east-1") if location_available else None
    policy = _get(raw, "bucket_policy").get("Policy")
    policy_status = _get(_get(raw, "policy_status"), "PolicyStatus")

    days = retain.get("Days")
    checks = {
        "separate_financial_bucket": bucket != DOC_BUCKET and "financial" in bucket and "evidence" in bucket,
        "region_known": location_available and isinstance(region, str) and bool(region) and (expected_region is None or region == expected_region),
        "versioning_enabled": version.get("Status") == "Enabled",
        "object_lock_enabled": config.get("ObjectLockEnabled") == "Enabled",
        "compliance_default_retention": retain.get("Mode") == "COMPLIANCE" and type(days) is int and days > 0,
        "retention_meets_synthetic_minimum": type(days) is int and days >= minimum_retention_days,
        "all_public_access_blocked": all(public.get(x) is True for x in (
            "BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets"
        )),
        "not_public_by_policy": policy_status.get("IsPublic") is False,
        "server_side_encryption": isinstance(enc_rules, list) and any(
            isinstance(rule, dict) and
            _get(rule, "ApplyServerSideEncryptionByDefault").get("SSEAlgorithm") in ("AES256", "aws:kms", "aws:kms:dsse")
            for rule in enc_rules
        ),
        "owner_enforced": isinstance(ownership_rules, list) and any(
            isinstance(rule, dict) and rule.get("ObjectOwnership") == "BucketOwnerEnforced"
            for rule in ownership_rules
        ),
        "deny_plaintext_transport": _denies_transport(policy, bucket, False),
        "deny_tls_below_1_2": _denies_transport(policy, bucket, True),
        "staging_synthetic_tags": tags.get("Application") == "CORTEX" and
            tags.get("Environment") == "staging" and tags.get("DataClass") == "synthetic-only",
        "change_ticket_matches": tags.get("RetentionChangeTicket") == change_ticket,
    }
    return {
        "schemaVersion": 1,
        "bucket": bucket,
        "region": region,
        "technicalControlsPassed": all(checks.values()),
        "checks": checks,
        "failedChecks": [key for key in CHECKS if not checks[key]],
        "approvedRealBankData": False,
        "bankSignerAuthorityVerified": False,
        "institutionRetentionPolicyVerified": False,
        "realAwsObjectVersionTested": False,
        "deploymentPerformed": False,
        "note": "Read-only configuration check; no live-bank use authorization or WORM attestation.",
    }


def inspect_bucket(client: Any, bucket: str) -> dict[str, Any]:
    """Make only GetBucket* S3 calls. Access denied and missing config fail closed."""
    operations = {
        "versioning": "get_bucket_versioning",
        "object_lock": "get_object_lock_configuration",
        "encryption": "get_bucket_encryption",
        "public_block": "get_public_access_block",
        "policy_status": "get_bucket_policy_status",
        "ownership": "get_bucket_ownership_controls",
        "tags": "get_bucket_tagging",
        "location": "get_bucket_location",
        "bucket_policy": "get_bucket_policy",
    }
    result: dict[str, Any] = {}
    for label, operation in operations.items():
        try:
            response = getattr(client, operation)(Bucket=bucket)
            result[label] = response if isinstance(response, dict) else {}
        except Exception:
            # Do not leak SDK credentials, object names or exception body.
            result[label] = {}
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only synthetic CORTEX financial WORM bucket gate")
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--region", required=True)
    parser.add_argument("--minimum-retention-days", type=int, required=True)
    parser.add_argument("--approved-change-ticket", required=True)
    parser.add_argument("--synthetic-only", action="store_true",
                        help="Explicitly acknowledge this is NOT an authorization for real bank data")
    args = parser.parse_args()
    if not args.synthetic_only:
        parser.error("--synthetic-only is mandatory; no bank data is authorized")
    try:
        import boto3  # type: ignore[import-not-found]  # Only needed for the opt-in operator CLI.
        session = boto3.session.Session(region_name=args.region)
        client = session.client("s3")
        report = evaluate_bucket(
            args.bucket, inspect_bucket(client, args.bucket),
            args.minimum_retention_days, args.approved_change_ticket,
            expected_region=args.region,
        )
    except Exception:
        # Fail closed; no operator secrets in diagnostics.
        print(json.dumps({"technicalControlsPassed": False,
                          "approvedRealBankData": False,
                          "reason": "Unable to evaluate bucket controls safely."}))
        return 2
    print(json.dumps(report, sort_keys=True, indent=2))
    return 0 if report["technicalControlsPassed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
