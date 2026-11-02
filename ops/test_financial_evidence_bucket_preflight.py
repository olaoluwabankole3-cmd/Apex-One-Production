"""No AWS credentials needed: exercise the fail-closed financial WORM preflight."""
from __future__ import annotations

import copy
import json
import pathlib
import unittest

from financial_evidence_bucket_preflight import CHECKS, evaluate_bucket, inspect_bucket

BUCKET = "cortex-staging-financial-evidence-test"
TICKET = "CORTEX-CHANGE-0001"


def fixture():
    root = "arn:aws:s3:::" + BUCKET
    return {
        "versioning": {"Status": "Enabled"},
        "object_lock": {"ObjectLockConfiguration": {
            "ObjectLockEnabled": "Enabled",
            "Rule": {"DefaultRetention": {"Mode": "COMPLIANCE", "Days": 30}},
        }},
        "encryption": {"ServerSideEncryptionConfiguration": {
            "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}],
        }},
        "public_block": {"PublicAccessBlockConfiguration": {
            "BlockPublicAcls": True, "IgnorePublicAcls": True,
            "BlockPublicPolicy": True, "RestrictPublicBuckets": True,
        }},
        "policy_status": {"PolicyStatus": {"IsPublic": False}},
        "ownership": {"OwnershipControls": {"Rules": [{"ObjectOwnership": "BucketOwnerEnforced"}]}},
        "tags": {"TagSet": [
            {"Key": "Application", "Value": "CORTEX"},
            {"Key": "Environment", "Value": "staging"},
            {"Key": "DataClass", "Value": "synthetic-only"},
            {"Key": "RetentionChangeTicket", "Value": TICKET},
        ]},
        "location": {"LocationConstraint": "eu-west-1"},
        "bucket_policy": {"Policy": json.dumps({
            "Version": "2012-10-17",
            "Statement": [
                {"Effect": "Deny", "Principal": "*", "Action": "s3:*",
                 "Resource": [root, root + "/*"],
                 "Condition": {"Bool": {"aws:SecureTransport": "false"}}},
                {"Effect": "Deny", "Principal": "*", "Action": "s3:PutObject",
                 "Resource": [root + "/*"],
                 "Condition": {"NumericLessThan": {"s3:TlsVersion": 1.2}}},
            ]
        })},
    }


def evaluate(changes=None, name=BUCKET, minimum=7, region="eu-west-1", ticket=TICKET):
    raw = fixture()
    if changes:
        changes(raw)
    return evaluate_bucket(name, raw, minimum, ticket, region)


