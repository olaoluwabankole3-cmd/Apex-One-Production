# CORTEX — durable financial preview-case metadata ledger (005)

**Scope:** A server-internal PostgreSQL foundation for provisional, source-unverified financial reconciliation review. This extends the deterministic engine (#27) and staging-only CSV preview (#28), but **does not** turn them into a live bank connector or financial loss/recovery service.

## Financial truth and privacy

The new ledger stores only tenant-bound request/source-pair SHA-256 fingerprints, pseudonymous case IDs, discrepancy categories, review state, reviewer ID, reason code, version and timestamps. It intentionally **does not retain** CSV bytes, account or transaction references, source object contents, customer identity, values, differences, or reported monetary losses. This is a metadata-only review register, not independently verified evidence of source authenticity or settlement completeness.

Each case remains **unverified**, with `sourceStored: false`, `coverageVerified: false`, and `financialLossAssessed: false`. A SHA-256 of client-provided CSV bytes does **not** prove a bank or switching-network file is authentic.

No publicly addressable endpoint and no sidebar page is added. The existing `/api/v1/reconciliation/preview` route is unchanged and remains off unless explicitly enabled for staging. This internal ledger is not invoked by that route; activation of durable intake must follow a separate security and source-retention review.

## Migration and persistence

Additive migration: `lib/backend/database/migrations/005_financial_preview_ledger.sql`, applied through `PostgresConnectionManager.bootstrap()` using the companion TypeScript SQL constant and recorded as `005_financial_preview_ledger`. It adds:

- `apex_financial_preview_batches`: tenant and request-fingerprint uniqueness to make repeat intake deterministic.
- `apex_financial_preview_cases`: composite tenant/batch/case key, case comparison and triage state, strict valid states, and optimistic version.
- Tenant-isolated indexes and foreign keys; no existing financial, customer, evidence, audit or transaction table is rewritten.

**A staging/production promotion of this migration requires a reviewed immutable image, protected manual snapshot and restore plan, a separate migration rehearsal on isolated staging PostgreSQL, and a prior approved digest.** Do not apply this change directly to live AWS in this task.

## Server-internal API

`FinancialPreviewCaseLedger` at `lib/backend/domains/reconciliation/financialPreviewCaseLedger.ts`

- `register(ctx, csvPreviewRequest)`: requires authenticated `financial:read` and `financial:write`; re-runs strict CSV parsing and deterministic reconciliation server-side; registers only *nonbalanced provisional case metadata*. Same tenant, two source SHA-256 fingerprints, kind and sorted compare tolerances generate an identical idempotency key. A duplicate returns `replayed: true` and creates no second audit event. A changed policy creates a new batch.
- `getBatch(ctx,batchId)`: requires `financial:read`. Lookup is always restricted to the tenant; another tenant's identifier returns not-found, without exposing its existence.
- `review(ctx,{batchId,caseId,expectedVersion,to,reasonCode})`: requires both financial-read and financial-write. The only allowed stages are `unreviewed → in_review → escalated | dismissed`. This is a provisional triage decision, never validation of a loss. `escalated` and `dismissed` are terminal until a future source-backed correction process is designed.
- Each register/review runs within a PostgreSQL serializable transaction and writes a standard CORTEX audit entry in that **same** transaction. Audit failure rolls back the batch/case insertion or review. Versions reject stale review writes.

The service is **not** available through HTTP. It should only be wired to a future authenticated ingestion/retention service after institution-specific source verification and a security review.

## Integration tests

```bash
bun run test:financial-ledger
```

Requires disposable PostgreSQL via `DATABASE_URL`. 15 synthetic integration checks cover migration idempotence; register/replay; tenant isolation; review permissions; policy changes; immutable case identity; optimistic transitions; audit-linked rollback for both registration and review; no raw source information persisted; and restart persistence. Production CI runs this after the existing PostgreSQL durability/integrity suite.

## Remaining gaps before financial-institution pilot

1. Approved read-only bank and payment-provider connectors, per-feed source authority and complete retention/verification policy.
2. Immutable encrypted source objects with independently verifiable chain of custody and documented import replay processing.
3. Source-specific mapping, reconciliation windows, fees/tolerances, reversals, settlement delays and reference disambiguation.
4. Durable human case assignment, due dates, escalation routing and auditable workflow approval; explicit segregation of duties.
5. Independent proof of resolution and captured-value evidence, rather than inferred recoveries.
6. Signed-off synthetic staging UAT, rollback rehearsal, secured AWS deployment identity, and institution/privacy/security approval.

**Production launch remains NO-GO.** Avoid uploading real financial-institution records through the preview route or presenting this ledger as certified financial reconciliation.
