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
    DATABASE_URL: "postgres://example.invalid/apex",
    REDIS_URL: "redis://example.invalid:6379",
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

check("3. Durable provider selection alone cannot bypass missing implementations", () => {
  const readiness = getInfrastructureReadiness(durableProductionEnv());
  if (readiness.ready) {
    throw new Error("Production became ready before durable adapters were implemented and wired");
  }
  for (const [authority, implemented] of Object.entries(DURABLE_IMPLEMENTATION_STATUS)) {
    if (implemented) continue;
    if (!readiness.issues.some((issue) => issue.includes(`${authority} durable adapter`))) {
      throw new Error(`Missing code-owned implementation gate for ${authority}`);
    }
  }
});

check("4. Production durable providers require their connection metadata", () => {
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
});

check("5. Unsupported provider names are rejected rather than trusted", () => {
  const issues: string[] = [];
  const configuration = resolveInfrastructureConfiguration(
    { APP_ENV: "production", APEX_DATABASE_ADAPTER: "mystery-db" },
    issues
  );
  if (configuration.database !== "memory") {
    throw new Error("Unsupported database provider was accepted");
  }
  if (!issues.some((issue) => issue.includes("APEX_DATABASE_ADAPTER"))) {
    throw new Error("Unsupported provider did not produce a configuration issue");
  }
});

check("6. Middleware blocks production traffic with canonical HTTP 503 before memory state", () => {
  const middlewareSource = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf-8");
  if (!middlewareSource.includes("getInfrastructureReadiness")) {
    throw new Error("Middleware does not consult infrastructure readiness");
  }
  if (!middlewareSource.includes("INFRASTRUCTURE_NOT_READY")) {
    throw new Error("Middleware does not expose the canonical infrastructure readiness error code");
  }
  if (!middlewareSource.includes("status: 503")) {
    throw new Error("Middleware does not fail closed with HTTP 503");
  }
  if (/APEX_(ALLOW|BYPASS).*MEMORY/i.test(middlewareSource)) {
    throw new Error("Middleware contains an environment-controlled memory bypass");
  }
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
    if (!envSource.includes(`${key}=`)) {
      throw new Error(`.env.example is missing ${key}`);
    }
  }
});

check("8. Code-owned durable readiness cannot be enabled by configuration alone", () => {
  const statusValues = Object.values(DURABLE_IMPLEMENTATION_STATUS);
  if (statusValues.length !== 6) throw new Error("Stage 4 implementation status does not cover all six authorities");
  if (statusValues.some(Boolean)) {
    throw new Error("Stage 4A must not claim a durable implementation before concrete adapters land");
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
