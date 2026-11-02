# CORTEX — Synthetic AWS Object Lock Proof: Operator Runbook

**Status:** executable test harness only. **Not executed against AWS.** Real-bank source intake remains blocked. This is not a regulatory, bank-signing-authority, evidence-completeness, retention-law, or production-readiness certification.

## Why this exists

PR #46 added strict version-specific S3 custody checks. PR #47 added a metadata-only, idempotent and auditable financial import journal. PR #48 added a read-only AWS financial-evidence-bucket configuration preflight.

This milestone adds an opt-in real AWS **synthetic-only object-version proof** at `ops/financial_evidence_synthetic_object_lock_probe.py`. Once an authorized, separate bucket exists, it will demonstrate the crucial difference between **a protected version** and the **latest object at the same key**:

1. Recheck the entire bucket preflight in the selected AWS account and region, before writing anything.
2. Write the first small **non-CSV, non-financial, clearly marked synthetic** object. Require S3 to assign a non-null object version ID.
3. Read back that exact version, compare SHA-256, independently call S3 `GetObjectRetention` on the exact version, then corroborate S3 `HeadObject` Object Lock metadata. Require **COMPLIANCE** and the pre-approved minimum synthetic remaining retention.
4. Write different synthetic bytes to the **same key**, and require a distinct S3-assigned version.
5. Verify version 2 similarly, then **re-read version 1** to prove the initial immutable version still exists with matching bytes, retention and original version identity.
6. Verify an unversioned GET resolves to version 2 while the pinned GET for version 1 remains valid.
7. Output only an opaque generated key, S3 version IDs, digests, retention date and technical pass/fail results. **No data deletion, no bucket/retention/policy/IAM mutations, no real bank data.**

Each actual test stores *two retained versions* of a single newly generated object key. Even though the content is tiny, S3 COMPLIANCE retention can prevent permanent deletion until the retention period ends and **storage costs may persist**. Do not schedule or repeatedly execute this test. A lost S3 response is ambiguous: the application may have created protected evidence even if the SDK returned an error. The harness reports the opaque key and known versions for a separately controlled retention-aware inventory process; it **never auto-deletes or re-uploads** uncertain versions.

## Control hierarchy

**Dry-run / readiness (default):** only AWS read operations (STS account check and S3 bucket configuration). Requires an explicit bucket, expected AWS account, region, minimum synthetic retention, approved change-ticket marker and the `--synthetic-only` acknowledgement. `READ_ONLY_PREFLIGHT_PASS` means the *technical configuration checks* passed; **no object was written or independently tested**.

**Execution (separate operator action):** requires all of the above **plus** `--execute-synthetic-write`, a named `--independent-approver` and `--acknowledge-retention-cost`. These text parameters are **not evidence of actual external approval**; independently confirm signed change approval, retention legal/policy basis, budget, dedicated IAM least privilege, alerting, exact bucket name and encryption arrangements BEFORE execution. No script action or PR itself grants such approval.

### Dry-run (no AWS writes)

```bash
python3 -m pip install boto3
python3 ops/financial_evidence_synthetic_object_lock_probe.py \
  --bucket YOUR_APPROVED_SEPARATE_STAGING_FINANCIAL_EVIDENCE_BUCKET \
  --region eu-west-1 \
  --expected-aws-account-id YOUR_12_DIGIT_ACCOUNT_ID \
  --minimum-retention-days YOUR_APPROVED_SYNTHETIC_DAYS \
  --approved-change-ticket YOUR_APPROVED_CHANGE_TICKET \
  --synthetic-only
```

### Independent approval required before the separate write action

**Do not copy or run this example without an approved bucket and a documented independent change authorization.**

```bash
python3 ops/financial_evidence_synthetic_object_lock_probe.py \
  --bucket YOUR_APPROVED_SEPARATE_STAGING_FINANCIAL_EVIDENCE_BUCKET \
  --region eu-west-1 \
  --expected-aws-account-id YOUR_12_DIGIT_ACCOUNT_ID \
  --minimum-retention-days YOUR_APPROVED_SYNTHETIC_DAYS \
  --approved-change-ticket YOUR_APPROVED_CHANGE_TICKET \
  --synthetic-only \
  --execute-synthetic-write \
  --independent-approver YOUR_APPROVED_CHANGE_REVIEWER_ID \
  --acknowledge-retention-cost
```

The test creates a unique `cortex-synthetic-probes/<opaque-random-id>.txt` key. PutObject and GET operations require the operator's scoped S3 permissions; S3 retention checks require `s3:GetObjectRetention`, version read and `HeadObject`. AWS STS must return the expected account. Do not use production-account credentials or any real-bank/PSP data. Never grant `s3:BypassGovernanceRetention` to the test role.

## Evidence interpretation

Even if two versions pass, these remain explicitly **false**:

- `bankDataAuthorized`
- `institutionRetentionPolicyVerified`
- external bank-source signatory ownership, independent financial-source provenance
- snapshot coverage/completeness or confirmed monetary loss
- staging deployment / application ingestion integration

This AWS proof establishes only that *these exact two synthetic versions* have reproducible S3 COMPLIANCE retention observations and matching read-back bytes at test time. It does **not** certify deletion resistance against all principals, encryption-key custody, key rotation/revocation, CloudTrail audit coverage, replicating regions, or institution-specific regulatory WORM rules. Those require separate testing and independent review.

## Verification with NO AWS access

```bash
python3 -m unittest discover -s ops -p 'test_financial_evidence_synthetic_object_lock_probe.py' -v
```

Tests use a fake boto3 client, simulate versioned storage and failure after a protected S3 write, and verify no delete calls, tampering detection, wrong latest version, missing or insufficient COMPLIANCE retention, missing S3 version IDs, and dry-run / explicit-opt-in CLI gates. Included in CORTEX Production CI. Tests never use AWS credentials or write AWS objects.

## Remaining blockers

- **Dedicated bucket not created:** `apex-one-staging-documents-apexsync` is still a shared document bucket with no Object Lock or versioning at the 2 November 2026 account audit.
- Approve concrete synthetic retention duration, irreversible storage implications, exact AWS account/region/new bucket, and a change-ticket signer independent of the implementer.
- Approve and provision dedicated staging bucket separately with change-managed IAM policies and cost/retention review.
- Run the *dry-run* preflight, then the separately authorized synthetic AWS version proof.
- Independently validate signatory ownership and institutional contract requirements **before any real bank data pilot**.
