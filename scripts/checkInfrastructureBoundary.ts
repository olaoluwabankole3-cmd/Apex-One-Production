/**
 * APEX ONE — Stage 4 production infrastructure boundary verification.
 */

import * as fs from "fs";
import * as path from "path";
import {
  DURABLE_IMPLEMENTATION_STATUS,
  getInfrastructureReadiness,
  resolveInfrastructureConfiguration,
  type InfrastructureEnvironment,
} from "../lib/backend/infrastructure/runtime";

interface CheckResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: CheckResult[] = [];

function check(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (error: any) {
    results.push({ name, passed: false, error: error?.message || String(error) });
  }
}

function durableProductionEnv(): InfrastructureEnvironment {
  return {
    APP_ENV: "production",
    APEX_DATABASE_ADAPTER: "postgres",
    APEX_SESSION_ADAPTER: "redis",
    APEX_RATE_LIMIT_ADAPTER: "redis",
    APEX_AUDIT_ADAPTER: "postgres",
    APEX_OBJECT_STORAGE_ADAPTER: "s3",
    APEX_SEARCH_INDEX_ADAPTER: "postgres",
    DATABASE_URL: "postgres://example.invalid/apex?sslmode=require",
    REDIS_URL: "rediss://example.invalid:6380/0",
    S3_BUCKET: "apex-production-documents",
    S3_REGION: "eu-west-1",
    S3_ENDPOINT: "https://s3.example.invalid",
    S3_ACCESS_KEY_ID: "example-access-key",
    S3_SECRET_ACCESS_KEY: "example-secret-key",
    DOCUMENT_STORAGE_ENCRYPTION_KEY: "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=",
  };
}

check("1. Non-production defaults remain explicit in-memory test/development adapters", () => {
  const configuration = resolveInfrastructureConfiguration({ APP_ENV: "development" });
  for (const [authority, provider] of Object.entries(configuration)) {
    if (provider !== "memory") throw new Error(`${authority} unexpectedly defaulted to '${provider}' outside production`);
  }
});

check("2. Production with missing adapter configuration fails closed", () => {
  const readiness = getInfrastructureReadiness({ APP_ENV: "production" });
  if (readiness.ready) throw new Error("Production was marked ready with in-memory defaults");
  for (const authority of ["database", "session", "rateLimit", "audit", "objectStorage", "searchIndex"]) {
    if (!readiness.issues.some((issue) => issue.includes(authority))) {
      throw new Error(`Missing production readiness issue for ${authority}`);
    }
  }
});

check("3. Durable production selection is ready only after every code-owned adapter flag is promoted", () => {
  for (const [authority, implemented] of Object.entries(DURABLE_IMPLEMENTATION_STATUS)) {
    if (!implemented) throw new Error(`${authority} readiness flag was not promoted after durable wiring`);
  }
  const readiness = getInfrastructureReadiness(durableProductionEnv());
  if (!readiness.ready) throw new Error(`Fully durable production composition is not ready: ${readiness.issues.join("; ")}`);
  if (readiness.issues.some((issue) => issue.includes("durable adapter is not yet implemented"))) {
    throw new Error("Code-owned implementation gate still reports an unimplemented authority");
  }
});

