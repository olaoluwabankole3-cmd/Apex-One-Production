-- APEX ONE — Stage 4B PostgreSQL authoritative persistence schema
-- Runtime bootstrap applies the same migration transactionally and records
-- version 001_stage4_core in apex_schema_migrations.

CREATE TABLE IF NOT EXISTS apex_schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apex_organizations (
  id TEXT PRIMARY KEY,
  slug_normalized TEXT NOT NULL UNIQUE,
  record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT apex_organizations_record_id CHECK (record->>'id' = id)
);

CREATE TABLE IF NOT EXISTS apex_users (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL UNIQUE,
  record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT apex_users_record_id CHECK (record->>'id' = id)
);

CREATE TABLE IF NOT EXISTS apex_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES apex_organizations(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES apex_users(id) ON DELETE RESTRICT,
  record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT apex_memberships_unique_user_org UNIQUE (organization_id, user_id),
  CONSTRAINT apex_memberships_record_id CHECK (record->>'id' = id),
  CONSTRAINT apex_memberships_record_org CHECK (record->>'organizationId' = organization_id),
  CONSTRAINT apex_memberships_record_user CHECK (record->>'userId' = user_id)
);

CREATE TABLE IF NOT EXISTS apex_domain_records (
  entity_type TEXT NOT NULL,
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES apex_organizations(id) ON DELETE RESTRICT,
  record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_type, id),
  CONSTRAINT apex_domain_record_id CHECK (record->>'id' = id),
  CONSTRAINT apex_domain_record_org CHECK (record->>'organizationId' = organization_id)
);

CREATE INDEX IF NOT EXISTS apex_domain_records_tenant_type_idx
  ON apex_domain_records (organization_id, entity_type, id);
CREATE INDEX IF NOT EXISTS apex_domain_records_record_gin_idx
  ON apex_domain_records USING GIN (record jsonb_path_ops);

CREATE TABLE IF NOT EXISTS apex_audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  record JSONB NOT NULL,
  CONSTRAINT apex_audit_record_id CHECK (record->>'id' = id),
  CONSTRAINT apex_audit_record_org CHECK (record->>'organizationId' = organization_id)
);

CREATE INDEX IF NOT EXISTS apex_audit_logs_tenant_time_idx
  ON apex_audit_logs (organization_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS apex_audit_logs_record_gin_idx
  ON apex_audit_logs USING GIN (record jsonb_path_ops);
