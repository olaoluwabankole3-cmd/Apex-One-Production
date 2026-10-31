# CORTEX financial reconciliation foundation — source-to-exception contract

**Scope:** Financial-institution pilot engineering foundation. Pure, tenant-authorized, read-only comparison logic. No bank connectivity, data import, runtime endpoint, persistent case workflow or live financial results are implemented by this change.

## Intended operator workflow

1. Institution authorizes specific source feeds, retention, mapping and processing permissions.
2. A **future** authenticated ingestion adapter independently verifies access, checks source object fingerprints/immutability and completes record mapping. Do not trust client-supplied organization IDs, hashes or completeness declarations.
3. `reconcileFinancialSourceLines(ctx, request)` compares already mapped **expected** and **observed** records grouped strictly by `kind` (`settlement` or `fee`) plus **exact reference**. No fuzzy matching, exchange-rate conversion or AI-driven amounts.
4. The engine assigns a deterministic case ID, candidate comparison status, original source pointers and exact integer minor-unit delta. An amount delta is never automatically a loss estimate, a recoverable amount or verified financial evidence.
5. A **future** trusted persistence service must bind the case to the current authenticated organization, record reviewed source provenance, audit decisions, assign owners and require approvals before any external action.
6. A separate downstream reconciliation proof must verify resolved outcomes before aggregating recovery or publishing certified value.

## API of the pure engine

`lib/backend/domains/reconciliation/settlementExceptionEngine.ts`

**Source lines** require `organizationId`, `kind`, `role`, `reference`, `currency` (ISO-like uppercase three-character code), `amountMinor` (canonical signed decimal integer string), `sourceDocumentId`, `sourceRecordId`, `sourceSha256` and `recordedAt` (UTC). All lines must belong to the authenticated `TenantContext.organizationId`. The caller must have `financial:read`.

`declaredCoverage.expectedFeedComplete` and `declaredCoverage.observedFeedComplete` are **caller assertions**, not independently established by the engine. A missing side when its declared feed is incomplete is `insufficient_source_coverage` rather than a missing or lost transaction.

A case can be `balanced`, `amount_discrepancy`, `currency_mismatch`, `missing_expected`, `missing_observed`, `insufficient_source_coverage`, or `ambiguous`. Duplicate identifiers fail the whole batch; duplicate matched reference groups fail closed as `ambiguous` until separately reviewed. Currency mismatches do **not** compute a number. The default tolerance is zero, configurable only per currency in nonnegative integer minor units.

**The result sets `financialLossAssessed: false` and every case `verificationState: "unverified"`.** SHA-256 is supplied source *metadata*, not proof that bytes were verified. Outcome evidence and independent certification remain outside this engine.

## Test and release gates

```bash
bun run test:financial-reconciliation
bun run typecheck
```

This independent test set covers exact and fee comparisons, missing and incomplete feeds, currency isolation, integer precision, tolerance, ambiguous duplicates, source metadata, tenant crossing, capabilities, stable case IDs and batch limits. It runs in the CORTEX Production CI security/integrity job before any merge.

## Explicitly NOT connected

- No bank core, switching network, settlement provider, payment acquirer or regulator API integration.
- No encrypted source ingestion, actual feed completeness verification, contract-fee schedule calculation, case persistence, workflow initiation or automatic fund movement.
- No real customer data, live revenue-leakage detection, achieved recovery, financial transaction monitoring or regulatory certification.
- No HTTP endpoint or user-facing success claim for an unverified bank reconciliation.

## Next implementation step (issue #26)

Deliver a strictly server-authenticated **read-only** source import and comparison pipeline with a pilot-approved format, per-tenant mapping, immutable source evidence, idempotency, untrusted-data limits and audit logging. Then link candidate cases to existing authorized workflow and evidence services. Define a cross-currency and missing-source test matrix, schema migration and staging recovery plan before allowing pilot inputs.

**Production remains NO-GO** without authenticated UAT, evidence reviews, rollback rehearsal, a scoped AWS deploy identity and stakeholder sign-off.
