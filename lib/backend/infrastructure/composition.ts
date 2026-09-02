/**
 * APEX ONE — Stage 4F application infrastructure composition root.
 *
 * This module is the only default application wiring point for persistence
 * authorities. Production composition is fail-closed and may never resolve an
 * in-memory database, audit repository, session store, rate limiter, object
 * store, or search index. Tests/local development retain explicit memory
 * adapters through the same provider factories.
 */

import { DatabaseStore } from "../database/store";
import type { IAuditLogRepository } from "../database/repository";
import { PostgresAuditLogRepository } from "../database/adapters/postgres/PostgresPersistence";
import {
  createSessionStoreFromEnvironment,
  InMemorySessionStore,
  RedisSessionStore,
  type ISessionStore,
} from "../domains/auth/authProvider";
import {
  createRateLimiterFromEnvironment,
  InMemoryRateLimiter,
  RedisRateLimiter,
  type IRateLimiter,
} from "../domains/auth/rateLimiter";
import {
  createObjectStorageFromEnvironment,
  InMemoryObjectStorageAdapter,
  S3CompatibleObjectStorageService,
  type IObjectStorageService,
} from "../domains/documents/documentStorage";
import {
  createDocumentSearchIndexFromEnvironment,
  InMemoryDocumentIndexAdapter,
  PostgresDocumentSearchIndex,
  type IDocumentSearchIndex,
} from "../domains/documents/documentSearchIndex";
import {
  assertProductionInfrastructureReady,
  isProductionInfrastructureEnvironment,
  resolveInfrastructureConfiguration,
  type InfrastructureConfiguration,
  type InfrastructureEnvironment,
  type InfrastructureReadiness,
} from "./runtime";

export interface ApplicationInfrastructure {
  readonly database: DatabaseStore;
  readonly auditRepository: IAuditLogRepository;
  readonly sessionStore: ISessionStore;
  readonly rateLimiter: IRateLimiter;
  readonly objectStorage: IObjectStorageService;
  readonly searchIndex: IDocumentSearchIndex;
  readonly configuration: InfrastructureConfiguration;
  readonly readiness: InfrastructureReadiness;
}

function requireDatabaseUrl(env: InfrastructureEnvironment): string {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when the PostgreSQL database adapter is selected");
  }
  return databaseUrl;
}

/** Explicit database provider factory. No production database singleton exists. */
export function createDatabaseStoreFromEnvironment(
  env: InfrastructureEnvironment = process.env
): DatabaseStore {
  const configuration = resolveInfrastructureConfiguration(env);
  const production = isProductionInfrastructureEnvironment(env);

  if (production && configuration.database !== "postgres") {
    throw new Error("Production database provider must be PostgreSQL; in-memory database state is local/test only");
  }

  if (configuration.database === "postgres") {
    return DatabaseStore.createPostgresStore(requireDatabaseUrl(env));
  }

  return DatabaseStore.createFreshStore();
}

/** Audit is composed from the same database authority so business+audit UoW stays atomic. */
export function createAuditRepositoryFromEnvironment(
  env: InfrastructureEnvironment = process.env,
  database: DatabaseStore = createDatabaseStoreFromEnvironment(env)
): IAuditLogRepository {
  const configuration = resolveInfrastructureConfiguration(env);
  const production = isProductionInfrastructureEnvironment(env);

  if (production && configuration.audit !== "postgres") {
    throw new Error("Production audit provider must be PostgreSQL; in-memory audit state is local/test only");
  }
  if (configuration.audit === "postgres" && !database.isPostgresBacked()) {
    throw new Error("PostgreSQL audit authority must be composed from the PostgreSQL DatabaseStore");
  }
  if (production && !(database.auditLogsRepo instanceof PostgresAuditLogRepository)) {
    throw new Error("Production audit repository did not resolve to PostgresAuditLogRepository");
  }
  return database.auditLogsRepo;
}

function assertProductionProviderTypes(infrastructure: ApplicationInfrastructure): void {
  if (!infrastructure.database.isPostgresBacked()) {
    throw new Error("Production composition resolved a non-PostgreSQL database authority");
  }
  if (!(infrastructure.auditRepository instanceof PostgresAuditLogRepository)) {
    throw new Error("Production composition resolved a non-PostgreSQL audit authority");
  }
  if (!(infrastructure.sessionStore instanceof RedisSessionStore)) {
    throw new Error("Production composition resolved a non-Redis session authority");
  }
  if (!(infrastructure.rateLimiter instanceof RedisRateLimiter)) {
    throw new Error("Production composition resolved a non-Redis rate-limit authority");
  }
  if (!(infrastructure.objectStorage instanceof S3CompatibleObjectStorageService)) {
    throw new Error("Production composition resolved a non-S3 object-storage authority");
  }
  if (!(infrastructure.searchIndex instanceof PostgresDocumentSearchIndex)) {
    throw new Error("Production composition resolved a non-PostgreSQL search authority");
  }
}

function assertLocalMemoryProviderTypes(infrastructure: ApplicationInfrastructure): void {
  const configuration = infrastructure.configuration;
  if (configuration.database === "memory" && infrastructure.database.isPostgresBacked()) {
    throw new Error("Local memory database configuration unexpectedly resolved PostgreSQL");
  }
  if (configuration.audit === "memory" && infrastructure.auditRepository instanceof PostgresAuditLogRepository) {
    throw new Error("Local memory audit configuration unexpectedly resolved PostgreSQL");
  }
  if (configuration.session === "memory" && !(infrastructure.sessionStore instanceof InMemorySessionStore)) {
    throw new Error("Local memory session configuration did not resolve InMemorySessionStore");
  }
  if (configuration.rateLimit === "memory" && !(infrastructure.rateLimiter instanceof InMemoryRateLimiter)) {
    throw new Error("Local memory rate-limit configuration did not resolve InMemoryRateLimiter");
  }
  if (configuration.objectStorage === "memory" && !(infrastructure.objectStorage instanceof InMemoryObjectStorageAdapter)) {
    throw new Error("Local memory object-storage configuration did not resolve InMemoryObjectStorageAdapter");
  }
  if (configuration.searchIndex === "memory" && !(infrastructure.searchIndex instanceof InMemoryDocumentIndexAdapter)) {
    throw new Error("Local memory search configuration did not resolve InMemoryDocumentIndexAdapter");
  }
}

/**
 * Construct one explicit infrastructure graph. The function intentionally does
 * not cache: callers receive provider instances, not process-global persistence
 * singletons. Durable providers still converge on the same external authorities.
 */
export function createApplicationInfrastructure(
  env: InfrastructureEnvironment = process.env
): ApplicationInfrastructure {
  const readiness = assertProductionInfrastructureReady(env);
  if (readiness.issues.length > 0) {
    throw new Error(`Infrastructure configuration is invalid: ${readiness.issues.join("; ")}`);
  }

  const database = createDatabaseStoreFromEnvironment(env);
  const infrastructure: ApplicationInfrastructure = Object.freeze({
    database,
    auditRepository: createAuditRepositoryFromEnvironment(env, database),
    sessionStore: createSessionStoreFromEnvironment(env),
    rateLimiter: createRateLimiterFromEnvironment(env),
    objectStorage: createObjectStorageFromEnvironment(env),
    searchIndex: createDocumentSearchIndexFromEnvironment(env),
    configuration: readiness.configuration,
    readiness,
  });

  if (isProductionInfrastructureEnvironment(env)) {
    assertProductionProviderTypes(infrastructure);
  } else {
    assertLocalMemoryProviderTypes(infrastructure);
  }

  return infrastructure;
}
