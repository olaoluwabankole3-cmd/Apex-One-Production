# CORTEX — read-only financial source byte-integrity gate

**Milestone:** pre-pilot safety step for [financial-institution MVP issue #26](https://github.com/olaoluwabankole3-cmd/Apex-One-Production/issues/26). This feature is deliberately **internal-only**. It provides exact-byte checks against pinned SHA-256 digests of two already-stored synthetic source snapshots before using the existing deterministic reconciliation preview.

It **does not yet provide trusted bank ingestion, secure retention policy enforcement, immutable S3 Object Lock, authentic provider signatures, or approved source provenance**. The word *verified* applies **only to the bytes read at that instant**, not to the bank origin or financial content.

## Workflow

1. A future vetted institution-approved source connector will establish bank/provider authority, retention policy, immutable storage, authenticated source manifest, precise coverage window and digest. This project milestone does **not** implement those controls; the caller must not get digests from an unauthenticated HTTP request.
2. A separate future ingestion process stores encrypted source files under an institution-scoped key using the existing AES-256-GCM S3 adapter. The canonical key is `tenants/<sha256(orgId).slice(0,32)>/financial-sources/<sha256(csv)>/<opaqueSourceId>.csv`. This key is address-like only and **not** a write-once guarantee.
3. `reconcilePinnedFinancialSourceSnapshots(ctx, request, storage?)` in `lib/backend/domains/reconciliation/financialSourceIntegrityGate.ts` derives the expected tenant-scoped keys from a server-internal pair of pinned snapshot descriptors. It requires `financial:read` AND `financial:write` before touching storage.
4. The gate reads both objects, validates their MIME as `text/csv`, exact byte counts, expected SHA-256 using constant-time comparison, and strict UTF-8 decode. In production it refuses any injected provider that is not the existing AES-256-GCM S3 adapter. If anything mismatches, it fails closed. It never creates substitute data.
5. The validated CSV bytes enter the existing strict five-column CSV parser and integer-minor-unit reconciliation preview. Output remains `previewOnly: true`, `sourceAuthenticityVerified: false`, `storageImmutabilityVerified: false`, `coverageVerified: false`, and `financialLossAssessed: false`. Every case remains `unverified`. No case ledger mutation occurs here.

**No HTTP API, external bank connection, automated funds movement, object write, database migration, financial dashboard or exception certification is introduced.** The internal tool does not yet connect to the metadata-only financial case ledger (#29). Staging/production feature flags are unchanged.

## Tests and actual boundaries

The test suite `scripts/runFinancialSourceIntegrityTests.ts`, run in the existing LocalStack S3 CI job after storage integration, exercises two types of storage:

- In-memory adapter: tenant isolation, duplicate snapshot rejection, mismatched bytes/digests/MIME, malformed UTF-8, absent objects and unauthorized requests.
- Real S3-compatible LocalStack adapter with AES-256-GCM client-side encryption: source reads round-trip, tampered overwrite fails SHA-256, missing object fails closed, foreign-tenant reads fail closed, raw stored S3 object contains ciphertext envelope rather than CSV plaintext.

```bash
bun run test:s3
bun run test:financial-source-integrity
bun run typecheck
```

The new command is executed in Production CI in the S3 integration job with existing local-only synthetic credentials. **It does not operate on AWS account resources or actual financial institution data.**

## Important security limitations

- **S3 object immutability is unproven.** Existing `putObject` can overwrite the same key. This gate detects changed content on a later read but cannot prevent the overwrite or prevent a race after verification. True durable provenance needs versioned writes, source authorization, locked retention, scoped IAM and evidence for replay/recovery.
- **Manifests are not authenticated.** The expected SHA-256 comes from a future trusted adapter; allowing clients to submit arbitrary matching digests would create only a self-asserted integrity check. No interface should present these as certified bank evidence.
- **The SHA-256 proves bits, not correctness.** Matching CSV rows may be incomplete, mis-mapped, manipulated at origin or financially wrong.
- **No monetary outcomes.** Discrepancies are candidates only; never verified leakage or recorded recovery.
- **No enduring source linkage.** The metadata-only case ledger does not yet pin an immutable S3 object version, a validated feed identifier, a source authority or an extraction/mapping version.

## Next acceptance milestones

1. Institution-authorized source-adapter contract and verified issuer/authority registry.
2. S3 object-lock/versioned immutable retention scheme (or equivalent provider-enforced WORM) with read-by-version and repeat-verification evidence.
3. Atomic mapping of source manifest + immutable object version + batch and reconciliation candidate, with replay handling, tenant isolation, quarantine and audit.
4. Segregated case ownership, approval, evidence review, and measured outcome confirmation.
5. Manual restore/snapshot and rollback rehearsal before any AWS staging migration or promotion.

**Production remains NO-GO.**