check("4. Production durable providers require connection metadata, encryption, and TLS", () => {
  const env = durableProductionEnv();
  delete env.DATABASE_URL;
  delete env.REDIS_URL;
  delete env.S3_BUCKET;
  delete env.S3_REGION;
  delete env.S3_ACCESS_KEY_ID;
  delete env.S3_SECRET_ACCESS_KEY;
  delete env.DOCUMENT_STORAGE_ENCRYPTION_KEY;
  const readiness = getInfrastructureReadiness(env);
  for (const key of [
    "DATABASE_URL",
    "REDIS_URL",
    "S3_BUCKET",
    "S3_REGION",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "DOCUMENT_STORAGE_ENCRYPTION_KEY",
  ]) {
    if (!readiness.issues.some((issue) => issue.includes(key))) throw new Error(`Missing required infrastructure variable check for ${key}`);
  }

  const insecure = durableProductionEnv();
  insecure.DATABASE_URL = "postgres://db.example/apex?sslmode=disable";
  insecure.REDIS_URL = "redis://redis.example:6379/0";
  insecure.S3_ENDPOINT = "http://s3.example.invalid";
  insecure.DOCUMENT_STORAGE_ENCRYPTION_KEY = "not-a-32-byte-key";
  const insecureReadiness = getInfrastructureReadiness(insecure);
  if (!insecureReadiness.issues.some((issue) => issue.includes("sslmode=require"))) throw new Error("Production PostgreSQL URL did not require TLS");
  if (!insecureReadiness.issues.some((issue) => issue.includes("REDIS_URL must use rediss"))) throw new Error("Production Redis URL did not require TLS");
  if (!insecureReadiness.issues.some((issue) => issue.includes("S3_ENDPOINT must use https"))) throw new Error("Production S3 endpoint did not require TLS");
  if (!insecureReadiness.issues.some((issue) => issue.includes("DOCUMENT_STORAGE_ENCRYPTION_KEY"))) throw new Error("Invalid document encryption key was accepted");
});

check("5. Unsupported provider names are rejected rather than trusted", () => {
  const issues: string[] = [];
  const configuration = resolveInfrastructureConfiguration(
    { APP_ENV: "production", APEX_DATABASE_ADAPTER: "mystery-db" },
    issues
  );
  if (configuration.database !== "memory") throw new Error("Unsupported database provider was accepted");
  if (!issues.some((issue) => issue.includes("APEX_DATABASE_ADAPTER"))) throw new Error("Unsupported provider did not produce a configuration issue");
});

check("6. Middleware blocks unready production traffic with canonical HTTP 503", () => {
  const middlewareSource = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf-8");
  if (!middlewareSource.includes("getInfrastructureReadiness")) throw new Error("Middleware does not consult infrastructure readiness");
  if (!middlewareSource.includes("INFRASTRUCTURE_NOT_READY")) throw new Error("Middleware does not expose the canonical infrastructure readiness error code");
  if (!middlewareSource.includes("status: 503")) throw new Error("Middleware does not fail closed with HTTP 503");
  if (/APEX_(ALLOW|BYPASS).*MEMORY/i.test(middlewareSource)) throw new Error("Middleware contains an environment-controlled memory bypass");
});

check("7. Environment template declares every Stage 4 provider and durable endpoint", () => {
  const envSource = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf-8");
  for (const key of [
    "APP_ENV",
    "APEX_DATABASE_ADAPTER",
    "APEX_SESSION_ADAPTER",
    "APEX_RATE_LIMIT_ADAPTER",
    "APEX_AUDIT_ADAPTER",
    "APEX_OBJECT_STORAGE_ADAPTER",
    "APEX_SEARCH_INDEX_ADAPTER",
    "DATABASE_URL",
    "REDIS_URL",
    "S3_BUCKET",
    "S3_REGION",
    "S3_ENDPOINT",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "DOCUMENT_STORAGE_ENCRYPTION_KEY",
  ]) {
    if (!envSource.includes(`${key}=`)) throw new Error(`.env.example is missing ${key}`);
  }
  if (!envSource.includes("sslmode=require")) throw new Error(".env.example does not document production PostgreSQL TLS requirement");
  if (!envSource.includes("rediss://")) throw new Error(".env.example does not document TLS-capable Redis configuration");
  if (!envSource.includes("AES-256-GCM")) throw new Error(".env.example does not document document-object encryption");
});

