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
    REDIS_URL: "redis://example.invalid:6379/0",
    S3_BUCKET: "apex-production-documents",
    S3_REGION: "eu-west-1",
  };
}

check("1. Non-production defaults remain explicit in-memory test/development adapters", () => {
  const configuration = resolveInfrastructureConfiguration({ APP_ENV: "development" });
  for (const [authority, provider] of Object.entries(configuration)) {
    if (provider !== "memory") {
      throw new Error(`${authority} unexpectedly defaulted to '${provider}' outside production`);
    }
  }
});

check("2. Production with missing adapter configuration fails closed", () => {
  const readiness = getInfrastructureReadiness({ APP_ENV: "production" });
  if (readiness.ready) throw new Error("Production was marked ready with in-memory defaults");
  const requiredAuthorities = ["database", "session", "rateLimit", "audit", "objectStorage", "searchIndex"];
  for (const authority of requiredAuthorities) {
    if (!readiness.issues.some((issue) => issue.includes(authority))) {
      throw new Error(`Missing production readiness issue for ${authority}`);
    }
  }
});

check("3. Durable provider selection cannot bypass authorities that remain unimplemented", () => {
  const readiness = getInfrastructureReadiness(durableProductionEnv());
  if (readiness.ready) {
    throw new Error("Production became ready before all Stage 4 durable adapters were implemented and wired");
  }
  for (const [authority, implemented] of Object.entries(DURABLE_IMPLEMENTATION_STATUS)) {
    const hasImplementationIssue = readiness.issues.some((issue) => issue.includes(`${authority} durable adapter`));
    if (implemented && hasImplementationIssue) {
      throw new Error(`${authority} is implemented but readiness still reports it missing`);
    }
    if (!implemented && !hasImplementationIssue) {
      throw new Error(`Missing code-owned implementation gate for ${authority}`);
    }
  }
});

check("4. Production durable providers require their connection metadata and PostgreSQL TLS", () => {
  const env = durableProductionEnv();
  delete env.DATABASE_URL;
  delete env.REDIS_URL;
  delete env.S3_BUCKET;
  delete env.S3_REGION;
  const readiness = getInfrastructureReadiness(env);
  for (const key of ["DATABASE_URL", "REDIS_URL", "S3_BUCKET", "S3_REGION"]) {
    if (!readiness.issues.some((issue) => issue.includes(key))) {
      throw new Error(`Missing required infrastructure variable check for ${key}`);
    }
  }

  const insecure = durableProductionEnv();
  insecure.DATABASE_URL = "postgres://db.example/apex?sslmode=disable";
  const insecureReadiness = getInfrastructureReadiness(insecure);
  if (!insecureReadiness.issues.some((issue) => issue.includes("sslmode=require"))) {
    throw new Error("Production PostgreSQL URL did not require TLS");
  }
});

check("5. Unsupported provider names are rejected rather than trusted", () => {
  const issues: string[] = [];
  const configuration = resolveInfrastructureConfiguration(
    { APP_ENV: "production", APEX_DATABASE_ADAPTER: "mystery-db" },
    issues
  );
  if (configuration.database !== "memory") throw new Error("Unsupported database provider was accepted");
  if (!issues.some((issue) => issue.includes("APEX_DATABASE_ADAPTER"))) {
    throw new Error("Unsupported provider did not produce a configuration issue");
  }
});

check("6. Middleware blocks production traffic with canonical HTTP 503 before incomplete infrastructure", () => {
  const middlewareSource = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf-8");
  if (!middlewareSource.includes("getInfrastructureReadiness")) throw new Error("Middleware does not consult infrastructure readiness");
  if (!middlewareSource.includes("INFRASTRUCTURE_NOT_READY")) throw new Error("Middleware does not expose the canonical infrastructure readiness error code");
  if (!middlewareSource.includes("status: 503")) throw new Error("Middleware does not fail closed with HTTP 503");
  if (/APEX_(ALLOW|BYPASS).*MEMORY/i.test(middlewareSource)) throw new Error("Middleware contains an environment-controlled memory bypass");
});

