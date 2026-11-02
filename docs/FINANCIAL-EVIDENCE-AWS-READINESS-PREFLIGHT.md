# CORTEX — AWS financial evidence-bucket preflight (READ ONLY)

**Operational status: NO-GO for live bank data.** This preflight validates *configuration evidence only*. It cannot authorize storage with irreversible retention, connect a bank, verify institutional custody, or deploy AWS infrastructure.

## Scope and observations (AWS account, 2 November 2026)

The connected staging account contains one S3 bucket: `apex-one-staging-documents-apexsync`, in `eu-west-1`.

Read-only inspection found:

| Control | Existing document bucket |
| --- | --- |
| S3 versioning | Not enabled |
| S3 Object Lock | Not configured |
| SSE encryption | AES256 configured |
| Public access block | All four settings true |
| Object ownership | BucketOwnerEnforced |
| Bucket policy / TLS deny | No bucket policy; no policy-status record |
| Staging evidence classification tags | No tag set |

It **is not** a financial WORM evidence bucket. Existing document storage should remain separate. No AWS resources were modified.

## Executable preflight

`ops/financial_evidence_bucket_preflight.py` uses **only read-only S3 Get* operations** to inspect an explicitly nominated *new* bucket. It requires an operator-supplied expected region, minimum **synthetic** retention period, change-ticket identifier and `--synthetic-only` acknowledgement. The change-ticket text is checked against the bucket tag but **its approval status cannot be established from a tag**.

Example, only *after an independently approved bucket has been provisioned*:

```bash
python3 -m pip install boto3
python3 ops/financial_evidence_bucket_preflight.py \
  --bucket YOUR_APPROVED_NEW_STAGING_FINANCIAL_EVIDENCE_BUCKET \
  --region eu-west-1 \
  --minimum-retention-days 7 \
  --approved-change-ticket CORTEX-CHANGE-APPROVED-001 \
  --synthetic-only
```

The 7-day value above is **an illustrative synthetic test parameter**, not a financial-sector or regulatory retention recommendation. Operators must substitute the actual *approved* period, and must not use this preflight as a live-data readiness attestation.

The command prints a safe JSON summary and exits nonzero if a technical check is absent or an AWS API call is denied. No credentials, statements, data objects, signing keys or raw bank data appear in the output.

### Mandatory technical checks

- A separate financial-evidence bucket (not the shared document bucket), with a known matching region and `Versioning=Enabled`.
- `ObjectLockEnabled=Enabled`; a bucket default **COMPLIANCE** retention rule using days that meets the explicit synthetic test minimum.
- Four public-access-block settings enabled, non-public bucket policy status, SSE-S3 or SSE-KMS default encryption, bucket-owner-enforced ownership.
- Explicit deny rules for non-TLS requests and PUTs below TLS 1.2, on the actual bucket/resource ARNs.
- Synthetic-only CORTEX staging classification tags and a change-ticket tag equal to the approved identifier supplied by the operator.

The report continues to assert `approvedRealBankData=false`, `bankSignerAuthorityVerified=false`, `institutionRetentionPolicyVerified=false`, `realAwsObjectVersionTested=false` and `deploymentPerformed=false` even if all technical checks pass.

## How it fits the code already merged

- PR #46: canonical Ed25519 manifest verification plus version-specific S3 COMPLIANCE header and plaintext digest checking.
- PR #47: metadata-only, idempotent, audited import journal with quarantine of ambiguous S3 receipts and transactional recovery.
- This change: read-only AWS control-plane checks and tests ensuring the protected bucket is not assumed to exist.

All three are *separate controls*. A matching hash is not bank identity. An S3 version header is not regulatory retention sign-off. A configuration pass is not an actual AWS synthetic-object read/write and recovery test.

## Deployment approval checklist

Before anyone creates an Object Lock bucket in the account, secure: a named change approver, retention legal/privacy classification and duration, cost acceptance for protected object versions, IAM/KMS/rotation review, dedicated bucket naming and region, and a rollback/disposal strategy that acknowledges COMPLIANCE retention may not be shortened. Next, perform an **explicitly authorized synthetic-only AWS version test**, verify bucket event logging and IAM enforcement, and independently onboard the actual bank signatory authority. Only then can a controlled real-bank pilot even be considered.

### Test commands

```bash
python3 -m unittest discover -s ops -p 'test_financial_evidence_bucket_preflight.py' -v
bun run typecheck
bun run build
```

This test suite uses local fake S3 control-plane responses and validates the checked-in CloudFormation template; it makes **no AWS calls** and requires no credentials. The operator CLI is separate and uses read-only AWS credentials.