check("8. Stage 4F marks all six production authorities durable and ready", () => {
  const expected = {
    database: true,
    session: true,
    rateLimit: true,
    audit: true,
    objectStorage: true,
    searchIndex: true,
  } as const;
  for (const [authority, value] of Object.entries(expected)) {
    if (DURABLE_IMPLEMENTATION_STATUS[authority as keyof typeof DURABLE_IMPLEMENTATION_STATUS] !== value) {
      throw new Error(`${authority} durable status does not match Stage 4F composition scope`);
    }
  }
  if (!getInfrastructureReadiness(durableProductionEnv()).ready) throw new Error("Stage 4F durable production environment did not become ready");
});

check("9. PostgreSQL store has explicit durable construction and no process-global db singleton", () => {
  const storeSource = fs.readFileSync(path.join(process.cwd(), "lib/backend/database/store.ts"), "utf-8");
  const integrityFacadeSource = fs.readFileSync(
    path.join(process.cwd(), "lib/backend/database/adapters/postgres/PostgresIntegrityPersistence.ts"),
    "utf-8"
  );
  if (!storeSource.includes("PostgresIntegrityPersistence")) throw new Error("DatabaseStore does not compose the hardened PostgreSQL persistence facade");
  if (!integrityFacadeSource.includes("new PostgresPersistence")) throw new Error("PostgreSQL integrity facade is not backed by durable PostgresPersistence");
  if (!storeSource.includes("createPostgresStore")) throw new Error("DatabaseStore has no explicit PostgreSQL construction path");
  if (!storeSource.includes("intentionally NOT authoritative")) throw new Error("Compatibility Map authority is not explicitly constrained in PostgreSQL mode");
  if (!storeSource.includes("this.postgresPersistence.runInTransaction")) throw new Error("Unit of Work does not delegate to PostgreSQL transactions");
  if (/export\s+const\s+db\s*=/.test(storeSource)) throw new Error("Process-global db singleton still exists");
});

check("10. PostgreSQL migration and integration gate are committed as release artifacts", () => {
  for (const relative of [
    "lib/backend/database/migrations/001_stage4_postgres.sql",
    "lib/backend/database/migrations/002_stage4_document_search.sql",
    "scripts/runPostgresMigrations.ts",
    "scripts/runPostgresPersistenceTests.ts",
    "scripts/runPostgresSearchIndexTests.ts",
  ]) {
    if (!fs.existsSync(path.join(process.cwd(), relative))) throw new Error(`${relative} is missing`);
  }
});

check("11. Redis session/rate-limit composition and integration gate are committed", () => {
  const sessionSource = fs.readFileSync(path.join(process.cwd(), "lib/backend/domains/auth/authProvider.ts"), "utf-8");
  const limiterSource = fs.readFileSync(path.join(process.cwd(), "lib/backend/domains/auth/rateLimiter.ts"), "utf-8");
  const workflowSource = fs.readFileSync(path.join(process.cwd(), ".github/workflows/apex-one-ci.yml"), "utf-8");

  if (!sessionSource.includes("class RedisSessionStore")) throw new Error("RedisSessionStore is not implemented");
  if (!sessionSource.includes("createSessionStoreFromEnvironment")) throw new Error("Session provider factory is missing");
  if (/export\s+const\s+defaultSessionStore/.test(sessionSource)) throw new Error("Default session singleton still exists");
  if (!limiterSource.includes("class RedisRateLimiter")) throw new Error("RedisRateLimiter is not implemented");
  if (!limiterSource.includes("createRateLimiterFromEnvironment")) throw new Error("Rate-limit provider factory is missing");
  if (/export\s+const\s+defaultAuthRateLimiter/.test(limiterSource)) throw new Error("Default rate-limit singleton still exists");
  if (!workflowSource.includes("Redis Authentication State Integration") || !workflowSource.includes("bun run test:redis")) {
    throw new Error("CI does not execute the Redis integration gate");
  }
});

