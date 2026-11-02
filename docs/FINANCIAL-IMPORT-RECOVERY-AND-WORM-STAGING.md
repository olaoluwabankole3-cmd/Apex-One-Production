# Financial evidence WORM staging template and recovery-safe import journal

**Status:** internal-only synthetic foundation, NOT approved for real bank data. The CloudFormation template is **not deployed** by this PR.

## AWS storage reality checked on 2 November 2026

Connected AWS staging currently contains `apex-one-staging-documents-apexsync` with server-side encryption configured, **bucket versioning not enabled, and Object Lock not configured**. It is a document bucket, not a compliant financial WORM repository. No existing bucket settings have been changed.

## Dedicated storage infrastructure as code

`deploy/aws/cortex-financial-evidence-staging.template.json` is a manually deployable CloudFormation template for a **new and separate** staging-only bucket. It specifies:

- Bucket Object Lock enabled at creation, `COMPLIANCE` default retention (parameter 7–90 days for **synthetic fixtures only**), and bucket versioning enabled.
- SSE-S3 at rest (in addition to CORTEX's existing application AES-256-GCM document envelope); block all public access; bucket-owner-enforced ownership; TLS-only bucket policy.
- `DeletionPolicy: Retain` and `UpdateReplacePolicy: Retain` so stack deletion does not delete protected data.
- An approved change-ticket reference and explicit staging/synthetic-only tags.

**Do not deploy yet:** COMPLIANCE retention can be difficult or impossible to shorten, and stored versions may incur cost. A bank-approved classification/retention period, AWS account/bucket security review, cost acceptance and independent signer authority are required. The template does not grant ingest IAM credentials, connect sources, rotate encryption keys or perform a rollout. CloudFormation validation is not a full WORM attestation. Do not use 7 days as an institution-approved record-retention policy.

## Durable import state machine

New internal service `FinancialSourceImportJournalService` accepts **synthetic** validated CSV bytes plus a signed manifest and a stable opaque idempotency key. It requires the existing independent source-policy approval, current active institutional membership and the locally pinned Ed25519 public key.

```
prepared → uploading → stored → committed
                ↘         ↘
                 quarantined
```

1. **Prepare:** strict CSV parse, canonical signature verification bound to same-tenant approved source, deterministic journal/source/snapshot identity from org + source + idempotency key; write metadata-only journal and audit in one transaction.
2. **Upload claim:** atomic CAS of state/revision before touching S3. Competing workers cannot both claim the same idempotency key.
3. **Store:** write through AES-256-GCM storage, capture **S3-assigned object version**, re-read exactly that version, require COMPLIANCE retention metadata and matching plaintext SHA-256. Record pinned version and audit in one transaction.
4. **Commit:** after re-verification, atomically create the metadata-only financial snapshot, transition journal to `committed` and insert audit log. No bank amounts or raw CSV enter the database/audit.
5. **Recover:** `stored` can be committed after restart with no raw byte retransmission; `uploading` with unknown S3 receipt is quarantined for manual review. **Never auto-overwrite or auto-delete an unknown protected S3 version.** `prepared` needs an authorized original source to proceed.

The PostgreSQL journal CAS is conditional on both state and revision; the in-memory adapter uses transactional locking. Audit failures roll back the related database transition. S3 writes are NOT atomic with PostgreSQL; ambiguous uploads remain uncommitted and isolated, pending a controlled retention-aware reconciliation process.

## Explicit limitations

- A pinned key's valid signature does not independently prove **bank key ownership**.
- S3 retention metadata is an observed predicate, not comprehensive bank-approved WORM custody. Real AWS S3 Object Lock attestation has not been performed.
- Uploading an object whose receipt is lost can create a protected orphan; this code **quarantines rather than deletes/retries** such cases. Later cleanup requires retention and legal approval.
- There is **no real-bank connector, upload HTTP route, production flag, live deployment, source completeness claim, monetary confirmation, autonomous cash movement or financial recovery**.
- Staging-only switches `CORTEX_INTERNAL_FINANCIAL_SOURCE_INTAKE_ENABLED=true` and `CORTEX_VERSIONED_FINANCIAL_IMPORT_ENABLED=true` must both be present. Test fixtures may bypass switches under `TEST_ENV=true` but never override explicit production denial.

## Checks

```
bun run test:financial-import-journal
bun run test:financial-source-policy-pg
bun run test:financial-source-intake
bun run test:financial-provenance
bun run typecheck
bun run build
```

Production CI, Stage 9, Stage 10, Stage 11 and all new PostgreSQL integration tests must pass before merging. An actual infrastructure change requires its own independent review and user-approved release.