class FailClosedConfigurationTests(unittest.TestCase):
    def test_all_controls_present_does_not_authorize_bank_data(self):
        report = evaluate()
        self.assertTrue(report["technicalControlsPassed"])
        self.assertEqual(set(report["checks"]), set(CHECKS))
        self.assertEqual(report["failedChecks"], [])
        self.assertFalse(report["approvedRealBankData"])
        self.assertFalse(report["bankSignerAuthorityVerified"])
        self.assertFalse(report["institutionRetentionPolicyVerified"])
        self.assertFalse(report["realAwsObjectVersionTested"])
        self.assertFalse(report["deploymentPerformed"])

    def test_each_missing_control_fails_closed(self):
        for key in fixture():
            with self.subTest(key=key):
                report = evaluate(lambda x: x.pop(key))
                self.assertFalse(report["technicalControlsPassed"], key)

    def test_wrong_document_bucket_refused_even_if_settings_look_good(self):
        report = evaluate(name="apex-one-staging-documents-apexsync")
        self.assertFalse(report["checks"]["separate_financial_bucket"])

    def test_governance_not_accepted_as_compliance(self):
        def change(x):
            x["object_lock"]["ObjectLockConfiguration"]["Rule"]["DefaultRetention"]["Mode"] = "GOVERNANCE"
        report = evaluate(change)
        self.assertFalse(report["checks"]["compliance_default_retention"])

    def test_retention_policy_insufficient(self):
        self.assertFalse(evaluate(minimum=31)["checks"]["retention_meets_synthetic_minimum"])

    def test_retention_years_not_assumed_to_be_days(self):
        def change(x):
            x["object_lock"]["ObjectLockConfiguration"]["Rule"]["DefaultRetention"] = {
                "Mode": "COMPLIANCE", "Years": 1
            }
        self.assertFalse(evaluate(change)["technicalControlsPassed"])

    def test_versioning_suspended_is_no_go(self):
        self.assertFalse(evaluate(
            lambda x: x["versioning"].update(Status="Suspended")
        )["checks"]["versioning_enabled"])

    def test_missing_public_block_is_no_go(self):
        report = evaluate(lambda x: x["public_block"]["PublicAccessBlockConfiguration"].update(
            RestrictPublicBuckets=False))
        self.assertFalse(report["checks"]["all_public_access_blocked"])

    def test_missing_policy_tls_denials_are_no_go(self):
        def change(x):
            doc = json.loads(x["bucket_policy"]["Policy"])
            doc["Statement"] = doc["Statement"][:1]
            x["bucket_policy"]["Policy"] = json.dumps(doc)
        self.assertFalse(evaluate(change)["checks"]["deny_tls_below_1_2"])
        def remove_plaintext(x):
            doc = json.loads(x["bucket_policy"]["Policy"])
            doc["Statement"] = doc["Statement"][1:]
            x["bucket_policy"]["Policy"] = json.dumps(doc)
        self.assertFalse(evaluate(remove_plaintext)["checks"]["deny_plaintext_transport"])

    def test_policy_for_other_bucket_is_not_sufficient(self):
        report = evaluate(
            lambda x: x["bucket_policy"].update(
                Policy=x["bucket_policy"]["Policy"].replace(BUCKET, "unrelated-bucket")
            ))
        self.assertFalse(report["checks"]["deny_plaintext_transport"])
        self.assertFalse(report["checks"]["deny_tls_below_1_2"])

    def test_wrong_change_ticket_or_classification_is_no_go(self):
        self.assertFalse(evaluate(ticket="CORTEX-CHANGE-0002")["checks"]["change_ticket_matches"])
        report = evaluate(lambda x: x["tags"]["TagSet"][2].update(Value="real-bank-data"))
        self.assertFalse(report["checks"]["staging_synthetic_tags"])

    def test_wrong_region_is_no_go(self):
        self.assertFalse(evaluate(region="us-east-1")["checks"]["region_known"])

    def test_sse_kms_can_pass_encryption_control(self):
        self.assertTrue(evaluate(lambda x:
            x["encryption"]["ServerSideEncryptionConfiguration"]["Rules"][0]
            ["ApplyServerSideEncryptionByDefault"].update(SSEAlgorithm="aws:kms")
        )["checks"]["server_side_encryption"])

    def test_bad_change_ticket_and_retention_inputs(self):
        with self.assertRaises(ValueError):
            evaluate(minimum=0)
        with self.assertRaises(ValueError):
            evaluate(ticket="short")
        with self.assertRaises(ValueError):
            evaluate(minimum=True)

    def test_invalid_policy_json_is_not_accepted(self):
        self.assertFalse(evaluate(lambda x:
            x["bucket_policy"].update(Policy="{invalid-json")
        )["checks"]["deny_plaintext_transport"])

    def test_missing_read_permission_cannot_pass(self):
        class Denied:
            def __getattr__(self, name):
                def reject(*args, **kwargs):
                    raise PermissionError("Sensitive AWS credential details")
                return reject
        observations = inspect_bucket(Denied(), BUCKET)
        self.assertEqual(len(observations), len(fixture()))
        self.assertTrue(all(value == {} for value in observations.values()))
        report = evaluate_bucket(BUCKET, observations, 7, TICKET, "eu-west-1")
        self.assertFalse(report["technicalControlsPassed"])
        self.assertNotIn("Sensitive AWS credential", json.dumps(report))

    def test_prepared_cloudformation_template_preserves_synthetic_gate(self):
        file = pathlib.Path(__file__).resolve().parents[1] / "deploy" / "aws" / "cortex-financial-evidence-staging.template.json"
        template = json.loads(file.read_text())
        bucket = template["Resources"]["FinancialEvidenceBucket"]
        props = bucket["Properties"]
        self.assertTrue(props["ObjectLockEnabled"])
        self.assertEqual(props["VersioningConfiguration"]["Status"], "Enabled")
        self.assertEqual(props["ObjectLockConfiguration"]["Rule"]["DefaultRetention"]["Mode"], "COMPLIANCE")
        self.assertEqual(bucket["DeletionPolicy"], "Retain")
        self.assertEqual(bucket["UpdateReplacePolicy"], "Retain")
        self.assertEqual(props["BucketEncryption"]["ServerSideEncryptionConfiguration"][0]
                         ["ServerSideEncryptionByDefault"]["SSEAlgorithm"], "AES256")
        self.assertEqual(props["PublicAccessBlockConfiguration"], {
            "BlockPublicAcls": True, "BlockPublicPolicy": True,
            "IgnorePublicAcls": True, "RestrictPublicBuckets": True,
        })
        self.assertEqual(props["OwnershipControls"]["Rules"][0]["ObjectOwnership"], "BucketOwnerEnforced")
        self.assertEqual(template["Parameters"]["SyntheticRetentionDays"]["MinValue"], 7)
        self.assertIn("ApprovedChangeTicket", template["Parameters"])
        statements = template["Resources"]["FinancialEvidenceBucketPolicy"]["Properties"]["PolicyDocument"]["Statement"]
        self.assertTrue(any(s["Condition"].get("Bool", {}).get("aws:SecureTransport") == "false" for s in statements))
        self.assertTrue(any(s["Condition"].get("NumericLessThan", {}).get("s3:TlsVersion") == 1.2 for s in statements))


if __name__ == "__main__":
    unittest.main()
