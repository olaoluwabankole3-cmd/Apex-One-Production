# CORTEX: internal financial-source registration and encrypted custody foundation

**Release stage: synthetic staging foundation. Live bank-source ingestion is NOT enabled.**

## Why this is the next dependency

Reliable financial reconciliation is impossible when a spreadsheet upload or request-provided hash is mistaken for an authenticated record from a bank, processor or payment provider. Earlier read-only code can compare byte fingerprints but cannot establish origin, completeness, retention or authenticity. This milestone adds a *two-person policy gate*, encrypted intake custody metadata and read-back verification so the next adapter has a well-defined handoff boundary. It deliberately does **not** authenticate any third-party source.

## Implemented

- `FinancialSourceRegistryRecord` and `FinancialSourceSnapshotRecord` persist with the existing tenant-scoped PostgreSQL domain repository (or in-memory for tests). Every row is associated with the authenticated organization.
- Two different **currently active** institutional administrators must propose and approve a source definition. Both operations check persisted membership against session identity and are transactionally audited. An approval cannot be replayed or self-approved.
- Registrations specify an opaque source label, `settlement|fee` kind and `expected|observed` role. Approval authorizes **synthetic internal intake** only; `externalSourceAuthorityVerified=false` remains permanent in this release.
- Internal-only `ingestInternalSnapshot(ctx,{registryId,csvBytes})` accepts a bounded Buffer from a future approved server-to-server adapter, reuses the existing financial CSV parser/comparison validation, calculates the digest from the actual bytes, creates a unique tenant-scoped content-addressed object key, writes through the encrypted S3-compatible adapter and independently reads back/checks MIME, length and SHA-256 before persisting a metadata-only snapshot plus audit receipt.
- Internal-only `previewPair` checks snapshot roles/kind, current source approval, current staff permissions and bytes read at the moment of preview. It calls the existing reconciliation preview without asserting loss or bank source authority.
- CI exercises both deterministic in-memory behavior **and real AES-256-GCM encrypted LocalStack S3**: self-approval, disabled users, revoked roles, tenant isolation, malformed/oversized input, stale approval, distinct pair roles and deliberate storage overwrites. No uploaded content/transaction amounts are written to the domain registry or audit log.

## Release switch and invocation boundary

No source-registration, upload or source-pair-preview HTTP endpoint is added.

Outside test mode, the internal ingestion and policy service runs only when:

- `APEX_DEPLOYMENT_ENVIRONMENT=staging`
- `CORTEX_INTERNAL_FINANCIAL_SOURCE_INTAKE_ENABLED=true`
- Active session-based tenant context and current persisted staff membership are authorized.
- The injected object-storage service is `S3CompatibleObjectStorageService` with AES-256-GCM encrypting each object; the storage response must confirm AES-256-GCM.

This switch is **OFF by default**. It is not permission to supply real bank data. Only authorized synthetic fixtures may be passed into this internal service while source-origin verification and bank approval are missing.

## Accuracy / security boundaries

- **Byte-integrity at intake and at preview:** checked using the actual stored plaintext bytes after authenticated decryption. `byteIntegrityCheckedAtIntake=true` is narrowly scoped.
- **S3 Object Lock / WORM retention:** **NOT** implemented, and overwriting a stored object is still technically possible. The next read fails closed if its fingerprint differs, as tested.
- **Bank/provider source identity:** **NOT** independently authenticated; each snapshot keeps `sourceAuthenticityVerified=false`.
- **Feed completeness and policy cutoffs:** **NOT** independently established; `coverageVerified=false`.
- **Financial results:** no claimed loss, recovery, correction or certified opportunity; `financialLossAssessed=false`, and reconciliation remains preview-only.
- **S3 + DB atomicity:** an encrypted object can become orphaned if the DB transaction fails after the upload. The manifest is only recorded after byte read-back; missing DB records never authorize a preview. Future lifecycle tooling needs a retention-aware orphan reconciler, plus deletion controls.
- **Immutable audit/export:** existing database audit records are transactional, but external append-only archival and evidence notarization are not yet proven.
- **Real-bank source access:** requires bank-approved connector identity, scope/consent, signed provenance or independent provider validation, least-privilege credentials, approved data classification/retention, object-lock validation, checksum and chain-of-custody evidence, and bank security sign-off before first live file.

## Validation

Run in the S3 integration environment:

```bash
bun run test:financial-source-intake
bun run typecheck
bun run build
```

The test uses LocalStack and the existing encrypted object-storage adapter; CI supplies synthetic S3 credentials. Do **not** run it against a production bucket or production database.

## Next engineering milestone

Implement a bank-signed *source authority registry* and connector-specific ingest adapter with unique import idempotency keys, encrypted WORM/object-lock retention proof and an outbox-based S3/PostgreSQL commit-reconciliation process. Only after an institution approves and verifies these controls should real bank data enter the intake boundary. Connect captured manifests to the case/review workflow only after the corresponding independent acceptance tests and compliance sign-off.

**Production deployment: NO-GO.**