check("7. Environment template declares every Stage 4 provider and durable endpoint", () => {
  const envSource = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf-8");
  const requiredKeys = [
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
  ];
  for (const key of requiredKeys) {
    if (!envSource.includes(`${key}=`)) throw new Error(`.env.example is missing ${key}`);
  }
  if (!envSource.includes("sslmode=require")) {
    throw new Error(".env.example does not document production PostgreSQL TLS requirement");
  }
  if (!envSource.includes("rediss://")) {
    throw new Error(".env.example does not document TLS-capable Redis configuration");
  }
});

check("8. Stage 4C marks database, audit, session, and rate-limit authorities as durable", () => {
  const expected = {
    database: true,
    session: true,
    rateLimit: true,
    audit: true,
    objectStorage: false,
    searchIndex: false,
  };
  for (const [authority, value] of Object.entries(expected)) {
    if (DURABLE_IMPLEMENTATION_STATUS[authority as keyof typeof DURABLE_IMPLEMENTATION_STATUS] !== value) {
      throw new Error(`${authority} durable status does not match Stage 4C scope`);
    }
  }
  if (getInfrastructureReadiness(durableProductionEnv()).ready) {
    throw new Error("Stage 4C incorrectly made the entire Stage 4 production stack ready");
  }
});

check("9. PostgreSQL store composition exists and production Maps are documented as non-authoritative", () => {
  const storeSource = fs.readFileSync(path.join(process.cwd(), "lib/backend/database/store.ts"), "utf-8");
  if (!storeSource.includes("PostgresPersistence")) throw new Error("DatabaseStore does not compose PostgreSQL persistence");
  if (!storeSource.includes("createPostgresStore")) throw new Error("DatabaseStore has no explicit PostgreSQL construction path");
  if (!storeSource.includes("intentionally NOT authoritative")) throw new Error("Compatibility Map authority is not explicitly constrained in PostgreSQL mode");
  if (!storeSource.includes("this.postgresPersistence.runInTransaction")) throw new Error("Unit of Work does not delegate to PostgreSQL transactions");
});

check("10. PostgreSQL migration and integration gate are committed as release artifacts", () => {
  for (const relative of [
    "lib/backend/database/migrations/001_stage4_postgres.sql",
    "scripts/runPostgresMigrations.ts",
    "scripts/runPostgresPersistenceTests.ts",
  ]) {
    if (!fs.existsSync(path.join(process.cwd(), relative))) throw new Error(`${relative} is missing`);
  }
});

check("11. Redis session/rate-limit composition and integration gate are committed", () => {
  for (const relative of [
    "lib/backend/infrastructure/redis/RedisWireClient.ts",
    "scripts/runRedisAuthStateTests.ts",
  ]) {
    if (!fs.existsSync(path.join(process.cwd(), relative))) throw new Error(`${relative} is missing`);
  }

  const sessionSource = fs.readFileSync(
    path.join(process.cwd(), "lib/backend/domains/auth/authProvider.ts"),
    "utf-8"
  );
  const limiterSource = fs.readFileSync(
    path.join(process.cwd(), "lib/backend/domains/auth/rateLimiter.ts"),
    "utf-8"
  );
  const workflowSource = fs.readFileSync(
    path.join(process.cwd(), ".github/workflows/apex-one-ci.yml"),
    "utf-8"
  );

  if (!sessionSource.includes("class RedisSessionStore")) throw new Error("RedisSessionStore is not implemented");
  if (!sessionSource.includes("createSessionStoreFromEnvironment")) throw new Error("Session provider composition is not environment-aware");
  if (!sessionSource.includes("createHash(\"sha256\")")) throw new Error("Redis sessions do not hash opaque token/index material");
  if (!limiterSource.includes("class RedisRateLimiter")) throw new Error("RedisRateLimiter is not implemented");
  if (!limiterSource.includes("createRateLimiterFromEnvironment")) throw new Error("Rate-limit provider composition is not environment-aware");
  if (!workflowSource.includes("Redis Authentication State Integration")) throw new Error("CI does not run the real Redis integration gate");
  if (!workflowSource.includes("bun run test:redis")) throw new Error("CI does not execute the Redis auth-state test command");
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
