/**
 * APEX ONE — Stage 4 production infrastructure boundary.
 *
 * Environment variables may select providers, but readiness is granted only
 * when the corresponding durable adapter is actually implemented and wired.
 */

export type InfrastructureAuthority =
  | "database"
  | "session"
  | "rateLimit"
  | "audit"
  | "objectStorage"
  | "searchIndex";

export type DatabaseProvider = "memory" | "postgres";
export type SessionProvider = "memory" | "redis";
export type RateLimitProvider = "memory" | "redis";
export type AuditProvider = "memory" | "postgres";
export type ObjectStorageProvider = "memory" | "s3";
export type SearchIndexProvider = "memory" | "postgres";

export interface InfrastructureEnvironment {
  APP_ENV?: string;
  APEX_DATABASE_ADAPTER?: string;
  APEX_SESSION_ADAPTER?: string;
  APEX_RATE_LIMIT_ADAPTER?: string;
  APEX_AUDIT_ADAPTER?: string;
  APEX_OBJECT_STORAGE_ADAPTER?: string;
  APEX_SEARCH_INDEX_ADAPTER?: string;
  DATABASE_URL?: string;
  REDIS_URL?: string;
  S3_BUCKET?: string;
  S3_REGION?: string;
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  DOCUMENT_STORAGE_ENCRYPTION_KEY?: string;
  [key: string]: string | undefined;
}

export interface InfrastructureConfiguration {
  database: DatabaseProvider;
  session: SessionProvider;
  rateLimit: RateLimitProvider;
  audit: AuditProvider;
  objectStorage: ObjectStorageProvider;
  searchIndex: SearchIndexProvider;
}

export interface InfrastructureReadiness {
  production: boolean;
  ready: boolean;
  configuration: InfrastructureConfiguration;
  issues: string[];
}

const DURABLE_PROVIDER_REQUIREMENTS: Readonly<InfrastructureConfiguration> = Object.freeze({
  database: "postgres",
  session: "redis",
  rateLimit: "redis",
  audit: "postgres",
  objectStorage: "s3",
  searchIndex: "postgres",
});

/**
 * Code-owned implementation truth. Configuration cannot override these flags.
 * Stage 4D adds encrypted S3-compatible document object storage to the durable
 * PostgreSQL and Redis authorities delivered in 4B/4C.
 */
export const DURABLE_IMPLEMENTATION_STATUS: Readonly<Record<InfrastructureAuthority, boolean>> =
  Object.freeze({
    database: true,
    session: true,
    rateLimit: true,
    audit: true,
    objectStorage: true,
    searchIndex: false,
  });