check("12. S3 document storage, encryption, compensation, and integration gate are committed", () => {
  const storageSource = fs.readFileSync(path.join(process.cwd(), "lib/backend/domains/documents/documentStorage.ts"), "utf-8");
  const serviceSource = fs.readFileSync(path.join(process.cwd(), "lib/backend/domains/documents/documentService.ts"), "utf-8");
  const workflowSource = fs.readFileSync(path.join(process.cwd(), ".github/workflows/apex-one-ci.yml"), "utf-8");

  if (!storageSource.includes("class S3CompatibleObjectStorageService")) throw new Error("S3-compatible object storage adapter is missing");
  if (!storageSource.includes("aes-256-gcm")) throw new Error("Document object encryption is not AES-256-GCM");
  if (/export\s+const\s+objectStorageService/.test(storageSource)) throw new Error("Default object-storage singleton still exists");
  if (!serviceSource.includes("document_storage:upload_cleanup_pending")) throw new Error("Upload compensation outbox is missing");
  if (!serviceSource.includes("retryPendingStorageOperations")) throw new Error("Durable storage retry drain is missing");
  if (!workflowSource.includes("S3 Document Storage Integration") || !workflowSource.includes("bun run test:s3")) {
    throw new Error("CI does not execute the S3 integration gate");
  }
});

check("13. PostgreSQL search authority and integration gate are committed without a default singleton", () => {
  const searchSource = fs.readFileSync(path.join(process.cwd(), "lib/backend/domains/documents/documentSearchIndex.ts"), "utf-8");
  const workflowSource = fs.readFileSync(path.join(process.cwd(), ".github/workflows/apex-one-ci.yml"), "utf-8");
  if (!searchSource.includes("class PostgresDocumentSearchIndex")) throw new Error("PostgreSQL document search adapter is missing");
  if (!searchSource.includes("createDocumentSearchIndexFromEnvironment")) throw new Error("Search provider factory is missing");
  if (/export\s+const\s+documentSearchIndex/.test(searchSource)) throw new Error("Default search-index singleton still exists");
  if (!workflowSource.includes("PostgreSQL Document Search Integration") || !workflowSource.includes("bun run test:search")) {
    throw new Error("CI does not execute the PostgreSQL search integration gate");
  }
});

check("14. Stage 4F production composition root and dedicated CI gate are committed", () => {
  const compositionPath = path.join(process.cwd(), "lib/backend/infrastructure/composition.ts");
  const compositionTestPath = path.join(process.cwd(), "scripts/runProductionCompositionTests.ts");
  if (!fs.existsSync(compositionPath)) throw new Error("Production composition root is missing");
  if (!fs.existsSync(compositionTestPath)) throw new Error("Production composition verification script is missing");

  const compositionSource = fs.readFileSync(compositionPath, "utf-8");
  const workflowSource = fs.readFileSync(path.join(process.cwd(), ".github/workflows/apex-one-ci.yml"), "utf-8");
  for (const marker of [
    "createDatabaseStoreFromEnvironment",
    "createAuditRepositoryFromEnvironment",
    "createSessionStoreFromEnvironment",
    "createRateLimiterFromEnvironment",
    "createObjectStorageFromEnvironment",
    "createDocumentSearchIndexFromEnvironment",
    "assertProductionProviderTypes",
  ]) {
    if (!compositionSource.includes(marker)) throw new Error(`Composition root is missing ${marker}`);
  }
  if (!workflowSource.includes("Production Composition Root") || !workflowSource.includes("bun run test:composition")) {
    throw new Error("CI does not execute the Stage 4F production composition gate");
  }
});

const failed = results.filter((result) => !result.passed);
console.log("================================================================================");
console.log("APEX ONE — STAGE 4 INFRASTRUCTURE BOUNDARY CHECK");
console.log("================================================================================");
for (const result of results) {
  console.log(`${result.passed ? "✅ [PASS]" : "❌ [FAIL]"} ${result.name}`);
  if (result.error) console.log(`    ↳ ${result.error}`);
}
console.log("--------------------------------------------------------------------------------");
console.log(`TOTAL: ${results.length} | PASSED: ${results.length - failed.length} | FAILED: ${failed.length}`);
console.log("================================================================================");

if (failed.length > 0) process.exit(1);
