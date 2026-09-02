/**
 * APEX ONE — Stage 4G durability and recovery assurance.
 *
 * This suite runs PostgreSQL, Redis, and S3-compatible storage together and
 * deliberately exercises restart, concurrency, rollback, outage, compensation,
 * rebuild, and fail-closed behavior. It verifies recovery properties without
 * introducing any alternate production authority or memory fallback.
 */

import { hashPassword } from "../lib/backend/core/crypto";
import { ConflictError, type TenantContext } from "../lib/backend/core/errors";
import { ROLE_PERMISSIONS } from "../lib/backend/core/security";
import { DatabaseStore } from "../lib/backend/database/store";
import type {
  CustomerRecord,
  DocumentRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
} from "../lib/backend/database/schema";
import {
  PostgresAuditLogRepository,
} from "../lib/backend/database/adapters/postgres/PostgresPersistence";
import { PostgresWireConnection } from "../lib/backend/database/adapters/postgres/PostgresWireClient";
import {
  InMemorySessionStore,
  RedisSessionStore,
  createSessionStoreFromEnvironment,
  type ISessionStore,
} from "../lib/backend/domains/auth/authProvider";
import { AuthService } from "../lib/backend/domains/auth/authService";
import {
  InMemoryRateLimiter,
  RedisRateLimiter,
  createRateLimiterFromEnvironment,
  type IRateLimiter,
} from "../lib/backend/domains/auth/rateLimiter";
import { DocumentService } from "../lib/backend/domains/documents/documentService";
import {
  buildTenantDocumentObjectKey,
  InMemoryObjectStorageAdapter,
  S3CompatibleObjectStorageService,
  type IObjectStorageService,
} from "../lib/backend/domains/documents/documentStorage";
import {
  InMemoryDocumentIndexAdapter,
  PostgresDocumentSearchIndex,
} from "../lib/backend/domains/documents/documentSearchIndex";
import {
  createApplicationInfrastructure,
  createDatabaseStoreFromEnvironment,
} from "../lib/backend/infrastructure/composition";
import type { InfrastructureEnvironment } from "../lib/backend/infrastructure/runtime";
import { RedisWireClient } from "../lib/backend/infrastructure/redis/RedisWireClient";
import { S3WireClient } from "../lib/backend/infrastructure/s3/S3WireClient";

interface CheckResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: CheckResult[] = [];

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
  } catch (error: any) {
    results.push({ name, passed: false, error: error?.stack || error?.message || String(error) });
  }
}

