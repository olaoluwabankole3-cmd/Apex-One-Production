# CORTEX financial exception CSV preview — limited operator contract

This is the next prototype-safe step toward issue #26. It is a **read-only, request-scoped preview**, not a bank feed connector, durable import, reconciliation certification, or approved financial action. The endpoint is intended for **synthetic staging fixtures only** until the institution-specific source agreement, security review, validated import mapping, retention policy and end-to-end UAT are complete.

## Endpoint

`POST /api/v1/reconciliation/preview`

Requires **authenticated same-organization session** with both `financial:read` and `financial:write`. No guest access, no client-supplied organization identifier, no override of model evidence verification. Request body is at most 320 KiB of UTF-8 JSON; each CSV input is at most 128 KiB and 1,000 data rows, 2,000 total. The endpoint never stores raw CSV data and uses `Cache-Control: no-store, private` for all responses. It writes **metadata-only** audit history to the composed durable audit authority before returning success; audit failure blocks the response. The request is not an idempotent durable import.

Request:

```json
{
  "kind": "settlement",
  "expected": {
    "feedId": "test-ledger-20261031",
    "csv": "reference,currency,amount_minor,record_id,recorded_at\nTX-001,NGN,12500,ledger-1,2026-10-31T10:00:00Z\n"
  },
  "observed": {
    "feedId": "test-settlement-20261031",
    "csv": "reference,currency,amount_minor,record_id,recorded_at\nTX-001,NGN,12400,provider-1,2026-10-31T10:00:00Z\n"
  }
}
```

Use `kind: "fee"` to compare *already approved and mapped expected-fee lines* against observed fees. The endpoint does **not** calculate expected fees from contract or rate schedules. Use optional `toleranceMinorByCurrency: { "NGN": "10" }` only when the institution has a documented comparison policy; omission requires exact matches. These are *minor currency units*, never floating-point NGN/naira amounts.

## Supported CSV schema

Strict five-column header (exact order):

```text
reference,currency,amount_minor,record_id,recorded_at
```

- `reference`: identical on expected and observed, without automatic trimming or fuzzy inference
- `currency`: canonical three-uppercase-letter currency code; never combine NGN and USD
- `amount_minor`: canonical signed decimal **integer string**, maximum 18 digits, no decimal point, grouping comma or scientific notation
- `record_id`: unique for each source row in a feed
- `recorded_at`: valid UTC ISO timestamp, with seconds and `Z`

CSV supports standard quotation/doubled quotations, LF and CRLF and an optional UTF-8 BOM. Incorrect quoting, extra columns, enormous fields, invalid dates, duplicate source IDs, invalid financial amounts and ambiguous duplicate economic references are rejected or flagged. Embedded multiline reference fields are not allowed because downstream financial reference validation rejects control characters.

For each supplied CSV the server computes SHA-256 of **request bytes**. These fingerprints are not proof of source authenticity, immutable storage, completeness, bank reconciliation or chain of custody. A future connector needs actual provenance and cryptographic verification.

## Interpretation

The engine groups by exact `kind + reference` and uses `BigInt` arithmetic. Results can be `balanced`, `amount_discrepancy`, `currency_mismatch`, `ambiguous` or `insufficient_source_coverage`. Because this preview **never verifies feed completeness**, any reference present in only one uploaded feed returns `insufficient_source_coverage`, not a proven `missing_expected` or `missing_observed` event.

The response carries:

- `previewOnly: true`
- `sourceStored: false`
- `sourceIntegrity: "request_digest_only"`
- `coverageVerified: false`
- `reconciliation.financialLossAssessed: false`
- `reconciliation.cases[].verificationState: "unverified"`

This endpoint must **not** generate bank-facing actions, certified loss amounts, paid recoveries or opportunities. Repeated requests generate another audit event but do not create durable cases.

## Tests

```bash
bun run test:financial-reconciliation
bun run test:financial-preview
bun run typecheck
```

The financial-preview test is part of mandatory Production CI. Stage 9/10/11 and exact-main CI remain deployment prerequisites.

## Remaining implementation gaps

1. Institution-approved ingestion connector, per-feed trust configuration, immutable encrypted source object and metadata-level authenticity checks
2. Persistent per-tenant import ledger with deduplication, replay handling, retention, quarantines, source-completeness and conflict-safe reimports
3. Human-mapped scheme-specific references, statuses, settlement windows and currencies; bank-defined fee schedules
4. Persisted exception cases with role-based ownership, assignments, due dates, validation and audit-safe human approvals
5. Integration with the existing workflow, authoritative evidence and Value Captured modules without overstating financial loss/recovery
6. Authenticated end-to-end staging UAT with synthetic finance data, incident/recovery exercises and reviewed operational rollback

**Do not upload actual bank/customer data to the preview endpoint until all these controls are approved.** Staging and production promotion must follow the repo runbooks. The AWS staging container still runs an older release, not this endpoint.
