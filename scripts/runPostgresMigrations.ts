import { DatabaseStore } from "../lib/backend/database/store";
import { PostgresDocumentSearchIndex } from "../lib/backend/domains/documents/documentSearchIndex";
import { ensureDurableAuditConstraints } from "../lib/backend/infrastructure/auditDurability";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run PostgreSQL migrations");
  }

  const store = DatabaseStore.createPostgresStore(databaseUrl);
  await store.bootstrapPersistence();
  await new PostgresDocumentSearchIndex(databaseUrl).bootstrap();
  await ensureDurableAuditConstraints(databaseUrl);
  console.log(
    "APEX ONE PostgreSQL migrations 001_stage4_core, 002_stage4_document_search, and 003_stage11_audit_append_only are ready."
  );
}

main().catch((error) => {
  console.error("PostgreSQL migration failed:", error);
  process.exit(1);
});
