import { randomUUID } from "node:crypto";
import { PostgresConnectionManager } from "../database/adapters/postgres/PostgresPersistence";
import { RedisWireClient } from "./redis/RedisWireClient";
import {
  getInfrastructureReadiness,
  type InfrastructureAuthority,
  type InfrastructureConfiguration,
  type InfrastructureEnvironment,
} from "./runtime";
import { S3CompatibleObjectStorageService } from "../domains/documents/documentStorage";
import { PostgresDocumentSearchIndex } from "../domains/documents/documentSearchIndex";
import { getDurableAuditStatus } from "./auditDurability";
import {
  getProductionReleaseIdentityIssues,
  resolveReleaseIdentity,
  type ReleaseIdentity,
} from "./releaseIdentity";
import { getDeploymentTopologySummary } from "./deploymentTopology";
import { emitTelemetry } from "../observability/telemetry";

export type ActiveReadinessState = "ready" | "unavailable" | "not_required";

export interface ActiveReadinessCheck {
  authority: InfrastructureAuthority;
  state: ActiveReadinessState;
  durationMs: number;
}

export interface ProductionReadinessReport {
  status: "ready" | "not_ready";
  production: boolean;
  configuration: InfrastructureConfiguration;
  checks: ActiveReadinessCheck[];
  unavailableAuthorities: InfrastructureAuthority[];
  configurationIssueCount: number;
  release: ReleaseIdentity;
  topology: ReturnType<typeof getDeploymentTopologySummary>;
  checkedAt: string;
  probeDurationMs: number;
}

const PROBE_TIMEOUT_MS = 5_000;

async function withTimeout<T>(label: string, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} readiness probe timed out`)), PROBE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is unavailable for readiness probing`);
  return normalized;
}

async function probeDatabase(env: InfrastructureEnvironment): Promise<void> {
  const manager = new PostgresConnectionManager(required(env.DATABASE_URL, "DATABASE_URL"));
  await manager.withConnection(async (connection) => {
    await connection.query("SELECT 1 AS apex_readiness");
  });
}

async function probeAuditDurability(env: InfrastructureEnvironment): Promise<void> {
  const status = await getDurableAuditStatus(required(env.DATABASE_URL, "DATABASE_URL"));
  if (!status.appendOnlyTrigger || !status.requestCorrelationIndex) {
    throw new Error("Durable audit migration has not been applied");
  }
}

async function probeRedis(env: InfrastructureEnvironment): Promise<void> {
  const redis = new RedisWireClient(required(env.REDIS_URL, "REDIS_URL"));
  const reply = await redis.execute(["PING"]);
  if (reply !== "PONG") throw new Error("Redis readiness probe returned an unexpected response");
}

async function probeObjectStorage(env: InfrastructureEnvironment): Promise<void> {
  const storage = new S3CompatibleObjectStorageService({
    bucket: required(env.S3_BUCKET, "S3_BUCKET"),
    region: required(env.S3_REGION, "S3_REGION"),
    accessKeyId: required(env.S3_ACCESS_KEY_ID, "S3_ACCESS_KEY_ID"),
    secretAccessKey: required(env.S3_SECRET_ACCESS_KEY, "S3_SECRET_ACCESS_KEY"),
    encryptionKey: required(env.DOCUMENT_STORAGE_ENCRYPTION_KEY, "DOCUMENT_STORAGE_ENCRYPTION_KEY"),
    endpoint: env.S3_ENDPOINT?.trim() || undefined,
  });

  const key = `system/readiness/${randomUUID()}.json`;
  try {
    await storage.putObject(key, "{\"apexReadiness\":true}", "application/json");
    const object = await storage.getObject(key);
    if (!object) throw new Error("Object-storage readiness probe could not read its write");
  } finally {
    try {
      await storage.deleteObject(key);
    } catch {
      // Preserve the original probe outcome. A later probe will surface cleanup failure.
    }
  }
}

