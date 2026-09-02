/**
 * APEX ONE — Stage 4 production infrastructure boundary.
 *
 * This module is deliberately dependency-free so it can be consumed from
 * Next.js middleware as well as the Node.js backend. Environment variables
 * may select a durable provider, but readiness is granted only when the
 * corresponding adapter is actually implemented and wired in code.
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
 * Code-owned implementation truth. Environment variables cannot override this.
 * Each flag must be changed to true only in the slice that lands and wires the
 * corresponding durable adapter.
 */
export const DURABLE_IMPLEMENTATION_STATUS: Readonly<Record<InfrastructureAuthority, boolean>> =
  Object.freeze({
    database: false,
    session: false,
    rateLimit: false,
    audit: false,
    objectStorage: false,
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
  }

  if (configuration.session === "redis" || configuration.rateLimit === "redis") {
    requireValue(env, "REDIS_URL", issues);
  }

  if (configuration.objectStorage === "s3") {
    requireValue(env, "S3_BUCKET", issues);
    requireValue(env, "S3_REGION", issues);
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