function normalize(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function provider<T extends string>(
  rawValue: string | undefined,
  allowed: readonly T[],
  fallback: T,
  variableName: string,
  issues: string[]
): T {
  const value = normalize(rawValue);
  if (!value) return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  issues.push(`${variableName} selects unsupported provider '${value}'`);
  return fallback;
}

export function isProductionInfrastructureEnvironment(
  env: InfrastructureEnvironment = process.env
): boolean {
  return normalize(env.APP_ENV) === "production";
}

export function resolveInfrastructureConfiguration(
  env: InfrastructureEnvironment = process.env,
  issues: string[] = []
): InfrastructureConfiguration {
  return {
    database: provider(env.APEX_DATABASE_ADAPTER, ["memory", "postgres"], "memory", "APEX_DATABASE_ADAPTER", issues),
    session: provider(env.APEX_SESSION_ADAPTER, ["memory", "redis"], "memory", "APEX_SESSION_ADAPTER", issues),
    rateLimit: provider(env.APEX_RATE_LIMIT_ADAPTER, ["memory", "redis"], "memory", "APEX_RATE_LIMIT_ADAPTER", issues),
    audit: provider(env.APEX_AUDIT_ADAPTER, ["memory", "postgres"], "memory", "APEX_AUDIT_ADAPTER", issues),
    objectStorage: provider(env.APEX_OBJECT_STORAGE_ADAPTER, ["memory", "s3"], "memory", "APEX_OBJECT_STORAGE_ADAPTER", issues),
    searchIndex: provider(env.APEX_SEARCH_INDEX_ADAPTER, ["memory", "postgres"], "memory", "APEX_SEARCH_INDEX_ADAPTER", issues),
  };
}

function requireValue(
  env: InfrastructureEnvironment,
  key: keyof InfrastructureEnvironment,
  issues: string[]
): void {
  const value = env[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${String(key)} is required for the selected durable infrastructure`);
  }
}

function requireProductionPostgresTls(databaseUrl: string | undefined, issues: string[]): void {
  if (!databaseUrl?.trim()) return;
  try {
    const url = new URL(databaseUrl);
    const sslMode = (url.searchParams.get("sslmode") || "").toLowerCase();
    if (sslMode !== "require" && sslMode !== "verify-full") {
      issues.push("DATABASE_URL must set sslmode=require or sslmode=verify-full in production");
    }
  } catch {
    issues.push("DATABASE_URL must be a valid PostgreSQL URL");
  }
}

function requireProductionS3Tls(endpoint: string | undefined, issues: string[]): void {
  if (!endpoint?.trim()) return;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") {
      issues.push("S3_ENDPOINT must use https:// in production");
    }
  } catch {
    issues.push("S3_ENDPOINT must be a valid HTTP(S) URL");
  }
}

function requireDocumentEncryptionKey(value: string | undefined, issues: string[]): void {
  if (!value?.trim()) return;
  const normalized = value.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    issues.push("DOCUMENT_STORAGE_ENCRYPTION_KEY must be base64 encoded");
    return;
  }
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== normalized) {
    issues.push("DOCUMENT_STORAGE_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
}

export function getInfrastructureReadiness(
  env: InfrastructureEnvironment = process.env
): InfrastructureReadiness {
  const issues: string[] = [];
  const production = isProductionInfrastructureEnvironment(env);
  const configuration = resolveInfrastructureConfiguration(env, issues);

  if (!production) {
    return { production, ready: issues.length === 0, configuration, issues };
  }

  for (const authority of Object.keys(DURABLE_PROVIDER_REQUIREMENTS) as InfrastructureAuthority[]) {
    const expected = DURABLE_PROVIDER_REQUIREMENTS[authority];
    const actual = configuration[authority];
    if (actual !== expected) {
      issues.push(`${authority} must use durable provider '${expected}' in production`);
    }
    if (!DURABLE_IMPLEMENTATION_STATUS[authority]) {
      issues.push(`${authority} durable adapter is not yet implemented and wired`);
    }
  }

  if (
    configuration.database === "postgres" ||
    configuration.audit === "postgres" ||
    configuration.searchIndex === "postgres"
  ) {
    requireValue(env, "DATABASE_URL", issues);
    requireProductionPostgresTls(env.DATABASE_URL, issues);
  }

  if (configuration.session === "redis" || configuration.rateLimit === "redis") {
    requireValue(env, "REDIS_URL", issues);
  }

  if (configuration.objectStorage === "s3") {
    requireValue(env, "S3_BUCKET", issues);
    requireValue(env, "S3_REGION", issues);
    requireValue(env, "S3_ACCESS_KEY_ID", issues);
    requireValue(env, "S3_SECRET_ACCESS_KEY", issues);
    requireValue(env, "DOCUMENT_STORAGE_ENCRYPTION_KEY", issues);
    requireProductionS3Tls(env.S3_ENDPOINT, issues);
    requireDocumentEncryptionKey(env.DOCUMENT_STORAGE_ENCRYPTION_KEY, issues);
  }

  return {
    production,
    ready: issues.length === 0,
    configuration,
    issues,
  };
}

export function assertProductionInfrastructureReady(
  env: InfrastructureEnvironment = process.env
): InfrastructureReadiness {
  const readiness = getInfrastructureReadiness(env);
  if (readiness.production && !readiness.ready) {
    throw new Error(
      "Production infrastructure is not ready. Durable database, session, rate-limit, audit, object-storage, and search-index adapters must be configured and wired before serving production traffic."
    );
  }
  return readiness;
}
