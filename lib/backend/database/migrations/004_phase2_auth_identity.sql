-- APEX ONE — Phase 2 authentication identity migration
-- Adds case-insensitive username uniqueness for optional username login.
-- Email remains a unique login authority through apex_users.email_normalized.

CREATE UNIQUE INDEX IF NOT EXISTS apex_users_username_normalized_unique_idx
  ON apex_users ((LOWER(BTRIM(record->>'username'))))
  WHERE NULLIF(BTRIM(record->>'username'), '') IS NOT NULL;

INSERT INTO apex_schema_migrations(version)
VALUES ('004_phase2_auth_identity')
ON CONFLICT (version) DO NOTHING;
