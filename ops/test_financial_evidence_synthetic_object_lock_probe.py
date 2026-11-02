"""Synthetic AWS Object Lock version proof: offline tests, no AWS credentials."""
from __future__ import annotations

from contextlib import redirect_stdout, redirect_stderr
from datetime import datetime, timedelta, timezone
from io import BytesIO, StringIO
import json
import sys
import types
import unittest
from unittest.mock import patch

from financial_evidence_synthetic_object_lock_probe import (
    ProbeFailure, _account_matches, _require_version, execute_probe, main,
    synthetic_payload,
)

RUN = "b" * 32
BUCKET = "cortex-staging-financial-evidence-test"
ACCOUNT = "123456789012"


class FakeS3:
    def __init__(self):
        self.objects = {}
        self.calls = []
        self.mode = "COMPLIANCE"
        self.retention_days = 30
        self.head_mode = None
        self.bad_first_bytes = False
        self.fail_after_second_write = False
        self.omit_version_receipt = False
        self.bad_latest = False

    def put_object(self, *, Bucket, Key, Body, ContentType):
        self.calls.append(("put", Key))
        assert Bucket == BUCKET
        assert Key.startswith("cortex-synthetic-probes/")
        assert ContentType == "application/vnd.cortex.synthetic-object-lock-probe"
        assert Body.startswith(b"CORTEX-SYNTHETIC-OBJECT-LOCK-PROBE-V1")
        version = "fixture-version-" + str(len(self.objects.get(Key, [])) + 1)
        self.objects.setdefault(Key, []).append((version, Body))
        if self.fail_after_second_write and len(self.objects[Key]) == 2:
            raise RuntimeError("AWS secret SDK transport timeout")
        return {"VersionId": None if self.omit_version_receipt else version}

    def _lookup(self, Key, VersionId):
        options = self.objects[Key]
        if VersionId is None:
            return options[-1]
        for value in options:
            if value[0] == VersionId:
                return value
        raise KeyError("version not found")

    def get_object(self, *, Bucket, Key, VersionId=None):
        self.calls.append(("get", VersionId))
        version, data = self._lookup(Key, VersionId)
        if self.bad_first_bytes and version == "fixture-version-1" and len(self.objects[Key]) == 2:
            data = data.replace(b"generation=1", b"generation=9")
        if self.bad_latest and VersionId is None:
            version = "incorrect-latest"
        return {"VersionId": version, "Body": BytesIO(data)}

    def get_object_retention(self, *, Bucket, Key, VersionId):
        self.calls.append(("retention", VersionId))
        return {"Retention": {
            "Mode": self.mode,
            "RetainUntilDate": datetime.now(timezone.utc) + timedelta(days=self.retention_days),
        }}

    def head_object(self, *, Bucket, Key, VersionId):
        self.calls.append(("head", VersionId))
        return {
            "VersionId": VersionId,
            "ObjectLockMode": self.head_mode or self.mode,
            "ObjectLockRetainUntilDate": datetime.now(timezone.utc) + timedelta(days=self.retention_days),
        }

    def delete_object(self, **kwargs):
        raise AssertionError("probe must never attempt deletion")


# Deterministic retention timestamps: the probe compares GetObjectRetention
# to HeadObject, so a mock must return the SAME server timestamp.
class StableS3(FakeS3):
    def __init__(self):
        super().__init__()
        self.expires = datetime.now(timezone.utc) + timedelta(days=30)

    def get_object_retention(self, *, Bucket, Key, VersionId):
        self.calls.append(("retention", VersionId))
        return {"Retention": {"Mode": self.mode, "RetainUntilDate": self.expires}}

    def head_object(self, *, Bucket, Key, VersionId):
        self.calls.append(("head", VersionId))
        return {
            "VersionId": VersionId,
            "ObjectLockMode": self.head_mode or self.mode,
            "ObjectLockRetainUntilDate": self.expires,
        }


