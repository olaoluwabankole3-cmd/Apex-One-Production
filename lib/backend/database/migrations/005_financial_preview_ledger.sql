-- CORTEX 005 — additive, metadata-only financial preview intake registry.
-- No uploaded CSV, customer identifiers, financial amounts or financial loss proof
-- are retained here. The legacy reconciliation preview endpoint remains separate.
--
-- A batch is an immutable digest of two request-provided CSVs and compare policy.
-- The case's hashed reference is only a pseudonymous candidate identifier.
-- These records do not establish authenticated bank-source integrity.

CREATE TABLE IF NOT EXISTS apex_financial_preview_batches (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES apex_organizations(id) ON DELETE RESTRICT,
  request_fingerprint CHAR(64) NOT NULL,
  source_pair_fingerprint CHAR(64) NOT NULL,
  reconciliation_kind TEXT NOT NULL CHECK (reconciliation_kind IN ('settlement', 'fee')),
  case_count INTEGER NOT NULL CHECK (case_count >= 0 AND case_count <= 2000),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT apex_financial_preview_batch_id_org_unique UNIQUE (organization_id, id),
  CONSTRAINT apex_financial_preview_request_unique UNIQUE (organization_id, request_fingerprint)
);

CREATE TABLE IF NOT EXISTS apex_financial_preview_cases (
  organization_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  comparison_status TEXT NOT NULL CHECK (comparison_status IN (
    'amount_discrepancy', 'currency_mismatch', 'missing_expected',
    'missing_observed', 'insufficient_source_coverage', 'ambiguous'
  )),
  triage_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (
    triage_status IN ('unreviewed', 'in_review', 'escalated', 'dismissed')
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version BETWEEN 1 AND 2147483647),
  reviewer_id TEXT,
  reason_code TEXT CHECK (
    reason_code IN ('source_gap', 'mapping_error', 'potential_discrepancy', 'duplicate', 'other')
  ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, batch_id, case_id),
  CONSTRAINT apex_financial_preview_case_batch
    FOREIGN KEY (organization_id, batch_id)
    REFERENCES apex_financial_preview_batches(organization_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT apex_financial_preview_case_review_state CHECK (
    (triage_status = 'unreviewed' AND reviewer_id IS NULL AND reason_code IS NULL)
    OR (triage_status != 'unreviewed' AND reviewer_id IS NOT NULL AND reason_code IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS apex_financial_preview_cases_tenant_review_idx
  ON apex_financial_preview_cases(organization_id, triage_status, batch_id);

INSERT INTO apex_schema_migrations(version)
VALUES ('005_financial_preview_ledger')
ON CONFLICT (version) DO NOTHING;
