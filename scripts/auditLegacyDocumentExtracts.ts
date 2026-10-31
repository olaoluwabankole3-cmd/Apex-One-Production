/**
 * CORTEX safe, READ-ONLY per-tenant inventory. Does not print records or source content.
 */
import { PostgresWireConnection, quotePostgresLiteral } from "../lib/backend/database/adapters/postgres/PostgresWireClient";
async function main(): Promise<void> {
  const i = process.argv.indexOf("--tenant-id");
  const tenantId = i < 0 ? undefined : process.argv[i + 1]?.trim();
  if (!tenantId || tenantId.length > 128 || !/^[a-zA-Z0-9_.:-]+$/.test(tenantId)) {
    throw new Error("Supply one approved --tenant-id (no cross-tenant inventory)");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must come from a protected staging secret");
  const connection = await PostgresWireConnection.connect(url);
  try {
    await connection.query("BEGIN READ ONLY");
    try {
      const result = await connection.query(`
        SELECT COUNT(*) AS total_documents,
          COUNT(*) FILTER (
            WHERE COALESCE(record->'metadata'->>'extractionPolicyVersion','') <> 'source-grounded-v1'
            AND (COALESCE(record->>'aiSummary','') <> ''
              OR COALESCE(jsonb_array_length(
                  CASE WHEN jsonb_typeof(record->'extractedFields') = 'array'
                    THEN record->'extractedFields' ELSE '[]'::jsonb END), 0) > 0)
          ) AS legacy_content_records
        FROM apex_domain_records
        WHERE entity_type = 'Document' AND organization_id = ${quotePostgresLiteral(tenantId)}
      `);
      console.log(JSON.stringify({
        tenantId, dryRun: true, modified: false,
        totalDocuments: Number(result.rows[0]?.total_documents || 0),
        unassessedLegacyRecords: Number(result.rows[0]?.legacy_content_records || 0)
      }));
    } finally { await connection.query("ROLLBACK"); }
  } finally { await connection.close(); }
}
main().catch(err => {
 console.error("Legacy-document inventory failed:", err instanceof Error ? err.message : "unknown error");
 process.exitCode = 1;
});
