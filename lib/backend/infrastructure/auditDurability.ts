import { PostgresConnectionManager } from "../database/adapters/postgres/PostgresPersistence";

export const STAGE11_AUDIT_MIGRATION_003 = `
CREATE OR REPLACE FUNCTION apex_reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'apex_audit_logs is append-only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS apex_audit_logs_append_only ON apex_audit_logs;

CREATE TRIGGER apex_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON apex_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION apex_reject_audit_mutation();

ALTER TABLE apex_audit_logs
  ENABLE ALWAYS TRIGGER apex_audit_logs_append_only;

CREATE INDEX IF NOT EXISTS apex_audit_logs_request_idx
  ON apex_audit_logs (organization_id, ((record->>'requestId')), occurred_at DESC, id DESC);
`;

export interface DurableAuditStatus {
  appendOnlyTrigger: boolean;
  requestCorrelationIndex: boolean;
}

function postgresBoolean(value: string | null | undefined): boolean {
  return value === "t" || value === "true" || value === "1";
}

export async function ensureDurableAuditConstraints(databaseUrl: string): Promise<void> {
  const manager = new PostgresConnectionManager(databaseUrl);
  await manager.withConnection(async (connection) => {
    await connection.query("BEGIN");
    try {
      await connection.query(STAGE11_AUDIT_MIGRATION_003);
      await connection.query(
        `INSERT INTO apex_schema_migrations(version)
         VALUES ('003_stage11_audit_append_only')
         ON CONFLICT (version) DO NOTHING`
      );
      await connection.query("COMMIT");
    } catch (error) {
      try {
        await connection.query("ROLLBACK");
      } catch {
        // Preserve the migration failure.
      }
      throw error;
    }
  });
}

export async function getDurableAuditStatus(databaseUrl: string): Promise<DurableAuditStatus> {
  const manager = new PostgresConnectionManager(databaseUrl);
  return manager.withConnection(async (connection) => {
    const result = await connection.query(`
      SELECT
        EXISTS (
          SELECT 1
          FROM pg_trigger
          WHERE tgname = 'apex_audit_logs_append_only'
            AND tgrelid = 'apex_audit_logs'::regclass
            AND NOT tgisinternal
            AND tgenabled IN ('O', 'A')
        )::text AS append_only_trigger,
        EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'apex_audit_logs'
            AND indexname = 'apex_audit_logs_request_idx'
        )::text AS request_correlation_index
    `);
    const row = result.rows[0] || {};
    return {
      appendOnlyTrigger: postgresBoolean(row.append_only_trigger),
      requestCorrelationIndex: postgresBoolean(row.request_correlation_index),
    };
  });
}
