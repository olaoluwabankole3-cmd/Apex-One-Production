/**
 * APEX ONE — Stage 4F production composition-root verification.
 *
 * No network calls are required: the durable adapters are constructed with
 * inert endpoints and are inspected before any I/O method is invoked.
 */

import * as fs from "fs";
import * as path from "path";
import { DatabaseStore } from "../lib/backend/database/store";
import { PostgresAuditLogRepository } from "../lib/backend/database/adapters/postgres/PostgresPersistence";
import {
  createApplicationInfrastructure,
  createDatabaseStoreFromEnvironment,
} from "../lib/backend/infrastructure/composition";
import {
  DURABLE_IMPLEMENTATION_STATUS,
  getInfrastructureReadiness,
  type InfrastructureEnvironment,
} from "../lib/backend/infrastructure/runtime";
import {
  createSessionStoreFromEnvironment,
  InMemorySessionStore,
  RedisSessionStore,
} from "../lib/backend/domains/auth/authProvider";
import {
  createRateLimiterFromEnvironment,
  InMemoryRateLimiter,
  RedisRateLimiter,
} from "../lib/backend/domains/auth/rateLimiter";
import {
  createObjectStorageFromEnvironment,
  InMemoryObjectStorageAdapter,
  S3CompatibleObjectStorageService,
} from "../lib/backend/domains/documents/documentStorage";
import {
  createDocumentSearchIndexFromEnvironment,
  InMemoryDocumentIndexAdapter,
  PostgresDocumentSearchIndex,
} from "../lib/backend/domains/documents/documentSearchIndex";

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
    results.push({ name, passed: false, error: error?.stack || error?.message || String(error) });
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
    DATABASE_URL: "postgres://apex:placeholder@db.example.invalid:5432/apex?sslmode=require",
    REDIS_URL: "rediss://redis.example.invalid:6380/0",
    S3_BUCKET: "apex-production-documents",
    S3_REGION: "eu-west-1",
    S3_ENDPOINT: "https://s3.example.invalid",
    S3_ACCESS_KEY_ID: "placeholder-access-key",
    S3_SECRET_ACCESS_KEY: "placeholder-secret-key",
    DOCUMENT_STORAGE_ENCRYPTION_KEY: "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=",
  };
}

function expectThrow(fn: () => unknown, label: string): void {
  let rejected = false;
  try {
    fn();
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(`${label} did not fail closed`);
}

function walkTypeScriptFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkTypeScriptFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(absolute);
  }
  return files;
}

check("1. Fully durable production configuration is code-owned ready", () => {
  const readiness = getInfrastructureReadiness(durableProductionEnv());
  if (!readiness.ready) throw new Error(`Production readiness failed: ${readiness.issues.join("; ")}`);
  for (const [authority, implemented] of Object.entries(DURABLE_IMPLEMENTATION_STATUS)) {
    if (!implemented) throw new Error(`${authority} code-owned readiness flag is false`);
  }
});

check("2. Production composition resolves PostgreSQL database and PostgreSQL audit authority", () => {
  const infrastructure = createApplicationInfrastructure(durableProductionEnv());
  if (!infrastructure.database.isPostgresBacked()) throw new Error("Production database is not PostgreSQL-backed");
  if (!(infrastructure.auditRepository instanceof PostgresAuditLogRepository)) {
    throw new Error("Production audit repository is not PostgresAuditLogRepository");
  }
  if (infrastructure.auditRepository !== infrastructure.database.auditLogsRepo) {
    throw new Error("Audit repository is not the same PostgreSQL authority used by DatabaseStore transactions");
  }
});

check("3. Production composition resolves Redis session and rate-limit authorities", () => {
  const infrastructure = createApplicationInfrastructure(durableProductionEnv());
  if (!(infrastructure.sessionStore instanceof RedisSessionStore)) throw new Error("Production sessions are not Redis-backed");
  if (!(infrastructure.rateLimiter instanceof RedisRateLimiter)) throw new Error("Production rate limiting is not Redis-backed");
});

check("4. Production composition resolves encrypted S3-compatible object storage", () => {
  const infrastructure = createApplicationInfrastructure(durableProductionEnv());
  if (!(infrastructure.objectStorage instanceof S3CompatibleObjectStorageService)) {
    throw new Error("Production object storage is not S3-compatible durable storage");
  }
});

check("5. Production composition resolves PostgreSQL document search", () => {
  const infrastructure = createApplicationInfrastructure(durableProductionEnv());
  if (!(infrastructure.searchIndex instanceof PostgresDocumentSearchIndex)) {
    throw new Error("Production search index is not PostgreSQL-backed");
  }
});

check("6. Provider factories cannot be used to obtain memory authorities in production", () => {
  expectThrow(
    () => createDatabaseStoreFromEnvironment({ APP_ENV: "production", APEX_DATABASE_ADAPTER: "memory" }),
    "Production memory database"
  );
  expectThrow(
    () => createSessionStoreFromEnvironment({ APP_ENV: "production", APEX_SESSION_ADAPTER: "memory" }),
    "Production memory session store"
  );
  expectThrow(
    () => createRateLimiterFromEnvironment({ APP_ENV: "production", APEX_RATE_LIMIT_ADAPTER: "memory" }),
    "Production memory rate limiter"
  );
  expectThrow(
    () => createObjectStorageFromEnvironment({ APP_ENV: "production", APEX_OBJECT_STORAGE_ADAPTER: "memory" }),
    "Production memory object storage"
  );
  expectThrow(
    () => createDocumentSearchIndexFromEnvironment({ APP_ENV: "production", APEX_SEARCH_INDEX_ADAPTER: "memory" }),
    "Production memory search index"
  );
});

