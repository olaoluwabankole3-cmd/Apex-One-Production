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

export type ActiveReadinessState = "ready" | "unavailable" | "not_required";

export interface ActiveReadinessCheck {
  authority: InfrastructureAuthority;
  state: ActiveReadinessState;
}

export interface ProductionReadinessReport {
  status: "ready" | "not_ready";
  production: boolean;
  configuration: InfrastructureConfiguration;
  checks: ActiveReadinessCheck[];
  unavailableAuthorities: InfrastructureAuthority[];
  configurationIssueCount: number;
  checkedAt: string;
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

  // A readiness check must prove the configured bucket is both reachable and
  // usable with the configured encryption authority. The probe is isolated
  // under a system-only prefix and is deleted before the request completes.
  const key = `system/readiness/${randomUUID()}.json`;
  try {
    await storage.putObject(key, "{\"apexReadiness\":true}", "application/json");
    const object = await storage.getObject(key);
    if (!object) throw new Error("Object-storage readiness probe could not read its write");
  } finally {
    try {
      await storage.deleteObject(key);
    } catch {
      // Preserve the original probe outcome; cleanup failures are surfaced by a
      // subsequent readiness probe and by the storage integration gate.
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
  if (!requiredByConfiguration) return { authority, state: "not_required" };
  try {
    await withTimeout(authority, probe());
    return { authority, state: "ready" };
  } catch {
    return { authority, state: "unavailable" };
  }
}

/**
 * Stage 10 black-box readiness authority.
 *
 * Configuration readiness alone is insufficient: this report actively proves
 * the durable database, Redis, S3-compatible object storage, and PostgreSQL
 * search authorities can be reached. Raw connection errors and credentials are
 * deliberately never returned to callers.
 */
export async function getProductionReadinessReport(
  env: InfrastructureEnvironment = process.env
): Promise<ProductionReadinessReport> {
  const staticReadiness = getInfrastructureReadiness(env);
  const configuration = staticReadiness.configuration;

  const databaseRequired = configuration.database === "postgres" || configuration.audit === "postgres";
  const redisRequired = configuration.session === "redis" || configuration.rateLimit === "redis";
  const objectStorageRequired = configuration.objectStorage === "s3";
  const searchRequired = configuration.searchIndex === "postgres";

  const database = await check("database", databaseRequired, () => probeDatabase(env));
  const redis = await check("session", redisRequired, () => probeRedis(env));
  const rateLimit: ActiveReadinessCheck = {
    authority: "rateLimit",
    state: redisRequired ? redis.state : "not_required",
  };
  const audit: ActiveReadinessCheck = {
    authority: "audit",
    state: databaseRequired ? database.state : "not_required",
  };
  const objectStorage = await check("objectStorage", objectStorageRequired, () => probeObjectStorage(env));
  const searchIndex = await check("searchIndex", searchRequired, () => probeSearchIndex(env));

  const checks = [database, redis, rateLimit, audit, objectStorage, searchIndex];
  const unavailableAuthorities = checks
    .filter((item) => item.state === "unavailable")
    .map((item) => item.authority);

  const ready = staticReadiness.ready && unavailableAuthorities.length === 0;
  return {
    status: ready ? "ready" : "not_ready",
    production: staticReadiness.production,
    configuration,
    checks,
    unavailableAuthorities,
    configurationIssueCount: staticReadiness.issues.length,
    checkedAt: new Date().toISOString(),
  };
}