async function expectReject(label: string, fn: () => Promise<unknown>): Promise<void> {
  let rejected = false;
  try {
    await fn();
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(`${label} did not fail closed`);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Stage 4G recovery assurance`);
  return value;
}

const databaseUrl = required("DATABASE_URL");
const redisUrl = required("REDIS_URL");
const s3Endpoint = required("S3_ENDPOINT");
const s3Bucket = required("S3_BUCKET");
const s3Region = required("S3_REGION");
const s3AccessKeyId = required("S3_ACCESS_KEY_ID");
const s3SecretAccessKey = required("S3_SECRET_ACCESS_KEY");
const encryptionKey = required("DOCUMENT_STORAGE_ENCRYPTION_KEY");
const redis = new RedisWireClient(redisUrl);

function now(): string {
  return new Date().toISOString();
}

function organization(id: string): OrganizationRecord {
  return {
    id,
    name: `${id} Holdings`,
    displayName: id,
    slug: id,
    industry: "technology",
    plan: "enterprise",
    currency: "USD",
    currencySymbol: "$",
    timezone: "UTC",
    createdAt: now(),
    updatedAt: now(),
  };
}

function user(id: string, email: string): UserRecord {
  const credentials = hashPassword("ApexRecovery2026!");
  return {
    id,
    email,
    name: id,
    title: "Recovery Test Operator",
    status: "active",
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
    createdAt: now(),
  };
}

function membership(id: string, organizationId: string, userId: string): OrganizationMembershipRecord {
  return {
    id,
    organizationId,
    userId,
    role: "CEO",
    department: "Executive",
    joinedAt: now(),
  };
}

function context(organizationId: string, userId: string, email: string): TenantContext {
  return {
    organizationId,
    userId,
    userEmail: email,
    userRole: "CEO",
    permissions: [
      "org:read",
      "org:admin",
      "customer:read",
      "customer:write",
      "customer:delete",
      "document:read",
      "document:write",
      "document:delete",
      "knowledge:read",
      "knowledge:write",
      "audit:read",
    ],
    isSuperAdmin: false,
    requestId: `req-${organizationId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now(),
  } as TenantContext;
}

async function seedIdentity(
  store: DatabaseStore,
  organizationId: string,
  userId: string,
  email: string
): Promise<TenantContext> {
  await store.createOrganizationRecord(organization(organizationId));
  await store.createUserRecord(user(userId, email));
  await store.createMembershipRecord(membership(`mem-${organizationId}-${userId}`, organizationId, userId));
  return context(organizationId, userId, email);
}

function customer(id: string, email: string): Omit<CustomerRecord, "organizationId"> {
  return {
    id,
    name: id,
    subsidiary: "Enterprise",
    tier: "Enterprise",
    status: "active",
    healthScore: 90,
    arr: 250_000,
    owner: "Recovery Owner",
    contactName: "Recovery Contact",
    contactRole: "Director",
    contactEmail: email,
    since: "2026-01-01",
    tags: ["stage4g"],
    createdAt: now(),
    updatedAt: now(),
  };
}

function searchDocument(id: string, ctx: TenantContext, marker: string): DocumentRecord {
  const createdAt = now();
  return {
    id,
    organizationId: ctx.organizationId,
    name: `${id}.pdf`,
    fileType: "pdf",
    category: "Other",
    size: "1 KB",
    uploadedBy: ctx.userEmail,
    storageKey: `stage4g/${ctx.organizationId}/${id}.pdf`,
    status: "indexed",
    metadata: {
      fileSizeBytes: 1024,
      mimeType: "application/pdf",
      storageUri: `s3://stage4g/${ctx.organizationId}/${id}.pdf`,
    },
    aiSummary: marker,
    extractedFields: [],
    tags: ["stage4g", marker],
    createdAt,
    updatedAt: createdAt,
  };
}

function sessionParams(userId: string, organizationId: string) {
  return {
    user: { id: userId, email: `${userId}@stage4g.test`, name: userId },
    org: { id: organizationId, name: organizationId },
    role: "Operations",
    permissions: [...ROLE_PERMISSIONS.Operations],
  };
}

async function flushRedis(): Promise<void> {
  const reply = await redis.execute(["FLUSHDB"]);
  if (reply !== "OK") throw new Error("Redis FLUSHDB failed during recovery setup");
}

function durableStorage(): S3CompatibleObjectStorageService {
  return new S3CompatibleObjectStorageService({
    bucket: s3Bucket,
    region: s3Region,
    accessKeyId: s3AccessKeyId,
    secretAccessKey: s3SecretAccessKey,
    encryptionKey,
    endpoint: s3Endpoint,
  });
}

function rawS3(): S3WireClient {
  return new S3WireClient({
    bucket: s3Bucket,
    region: s3Region,
    accessKeyId: s3AccessKeyId,
    secretAccessKey: s3SecretAccessKey,
    endpoint: s3Endpoint,
  });
}

async function inspect(sql: string) {
  const connection = await PostgresWireConnection.connect(databaseUrl);
  try {
    return await connection.query(sql);
  } finally {
    await connection.close();
  }
}

async function storageOperationLogs(store: DatabaseStore, ctx: TenantContext) {
  return (
    await store.auditLogsRepo.findMany(ctx, {
      where: { resource: { eq: "DocumentStorageOperation" } },
      limit: 100,
      cursor: null,
    })
  ).items;
}

class FailingDeleteStorage implements IObjectStorageService {
  constructor(private readonly delegate: IObjectStorageService) {}
  putObject(key: string, data: Buffer | string, mimeType: string) {
    return this.delegate.putObject(key, data, mimeType);
  }
  getObject(key: string) {
    return this.delegate.getObject(key);
  }
  async deleteObject(): Promise<boolean> {
    throw new Error("Stage 4G injected object-storage delete outage");
  }
}

function unavailableProductionEnv(): InfrastructureEnvironment {
  return {
    APP_ENV: "production",
    APEX_DATABASE_ADAPTER: "postgres",
    APEX_AUDIT_ADAPTER: "postgres",
    APEX_SESSION_ADAPTER: "redis",
    APEX_RATE_LIMIT_ADAPTER: "redis",
    APEX_OBJECT_STORAGE_ADAPTER: "s3",
    APEX_SEARCH_INDEX_ADAPTER: "postgres",
    DATABASE_URL:
      "postgres://apex:unavailable@127.0.0.1:59999/apex?sslmode=require&connect_timeout_ms=250",
    REDIS_URL: "rediss://127.0.0.1:6399/0?connect_timeout_ms=250",
    S3_BUCKET: "apex-unavailable-documents",
    S3_REGION: "us-east-1",
    S3_ENDPOINT: "https://s3.example.invalid",
    S3_ACCESS_KEY_ID: "unavailable-access-key",
    S3_SECRET_ACCESS_KEY: "unavailable-secret-key",
    DOCUMENT_STORAGE_ENCRYPTION_KEY: encryptionKey,
  };
}

async function main(): Promise<void> {
  const s3 = rawS3();
  await s3.createBucketForIntegrationTests();

  const store = DatabaseStore.createPostgresStore(databaseUrl);
  await store.bootstrapPersistence();
  await store.clearPersistentStateForTesting();
  await flushRedis();

  await check("1. Fresh provider instances recover durable state after a simulated process restart", async () => {
    await store.clearPersistentStateForTesting();
    await flushRedis();
    const ctx = await seedIdentity(store, "org-restart", "usr-restart", "restart@example.test");
    await store.customersRepo.create(customer("cust-restart", "customer-restart@example.test"), ctx);
    await store.documentsRepo.create(searchDocument("doc-restart", ctx, "restartsearchmarker"), ctx);

    const sessionA = new RedisSessionStore(redisUrl, "stage4g:restart:sessions");
    const session = await sessionA.createSession(sessionParams("user-restart-session", "org-restart"));
    const limiterA = new RedisRateLimiter(redisUrl, 5, 60_000, 60_000, "stage4g:restart:rate");
    await limiterA.recordAttempt("restart-rate-key", false);
    await limiterA.recordAttempt("restart-rate-key", false);

    const objectKey = buildTenantDocumentObjectKey(ctx.organizationId, "doc-restart-object", "restart.pdf");
    await durableStorage().putObject(objectKey, "restart object payload", "application/pdf");

    const restartStore = DatabaseStore.createPostgresStore(databaseUrl);
    await restartStore.customersRepo.findById("cust-restart", ctx, "Customer");

    const sessionB = new RedisSessionStore(redisUrl, "stage4g:restart:sessions");
    if (!(await sessionB.getSession(session.token))) {
      throw new Error("Fresh session adapter lost Redis session state");
    }

    const limiterB = new RedisRateLimiter(redisUrl, 5, 60_000, 60_000, "stage4g:restart:rate");
    const rateState = await limiterB.isRateLimited("restart-rate-key");
    if (rateState.totalAttempts !== 2) {
      throw new Error(`Fresh rate limiter lost Redis attempts: ${JSON.stringify(rateState)}`);
    }

    const object = await durableStorage().getObject(objectKey);
    if (!object || Buffer.from(object.data).toString("utf8") !== "restart object payload") {
      throw new Error("Fresh object-storage adapter could not recover S3 state");
    }

    const search = new PostgresDocumentSearchIndex(databaseUrl);
    if (!(await search.search(ctx.organizationId, "restartsearchmarker")).includes("doc-restart")) {
      throw new Error("Fresh search adapter lost PostgreSQL-derived search state");
    }

    await sessionB.revokeSession(session.token);
    await durableStorage().deleteObject(objectKey);
  });

  await check("2. Concurrent PostgreSQL writes from independent application instances remain durable", async () => {
    await store.clearPersistentStateForTesting();
    const ctx = await seedIdentity(store, "org-concurrent-4g", "usr-concurrent-4g", "concurrent-4g@example.test");
    const writers = [
      DatabaseStore.createPostgresStore(databaseUrl),
      DatabaseStore.createPostgresStore(databaseUrl),
      DatabaseStore.createPostgresStore(databaseUrl),
    ];

    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        writers[index % writers.length].runInTransaction(ctx, async (uow) => {
          const id = `cust-4g-concurrent-${index}`;
          await uow.customers.create(customer(id, `${id}@example.test`), uow.context);
          await uow.recordAuditLog({
            organizationId: uow.context.organizationId,
            actorId: uow.context.userId,
            actorEmail: uow.context.userEmail,
            action: "stage4g:concurrent-write",
            resource: "Customer",
            resourceId: id,
            requestId: `${ctx.requestId}-${index}`,
            status: "success",
            timestamp: now(),
          });
        })
      )
    );

    const restart = DatabaseStore.createPostgresStore(databaseUrl);
    if ((await restart.customersRepo.count(ctx)) !== 12) {
      throw new Error("Concurrent PostgreSQL writes were lost after restart");
    }
    if ((await restart.auditLogsRepo.count(ctx, { where: { action: { eq: "stage4g:concurrent-write" } } })) !== 12) {
      throw new Error("Concurrent PostgreSQL audit writes were lost or duplicated");
    }
  });

  await check("3. PostgreSQL conflict fault injection rolls back business and audit writes atomically", async () => {
    await store.clearPersistentStateForTesting();
    const ctx = await seedIdentity(store, "org-fault-rollback", "usr-fault-rollback", "fault-rollback@example.test");
    const faultStore = DatabaseStore.createPostgresStore(databaseUrl);

    let conflictObserved = false;
    try {
      await faultStore.runInTransaction(ctx, async (uow) => {
        await uow.customers.create(customer("cust-fault-rollback", "fault-first@example.test"), uow.context);
        await uow.recordAuditLog({
          organizationId: uow.context.organizationId,
          actorId: uow.context.userId,
          actorEmail: uow.context.userEmail,
          action: "stage4g:fault-rollback",
          resource: "Customer",
          resourceId: "cust-fault-rollback",
          requestId: ctx.requestId,
          status: "success",
          timestamp: now(),
        });
        await uow.customers.create(customer("cust-fault-rollback", "fault-duplicate@example.test"), uow.context);
      });
    } catch (error) {
      conflictObserved = error instanceof ConflictError;
    }
    if (!conflictObserved) throw new Error("Injected PostgreSQL uniqueness fault did not surface as ConflictError");

    const restart = DatabaseStore.createPostgresStore(databaseUrl);
    if ((await restart.customersRepo.count(ctx)) !== 0) {
      throw new Error("Business row survived a faulted PostgreSQL transaction");
    }
    if ((await restart.auditLogsRepo.count(ctx, { where: { action: { eq: "stage4g:fault-rollback" } } })) !== 0) {
      throw new Error("Audit row survived a faulted PostgreSQL transaction");
    }
  });

  await check("4. Session revocation propagates across instances and remains revoked after restart", async () => {
    await flushRedis();
    const storeA = new RedisSessionStore(redisUrl, "stage4g:revocation");
    const storeB = new RedisSessionStore(redisUrl, "stage4g:revocation");
    const target = await storeA.createSession(sessionParams("user-revoked", "org-revoked"));
    const other = await storeA.createSession(sessionParams("user-preserved", "org-revoked"));

    if ((await storeB.revokeUserSessions("user-revoked")) !== 1) {
      throw new Error("Peer instance did not revoke the target user's session");
    }

    const restarted = new RedisSessionStore(redisUrl, "stage4g:revocation");
    if (await restarted.getSession(target.token)) {
      throw new Error("Revoked session reappeared after fresh adapter construction");
    }
    if (!(await restarted.getSession(other.token))) {
      throw new Error("Cross-instance revocation removed an unrelated session");
    }
    await restarted.revokeSession(other.token);
  });

  await check("5. Rate-limit state persists across restart and concurrent distributed failures", async () => {
    await flushRedis();
    const limiterA = new RedisRateLimiter(redisUrl, 5, 60_000, 60_000, "stage4g:rate-persistence");
    const limiterB = new RedisRateLimiter(redisUrl, 5, 60_000, 60_000, "stage4g:rate-persistence");
    const key = "203.0.113.44:stage4g@example.test";

    await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        (index % 2 === 0 ? limiterA : limiterB).recordAttempt(key, false)
      )
    );

    const restarted = new RedisRateLimiter(redisUrl, 5, 60_000, 60_000, "stage4g:rate-persistence");
    const locked = await restarted.isRateLimited(key);
    if (!locked.limited || locked.totalAttempts !== 6 || locked.remainingAttempts !== 0) {
      throw new Error(`Restarted rate limiter lost distributed lockout state: ${JSON.stringify(locked)}`);
    }

    await restarted.reset(key);
    const reset = await limiterA.isRateLimited(key);
    if (reset.limited || reset.totalAttempts !== 0 || reset.remainingAttempts !== 5) {
      throw new Error("Rate-limit reset did not converge across instances");
    }
  });

  await check("6. Object-storage delete outage is compensated from durable PostgreSQL retry state after restart", async () => {
    await store.clearPersistentStateForTesting();
    const ctx = await seedIdentity(store, "org-storage-recovery", "usr-storage-recovery", "storage-recovery@example.test");
    const search = new PostgresDocumentSearchIndex(databaseUrl);
    const service = new DocumentService(store, durableStorage(), search);
    const document = await service.uploadDocument(
      {
        name: "recovery-delete.pdf",
        fileType: "pdf",
        category: "Other",
        size: "1 KB",
        contentBuffer: "Stage 4G durable deletion recovery payload",
      },
      ctx
    );
    if (!(await s3.headObject(document.storageKey))) throw new Error("Recovery object was not written to S3");

    const failing = new DocumentService(
      store,
      new FailingDeleteStorage(durableStorage()),
      new PostgresDocumentSearchIndex(databaseUrl)
    );
    if (!(await failing.deleteDocument(document.id, ctx))) {
      throw new Error("Authoritative document deletion did not commit during storage outage");
    }
    if (!(await s3.headObject(document.storageKey))) {
      throw new Error("Injected S3 outage did not leave an object for retry recovery");
    }

    const beforeRestart = await storageOperationLogs(store, ctx);
    const pending = beforeRestart.find(
      (log) => log.action === "document_storage:delete_pending" && log.metadata?.documentId === document.id
    );
    if (!pending) throw new Error("Storage outage did not leave durable delete-pending state");
    if (!beforeRestart.some((log) => log.resourceId === pending.resourceId && log.action === "document_storage:retry_required")) {
      throw new Error("Storage outage did not record retry-required diagnostics");
    }

    const restartService = new DocumentService(
      DatabaseStore.createPostgresStore(databaseUrl),
      durableStorage(),
      new PostgresDocumentSearchIndex(databaseUrl)
    );
    const recovered = await restartService.retryPendingStorageOperations(ctx, 20);
    if (recovered.attempted < 1 || recovered.completed < 1) {
      throw new Error(`Restart recovery did not drain pending storage work: ${JSON.stringify(recovered)}`);
    }
    if (await s3.headObject(document.storageKey)) {
      throw new Error("Restart recovery left the pending S3 object behind");
    }
  });

  await check("7. PostgreSQL search index rebuild recreates the GIN index from authoritative document rows", async () => {
    await store.clearPersistentStateForTesting();
    const ctx = await seedIdentity(store, "org-search-rebuild", "usr-search-rebuild", "search-rebuild@example.test");
    await store.documentsRepo.create(searchDocument("doc-search-rebuild", ctx, "phoenixrebuildmarker"), ctx);

    const initial = new PostgresDocumentSearchIndex(databaseUrl);
    await initial.bootstrap();
    if (!(await initial.search(ctx.organizationId, "phoenixrebuildmarker")).includes("doc-search-rebuild")) {
      throw new Error("Search rebuild fixture was not visible before index loss");
    }

    await inspect("DROP INDEX IF EXISTS apex_domain_records_document_search_gin_idx");
    const absent = await inspect(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = 'apex_domain_records_document_search_gin_idx'
    `);
    if (absent.rows.length !== 0) throw new Error("Search GIN index was not removed for rebuild injection");

    const rebuilt = new PostgresDocumentSearchIndex(databaseUrl);
    await rebuilt.bootstrap();
    const restored = await inspect(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = 'apex_domain_records_document_search_gin_idx'
    `);
    if (restored.rows.length !== 1 || !/USING gin/i.test(restored.rows[0]?.indexdef || "")) {
      throw new Error("Search bootstrap did not recreate the PostgreSQL GIN index");
    }
    if (!(await rebuilt.search(ctx.organizationId, "phoenixrebuildmarker")).includes("doc-search-rebuild")) {
      throw new Error("Rebuilt search index did not recover authoritative document visibility");
    }

    const migration = await inspect(`
      SELECT COUNT(*) AS count FROM apex_schema_migrations
      WHERE version = '002_stage4_document_search'
    `);
    if (migration.rows[0]?.count !== "1") {
      throw new Error("Search rebuild duplicated or lost the durable migration marker");
    }
  });

  await check("8. Unavailable PostgreSQL fails closed and never consults compatibility memory state", async () => {
    const env = unavailableProductionEnv();
    const unavailable = createDatabaseStoreFromEnvironment({
      APP_ENV: "production",
      APEX_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: env.DATABASE_URL,
    });
    if (!unavailable.isPostgresBacked()) throw new Error("Unavailable production database did not remain PostgreSQL-backed");

    const ctx = context("org-db-unavailable", "usr-db-unavailable", "db-unavailable@example.test");
    unavailable.customers.set("memory-phantom", {
      ...customer("memory-phantom", "memory-phantom@example.test"),
      organizationId: ctx.organizationId,
    });

    await expectReject("Unavailable PostgreSQL bootstrap", () => unavailable.bootstrapPersistence());
    await expectReject("Unavailable PostgreSQL repository query", () => unavailable.customersRepo.count(ctx));
    if (!unavailable.customers.has("memory-phantom")) {
      throw new Error("Recovery fixture unexpectedly mutated compatibility memory state");
    }
  });

  await check("9. Unavailable Redis makes session and authentication rate-limit paths fail closed", async () => {
    const unreachableRedis = "rediss://127.0.0.1:6399/0?connect_timeout_ms=250";
    const sessionStore: ISessionStore = createSessionStoreFromEnvironment({
      APP_ENV: "production",
      APEX_SESSION_ADAPTER: "redis",
      REDIS_URL: unreachableRedis,
    });
    const rateLimiter: IRateLimiter = createRateLimiterFromEnvironment({
      APP_ENV: "production",
      APEX_RATE_LIMIT_ADAPTER: "redis",
      REDIS_URL: unreachableRedis,
    });
    if (!(sessionStore instanceof RedisSessionStore)) throw new Error("Unavailable Redis session path fell back to memory");
    if (!(rateLimiter instanceof RedisRateLimiter)) throw new Error("Unavailable Redis rate-limit path fell back to memory");

    await expectReject("Unavailable Redis session lookup", () => sessionStore.getSession("opaque-stage4g-token"));
    await expectReject("Unavailable Redis rate-limit check", () => rateLimiter.isRateLimited("stage4g-unavailable-rate"));

    const auth = new AuthService(DatabaseStore.createPostgresStore(databaseUrl), undefined, sessionStore, rateLimiter);
    await expectReject("Authentication while Redis is unavailable", () =>
      auth.login(
        { email: "unavailable-redis@example.test", password: "irrelevant" },
        "req-stage4g-redis-unavailable"
      )
    );
  });

  await check("10. Production composition preserves durable provider types during infrastructure failure", async () => {
    const infrastructure = createApplicationInfrastructure(unavailableProductionEnv());
    if (!infrastructure.database.isPostgresBacked()) throw new Error("Production database silently downgraded from PostgreSQL");
    if (!(infrastructure.auditRepository instanceof PostgresAuditLogRepository)) {
      throw new Error("Production audit authority silently downgraded from PostgreSQL");
    }
    if (!(infrastructure.sessionStore instanceof RedisSessionStore) || infrastructure.sessionStore instanceof InMemorySessionStore) {
      throw new Error("Production session authority silently downgraded to memory");
    }
    if (!(infrastructure.rateLimiter instanceof RedisRateLimiter) || infrastructure.rateLimiter instanceof InMemoryRateLimiter) {
      throw new Error("Production rate-limit authority silently downgraded to memory");
    }
    if (!(infrastructure.objectStorage instanceof S3CompatibleObjectStorageService) || infrastructure.objectStorage instanceof InMemoryObjectStorageAdapter) {
      throw new Error("Production object-storage authority silently downgraded to memory");
    }
    if (!(infrastructure.searchIndex instanceof PostgresDocumentSearchIndex) || infrastructure.searchIndex instanceof InMemoryDocumentIndexAdapter) {
      throw new Error("Production search authority silently downgraded to memory");
    }

    await expectReject("Production database operation during outage", () => infrastructure.database.bootstrapPersistence());
    await expectReject("Production session operation during outage", () => infrastructure.sessionStore.getActiveSessionCount());
    await expectReject("Production rate-limit operation during outage", () => infrastructure.rateLimiter.isRateLimited("stage4g-prod-outage"));
    await expectReject("Production search operation during database outage", () =>
      infrastructure.searchIndex.search("org-prod-outage", "recoverymarker")
    );
  });

  await flushRedis();

  const failed = results.filter((result) => !result.passed);
  console.log("================================================================================");
  console.log("APEX ONE — STAGE 4G DURABILITY / RECOVERY ASSURANCE");
  console.log("================================================================================");
  for (const result of results) {
    console.log(`${result.passed ? "✅ [PASS]" : "❌ [FAIL]"} ${result.name}`);
    if (result.error) console.log(`    ↳ ${result.error}`);
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(`TOTAL: ${results.length} | PASSED: ${results.length - failed.length} | FAILED: ${failed.length}`);
  console.log("================================================================================");
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("FATAL STAGE 4G RECOVERY ASSURANCE ERROR", error);
  process.exit(1);
});