check("7. Production composition rejects a single memory-provider downgrade", () => {
  const env = durableProductionEnv();
  env.APEX_SESSION_ADAPTER = "memory";
  expectThrow(() => createApplicationInfrastructure(env), "Production composition with memory session provider");
});

check("8. Production composition rejects incomplete/TLS-insecure durable configuration", () => {
  const missing = durableProductionEnv();
  delete missing.REDIS_URL;
  expectThrow(() => createApplicationInfrastructure(missing), "Production composition missing REDIS_URL");

  const insecure = durableProductionEnv();
  insecure.REDIS_URL = "redis://redis.example.invalid:6379/0";
  expectThrow(() => createApplicationInfrastructure(insecure), "Production composition with insecure Redis URL");
});

check("9. Local development defaults remain in-memory across all six authorities", () => {
  const infrastructure = createApplicationInfrastructure({ APP_ENV: "development" });
  if (infrastructure.database.isPostgresBacked()) throw new Error("Local database unexpectedly resolved PostgreSQL");
  if (!(infrastructure.sessionStore instanceof InMemorySessionStore)) throw new Error("Local sessions are not in memory");
  if (!(infrastructure.rateLimiter instanceof InMemoryRateLimiter)) throw new Error("Local rate limiter is not in memory");
  if (!(infrastructure.objectStorage instanceof InMemoryObjectStorageAdapter)) throw new Error("Local object storage is not in memory");
  if (!(infrastructure.searchIndex instanceof InMemoryDocumentIndexAdapter)) throw new Error("Local search is not in memory");
  if (infrastructure.auditRepository !== infrastructure.database.auditLogsRepo) {
    throw new Error("Local audit authority is not owned by the local DatabaseStore");
  }
});

check("10. Composition factories return instances instead of process-global infrastructure singletons", () => {
  const env = durableProductionEnv();
  const first = createApplicationInfrastructure(env);
  const second = createApplicationInfrastructure(env);
  if (first === second) throw new Error("Composition root returned a process-global infrastructure object");
  if (first.database === second.database) throw new Error("Database provider factory returned the same process-global instance");
  if (first.sessionStore === second.sessionStore) throw new Error("Session provider factory returned the same process-global instance");
  if (first.rateLimiter === second.rateLimiter) throw new Error("Rate-limit provider factory returned the same process-global instance");
  if (first.objectStorage === second.objectStorage) throw new Error("Object-storage provider factory returned the same process-global instance");
  if (first.searchIndex === second.searchIndex) throw new Error("Search provider factory returned the same process-global instance");
});

check("11. DatabaseStore itself blocks implicit memory construction in a real production process", () => {
  const previousAppEnv = process.env.APP_ENV;
  const previousTestEnv = process.env.TEST_ENV;
  try {
    process.env.APP_ENV = "production";
    delete process.env.TEST_ENV;
    expectThrow(() => new DatabaseStore(), "Implicit production memory DatabaseStore");
  } finally {
    if (previousAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previousAppEnv;
    if (previousTestEnv === undefined) delete process.env.TEST_ENV;
    else process.env.TEST_ENV = previousTestEnv;
  }
});

check("12. Legacy infrastructure singleton exports are absent from backend source", () => {
  const backendRoot = path.join(process.cwd(), "lib/backend");
  const forbidden = [
    /export\s+const\s+db\s*=/,
    /export\s+const\s+defaultSessionStore\s*=/,
    /export\s+const\s+defaultAuthRateLimiter\s*=/,
    /export\s+const\s+objectStorageService\s*=/,
    /export\s+const\s+documentSearchIndex\s*=/,
  ];
  for (const file of walkTypeScriptFiles(backendRoot)) {
    const source = fs.readFileSync(file, "utf-8");
    for (const pattern of forbidden) {
      if (pattern.test(source)) {
        throw new Error(`${path.relative(process.cwd(), file)} still exports a forbidden infrastructure singleton (${pattern})`);
      }
    }
  }
});

check("13. Domain source no longer imports legacy db/object/search/auth-state singleton authorities", () => {
  const domainRoot = path.join(process.cwd(), "lib/backend/domains");
  const forbiddenImports = [
    /import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*["'][^"']*database\/store["']/s,
    /import\s*\{[^}]*\bdefaultSessionStore\b[^}]*\}/s,
    /import\s*\{[^}]*\bdefaultAuthRateLimiter\b[^}]*\}/s,
    /import\s*\{[^}]*\bobjectStorageService\b[^}]*\}/s,
    /import\s*\{[^}]*\bdocumentSearchIndex\b[^}]*\}/s,
  ];
  for (const file of walkTypeScriptFiles(domainRoot)) {
    const source = fs.readFileSync(file, "utf-8");
    for (const pattern of forbiddenImports) {
      if (pattern.test(source)) {
        throw new Error(`${path.relative(process.cwd(), file)} still imports legacy singleton infrastructure (${pattern})`);
      }
    }
  }
});

const failed = results.filter((result) => !result.passed);
console.log("================================================================================");
console.log("APEX ONE — STAGE 4F PRODUCTION COMPOSITION ROOT");
console.log("================================================================================");
for (const result of results) {
  console.log(`${result.passed ? "✅ [PASS]" : "❌ [FAIL]"} ${result.name}`);
  if (result.error) console.log(`    ↳ ${result.error}`);
}
console.log("--------------------------------------------------------------------------------");
console.log(`TOTAL: ${results.length} | PASSED: ${results.length - failed.length} | FAILED: ${failed.length}`);
console.log("================================================================================");

if (failed.length > 0) process.exit(1);
