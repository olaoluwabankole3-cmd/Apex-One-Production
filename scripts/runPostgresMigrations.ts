import { DatabaseStore } from "../lib/backend/database/store";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run PostgreSQL migrations");
  }

  const store = DatabaseStore.createPostgresStore(databaseUrl);
  await store.bootstrapPersistence();
  console.log("APEX ONE PostgreSQL migration 001_stage4_core is ready.");
}

main().catch((error) => {
  console.error("PostgreSQL migration failed:", error);
  process.exit(1);
});