async function probeSearchIndex(env: InfrastructureEnvironment): Promise<void> {
  const search = new PostgresDocumentSearchIndex(required(env.DATABASE_URL, "DATABASE_URL"));
  await search.bootstrap();
  await search.search("__apex_readiness__", "readiness-probe");
}

async function check(
  authority: InfrastructureAuthority,
  requiredByConfiguration: boolean,
  probe: () => Promise<void>
): Promise<ActiveReadinessCheck> {
  if (!requiredByConfiguration) return { authority, state: "not_required", durationMs: 0 };
  const startedAt = Date.now();
  try {
    await withTimeout(authority, probe());
    return { authority, state: "ready", durationMs: Date.now() - startedAt };
  } catch {
    return { authority, state: "unavailable", durationMs: Date.now() - startedAt };
  }
}

/**
 * Stage 11 production readiness authority.
 *
 * It extends Stage 10 active dependency probing with:
 * - append-only audit durability verification,
 * - immutable release identity,
 * - deployment-topology identity,
 * - per-authority probe latency and structured telemetry.
 *
 * Raw connection errors, URLs, credentials, and exception text are deliberately
 * never returned to callers or emitted as telemetry attributes.
 */
export async function getProductionReadinessReport(
  env: InfrastructureEnvironment = process.env
): Promise<ProductionReadinessReport> {
  const startedAt = Date.now();
  const staticReadiness = getInfrastructureReadiness(env);
  const configuration = staticReadiness.configuration;
  const release = resolveReleaseIdentity(env);
  const releaseIssues = staticReadiness.production
    ? getProductionReleaseIdentityIssues(env)
    : [];

  const databaseRequired = configuration.database === "postgres";
  const redisRequired = configuration.session === "redis" || configuration.rateLimit === "redis";
  const auditRequired = configuration.audit === "postgres";
  const objectStorageRequired = configuration.objectStorage === "s3";
  const searchRequired = configuration.searchIndex === "postgres";

  const database = await check("database", databaseRequired, () => probeDatabase(env));
  const redis = await check("session", redisRequired, () => probeRedis(env));
  const rateLimit: ActiveReadinessCheck = {
    authority: "rateLimit",
    state: redisRequired ? redis.state : "not_required",
    durationMs: redis.durationMs,
  };
  const audit = await check("audit", auditRequired, () => probeAuditDurability(env));
  const objectStorage = await check("objectStorage", objectStorageRequired, () => probeObjectStorage(env));
  const searchIndex = await check("searchIndex", searchRequired, () => probeSearchIndex(env));

  const checks = [database, redis, rateLimit, audit, objectStorage, searchIndex];
  const unavailableAuthorities = checks
    .filter((item) => item.state === "unavailable")
    .map((item) => item.authority);

  const configurationIssueCount = staticReadiness.issues.length + releaseIssues.length;
  const ready =
    staticReadiness.ready &&
    configurationIssueCount === 0 &&
    unavailableAuthorities.length === 0;
  const probeDurationMs = Date.now() - startedAt;
  const report: ProductionReadinessReport = {
    status: ready ? "ready" : "not_ready",
    production: staticReadiness.production,
    configuration,
    checks,
    unavailableAuthorities,
    configurationIssueCount,
    release,
    topology: getDeploymentTopologySummary(),
    checkedAt: new Date().toISOString(),
    probeDurationMs,
  };

  emitTelemetry(
    "infrastructure.readiness",
    {
      level: ready ? "info" : "warn",
      outcome: ready ? "success" : "failure",
      durationMs: probeDurationMs,
      release,
      attributes: {
        production: staticReadiness.production,
        configurationIssueCount,
        unavailableAuthorities,
        checks: checks.map((item) => ({
          authority: item.authority,
          state: item.state,
          durationMs: item.durationMs,
        })),
      },
    },
    env
  );

  return report;
}