class ProbeTests(unittest.TestCase):
    def test_two_versions_original_preserved_no_delete(self):
        s3 = StableS3()
        report = execute_probe(s3, BUCKET, 7, RUN)
        self.assertTrue(report["technicalObjectVersionProofPassed"], report)
        self.assertEqual(report["retainedVersionCount"], 2)
        self.assertEqual(report["createdVersionIds"], ["fixture-version-1", "fixture-version-2"])
        self.assertEqual(len([call for call in s3.calls if call[0] == "put"]), 2)
        self.assertEqual(len([call for call in s3.calls if call[0] == "retention"]), 3)
        self.assertFalse(report["partialWriteMayExist"])
        self.assertFalse(report["bankDataAuthorized"])
        self.assertFalse(report["institutionRetentionPolicyVerified"])
        self.assertEqual(report["objectsDeleted"], 0)
        self.assertNotIn("SETTLEMENT", json.dumps(report))
        self.assertNotIn("BANK-SRC", json.dumps(report))

    def test_default_fixture_is_not_financial_feed(self):
        self.assertNotEqual(synthetic_payload(RUN, 1), synthetic_payload(RUN, 2))
        self.assertIn(b"NOT-A-BANK-FEED", synthetic_payload(RUN, 1))
        self.assertNotIn(b"amount_minor", synthetic_payload(RUN, 1))
        with self.assertRaises(ValueError):
            synthetic_payload("../../unsafe", 1)
        with self.assertRaises(ValueError):
            synthetic_payload(RUN, 3)

    def test_malformed_s3_version_refused(self):
        for bad in ("null", "", "../..?", "bad&versionId=other", None, 123):
            with self.subTest(bad=bad):
                with self.assertRaises(ProbeFailure):
                    _require_version({"VersionId": bad})

    def test_missing_version_receipt_is_ambiguous_and_not_retried(self):
        s3 = StableS3()
        s3.omit_version_receipt = True
        result = execute_probe(s3, BUCKET, 7, RUN)
        self.assertEqual(result["result"], "FAIL_NEEDS_MANUAL_REVIEW")
        self.assertEqual(result["safeErrorCode"], "s3_version_receipt_missing")
        self.assertTrue(result["partialWriteMayExist"])
        self.assertEqual(len(s3.objects[result["key"]]), 1)

    def test_governance_rejected_after_one_write(self):
        s3 = StableS3()
        s3.mode = "GOVERNANCE"
        result = execute_probe(s3, BUCKET, 7, RUN)
        self.assertEqual(result["safeErrorCode"], "object_version_not_in_compliance_mode")
        self.assertEqual(len(s3.objects[result["key"]]), 1)
        self.assertFalse(result["technicalObjectVersionProofPassed"])

    def test_short_retention_rejected(self):
        s3 = StableS3()
        s3.expires = datetime.now(timezone.utc) + timedelta(hours=5)
        result = execute_probe(s3, BUCKET, 7, RUN)
        self.assertEqual(result["safeErrorCode"], "object_version_retention_too_short")

    def test_head_metadata_disagreement_rejected(self):
        s3 = StableS3()
        s3.head_mode = "GOVERNANCE"
        result = execute_probe(s3, BUCKET, 7, RUN)
        self.assertEqual(result["safeErrorCode"], "head_object_lock_mode_missing")

    def test_pinned_first_version_tamper_rejected(self):
        s3 = StableS3()
        s3.bad_first_bytes = True
        result = execute_probe(s3, BUCKET, 7, RUN)
        self.assertEqual(result["safeErrorCode"], "pinned_version_checksum_mismatch")
        self.assertEqual(len(s3.objects[result["key"]]), 2)

    def test_latest_version_mismatch_rejected(self):
        s3 = StableS3()
        s3.bad_latest = True
        result = execute_probe(s3, BUCKET, 7, RUN)
        self.assertEqual(result["safeErrorCode"], "latest_version_not_expected")

    def test_ambiguous_timeout_must_report_key_without_secrets(self):
        s3 = StableS3()
        s3.fail_after_second_write = True
        result = execute_probe(s3, BUCKET, 7, RUN)
        self.assertEqual(result["createdVersionIds"], ["fixture-version-1"])
        self.assertEqual(result["safeErrorCode"], "aws_request_failed_or_ambiguous")
        self.assertTrue(result["partialWriteMayExist"])
        self.assertEqual(len(s3.objects[result["key"]]), 2)
        self.assertNotIn("AWS secret", json.dumps(result))

    def test_invalid_arguments_do_not_write(self):
        s3 = StableS3()
        with self.assertRaises(ValueError):
            execute_probe(s3, BUCKET, 0, RUN)
        self.assertEqual(s3.calls, [])

    def test_aws_identity_must_match_exact_account(self):
        class Sts:
            def get_caller_identity(self):
                return {"Account": ACCOUNT}
        self.assertTrue(_account_matches(Sts(), ACCOUNT))
        self.assertFalse(_account_matches(Sts(), "999999999999"))
        self.assertFalse(_account_matches(Sts(), "123"))
        class Failed:
            def get_caller_identity(self):
                raise RuntimeError("sensitive")
        self.assertFalse(_account_matches(Failed(), ACCOUNT))

    def test_cli_dry_run_never_writes(self):
        s3 = StableS3()
        class Session:
            def __init__(self, region_name):
                self.region = region_name
            def client(self, name):
                if name == "sts":
                    return types.SimpleNamespace(get_caller_identity=lambda: {"Account": ACCOUNT})
                if name == "s3":
                    return s3
                raise AssertionError("unexpected service")
        fake_boto3 = types.SimpleNamespace(session=types.SimpleNamespace(Session=Session))
        args = [
            "probe", "--bucket", BUCKET, "--region", "eu-west-1",
            "--minimum-retention-days", "7", "--approved-change-ticket",
            "CORTEX-CHANGE-0001", "--expected-aws-account-id", ACCOUNT,
            "--synthetic-only",
        ]
        output = StringIO()
        with patch.dict(sys.modules, {"boto3": fake_boto3}), patch.object(sys, "argv", args), \
                patch("financial_evidence_synthetic_object_lock_probe.inspect_bucket", return_value={}), \
                patch("financial_evidence_synthetic_object_lock_probe.evaluate_bucket",
                      return_value={"technicalControlsPassed": True, "failedChecks": []}), \
                redirect_stdout(output):
            exit_code = main()
        self.assertEqual(exit_code, 0)
        self.assertEqual(json.loads(output.getvalue())["result"], "READ_ONLY_PREFLIGHT_PASS")
        self.assertEqual([c for c in s3.calls if c[0] == "put"], [])

    def test_cli_no_approval_cannot_write(self):
        args = [
            "probe", "--bucket", BUCKET, "--region", "eu-west-1",
            "--minimum-retention-days", "7", "--approved-change-ticket",
            "CORTEX-CHANGE-0001", "--expected-aws-account-id", ACCOUNT,
            "--synthetic-only", "--execute-synthetic-write",
        ]
        with patch.object(sys, "argv", args), redirect_stderr(StringIO()):
            with self.assertRaises(SystemExit) as error:
                main()
        self.assertEqual(error.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
