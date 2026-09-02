-- APEX ONE — Stage 4E PostgreSQL durable document search index
-- Search state is derived from the authoritative Document JSONB row. Only rows
-- whose authoritative processing status is `indexed` participate in search.

CREATE INDEX IF NOT EXISTS apex_domain_records_document_search_gin_idx
  ON apex_domain_records USING GIN (
    to_tsvector(
      'simple'::regconfig,
      COALESCE(record->>'name', '') || ' ' ||
      COALESCE(record->>'category', '') || ' ' ||
      COALESCE(record->>'tags', '') || ' ' ||
      COALESCE(record->>'aiSummary', '') || ' ' ||
      COALESCE(record->>'extractedFields', '')
    )
  )
  WHERE entity_type = 'Document' AND record->>'status' = 'indexed';

INSERT INTO apex_schema_migrations(version)
VALUES ('002_stage4_document_search')
ON CONFLICT (version) DO NOTHING;
