/**
 * APEX ONE — Stage 4D encrypted S3-compatible document storage verification.
 *
 * Runs against real PostgreSQL and an S3-compatible endpoint (LocalStack in CI).
 */

import { DatabaseStore } from "../lib/backend/database/store";
import type {
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
} from "../lib/backend/database/schema";
import type { TenantContext } from "../lib/backend/core/errors";
import { NotFoundError } from "../lib/backend/core/errors";
import { hashPassword } from "../lib/backend/core/crypto";
import { DocumentService } from "../lib/backend/domains/documents/documentService";
import {
  buildTenantDocumentObjectKey,
  createObjectStorageFromEnvironment,
  IObjectStorageService,
  MAX_DOCUMENT_BYTES,
  S3CompatibleObjectStorageService,
} from "../lib/backend/domains/documents/documentStorage";
import { InMemoryDocumentIndexAdapter } from "../lib/backend/domains/documents/documentSearchIndex";
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

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Stage 4D S3 integration tests`);
  return value;
}

const databaseUrl = required("DATABASE_URL");
const s3Endpoint = required("S3_ENDPOINT");
const s3Bucket = required("S3_BUCKET");
const s3Region = required("S3_REGION");
const s3AccessKeyId = required("S3_ACCESS_KEY_ID");
const s3SecretAccessKey = required("S3_SECRET_ACCESS_KEY");
const encryptionKey = required("DOCUMENT_STORAGE_ENCRYPTION_KEY");

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
  const credentials = hashPassword("ApexStorage2026!");
  return {
    id,
    email,
    name: id,
    title: "Storage Test Operator",
    status: "active",
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
    createdAt: now(),
  };
}

function membership(id: string, orgId: string, userId: string): OrganizationMembershipRecord {
  return {
    id,
    organizationId: orgId,
    userId,
    role: "CEO",
    department: "Executive",
    joinedAt: now(),
  };
}

function context(orgId: string, userId: string, email: string): TenantContext {
  return {
    organizationId: orgId,
    userId,
    userEmail: email,
    userRole: "CEO",
    permissions: [
      "document:read",
      "document:write",
      "document:delete",
      "audit:read",
      "org:read",
      "org:admin",
      "knowledge:read",
      "knowledge:write",
    ],
    isSuperAdmin: false,
    requestId: `req-${orgId}-${Date.now()}`,
    timestamp: now(),
  } as TenantContext;
}

async function seedIdentity(
  store: DatabaseStore,
  orgId: string,
  userId: string,
  email: string
): Promise<TenantContext> {
  await store.createOrganizationRecord(organization(orgId));
  await store.createUserRecord(user(userId, email));
  await store.createMembershipRecord(membership(`mem-${orgId}-${userId}`, orgId, userId));
  return context(orgId, userId, email);
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

function rawClient(): S3WireClient {
  return new S3WireClient({
    bucket: s3Bucket,
    region: s3Region,
    accessKeyId: s3AccessKeyId,
    secretAccessKey: s3SecretAccessKey,
    endpoint: s3Endpoint,
  });
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
    throw new Error("Injected S3 delete outage");
  }
}

async function expectDocumentMissing(store: DatabaseStore, id: string, ctx: TenantContext): Promise<void> {
  let missing = false;
  try {
    await store.documentsRepo.findById(id, ctx, "Document");
  } catch (error) {
    missing = error instanceof NotFoundError;
  }
  if (!missing) throw new Error(`Document ${id} unexpectedly remained authoritative in PostgreSQL`);
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

async function main(): Promise<void> {
  const s3 = rawClient();
  await s3.createBucketForIntegrationTests();

  const store = DatabaseStore.createPostgresStore(databaseUrl);
  await store.bootstrapPersistence();
  await store.clearPersistentStateForTesting();
  const ctxA = await seedIdentity(store, "org-storage-a", "usr-storage-a", "storage-a@example.test");
  const ctxB = await seedIdentity(store, "org-storage-b", "usr-storage-b", "storage-b@example.test");

  await check("1. S3 provider factory selects the durable adapter only when explicitly configured", async () => {
    const configured = createObjectStorageFromEnvironment({
      APP_ENV: "test",
      APEX_OBJECT_STORAGE_ADAPTER: "s3",
      S3_ENDPOINT: s3Endpoint,
      S3_BUCKET: s3Bucket,
      S3_REGION: s3Region,
      S3_ACCESS_KEY_ID: s3AccessKeyId,
      S3_SECRET_ACCESS_KEY: s3SecretAccessKey,
      DOCUMENT_STORAGE_ENCRYPTION_KEY: encryptionKey,
    });
    if (!(configured instanceof S3CompatibleObjectStorageService)) {
      throw new Error("S3 configuration did not select S3CompatibleObjectStorageService");
    }
  });

  await check("2. Tenant-scoped object keys are deterministic by tenant and traversal-safe", async () => {
    const keyA = buildTenantDocumentObjectKey(ctxA.organizationId, "doc-key-test", "Quarterly Report.pdf");
    const keyB = buildTenantDocumentObjectKey(ctxB.organizationId, "doc-key-test", "Quarterly Report.pdf");
    if (keyA === keyB) throw new Error("Different tenants received the same object key");
    if (!keyA.startsWith("tenants/") || !keyA.includes("/documents/doc-key-test/")) {
      throw new Error("Canonical tenant document key shape is invalid");
    }
    if (keyA.includes(ctxA.organizationId)) {
      throw new Error("Canonical object key exposed the raw tenant identifier");
    }
  });

  await check("3. MIME/type mismatch and oversized objects fail before durable storage", async () => {
    const service = new DocumentService(store, durableStorage(), new InMemoryDocumentIndexAdapter());
    let mimeRejected = false;
    try {
      await service.uploadDocument(
        {
          name: "mismatch.csv",
          fileType: "pdf",
          category: "Other",
          size: "1 KB",
          contentBuffer: "not a pdf",
        },
        ctxA
      );
    } catch {
      mimeRejected = true;
    }
    if (!mimeRejected) throw new Error("MIME/file-type mismatch was accepted");

    let sizeRejected = false;
    try {
      await durableStorage().putObject(
        buildTenantDocumentObjectKey(ctxA.organizationId, "oversized", "oversized.pdf"),
        Buffer.alloc(MAX_DOCUMENT_BYTES + 1),
        "application/pdf"
      );
    } catch {
      sizeRejected = true;
    }
    if (!sizeRejected) throw new Error("Oversized document object was accepted");
  });

  await check("4. S3 stores ciphertext while the durable adapter round-trips exact plaintext", async () => {
    const storage = durableStorage();
    const key = buildTenantDocumentObjectKey(ctxA.organizationId, "doc-encryption", "secret.pdf");
    const plaintext = "Highly confidential Stage 4D integration payload";
    const write = await storage.putObject(key, plaintext, "application/pdf");
    if (write.encryption !== "AES-256-GCM") throw new Error("Durable object was not reported as encrypted");

    const raw = await s3.getObject(key);
    if (!raw) throw new Error("Encrypted S3 object is missing");
    if (raw.data.toString("utf8").includes(plaintext)) {
      throw new Error("Plaintext document content was visible in raw S3 state");
    }

    const roundTrip = await storage.getObject(key);
    if (!roundTrip || Buffer.from(roundTrip.data).toString("utf8") !== plaintext) {
      throw new Error("Encrypted document did not round-trip exactly");
    }
    if (roundTrip.mimeType !== "application/pdf") throw new Error("Original MIME type was not preserved");
    await storage.deleteObject(key);
  });

  let authoritativeDocumentId = "";
  let authoritativeStorageKey = "";

  await check("5. PostgreSQL metadata remains authoritative while blob bytes live only in S3", async () => {
    const service = new DocumentService(store, durableStorage(), new InMemoryDocumentIndexAdapter());
    const content = "PostgreSQL metadata authority with encrypted S3 blob bytes";
    const document = await service.uploadDocument(
      {
        name: "authority.pdf",
        fileType: "pdf",
        category: "Audit Report",
        size: "999 MB",
        contentBuffer: content,
      },
      ctxA
    );
    authoritativeDocumentId = document.id;
    authoritativeStorageKey = document.storageKey;
    if (document.metadata.fileSizeBytes !== Buffer.byteLength(content, "utf8")) {
      throw new Error("Document metadata trusted caller size instead of actual object bytes");
    }
    if (!document.metadata.checksumSha256 || !document.metadata.storageUri.startsWith("s3://")) {
      throw new Error("Authoritative PostgreSQL metadata is missing checksum/storage URI");
    }

    const restart = DatabaseStore.createPostgresStore(databaseUrl);
    const persisted = await restart.documentsRepo.findById(document.id, ctxA, "Document");
    if (persisted.storageKey !== document.storageKey || persisted.metadata.checksumSha256 !== document.metadata.checksumSha256) {
      throw new Error("Document metadata did not survive a fresh PostgreSQL store instance");
    }
    const blob = await durableStorage().getObject(document.storageKey);
    if (!blob || Buffer.from(blob.data).toString("utf8") !== content) {
      throw new Error("Document blob did not remain independently available in S3");
    }
  });

  await check("6. Database rejection after S3 write compensates the orphan blob", async () => {
    const service = new DocumentService(store, durableStorage(), new InMemoryDocumentIndexAdapter());
    const before = await storageOperationLogs(store, ctxA);
    let rejected = false;
    try {
      await service.uploadDocument(
        {
          name: "compensate.pdf",
          fileType: "pdf",
          category: "Contract",
          size: "1 KB",
          customerId: "missing-customer",
          contentBuffer: "Blob must be deleted when PostgreSQL metadata rejects relationship",
        },
        ctxA
      );
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("Invalid document relationship unexpectedly committed");

    const after = await storageOperationLogs(store, ctxA);
    const newPending = after.find(
      (log) => log.action === "document_storage:upload_cleanup_pending" &&
        !before.some((previous) => previous.resourceId === log.resourceId)
    );
    const key = newPending?.metadata?.storageKey;
    if (typeof key !== "string") throw new Error("Upload compensation reservation was not durably recorded");
    if (await s3.headObject(key)) throw new Error("Compensation left an orphan S3 blob after PostgreSQL rejection");
    if (!after.some((log) => log.resourceId === newPending.resourceId && log.action === "document_storage:completed")) {
      throw new Error("Compensated upload did not record a durable completion event");
    }
  });

  await check("7. Database deletion rejection leaves the S3 object untouched", async () => {
    const service = new DocumentService(store, durableStorage(), new InMemoryDocumentIndexAdapter());
    const document = await service.uploadDocument(
      {
        name: "restricted-delete.pdf",
        fileType: "pdf",
        category: "Contract",
        size: "1 KB",
        contentBuffer: "Blob must survive when a KnowledgeItem blocks document deletion",
      },
      ctxA
    );
    await store.knowledgeRepo.create(
      {
        id: `knowledge-${Date.now()}`,
        title: "Delete blocker",
        category: "Policy",
        content: "Dependency",
        author: ctxA.userEmail,
        sourceDocId: document.id,
        tags: ["stage4d"],
        version: 1,
        createdAt: now(),
        updatedAt: now(),
      },
      ctxA
    );

    let blocked = false;
    try {
      await service.deleteDocument(document.id, ctxA);
    } catch {
      blocked = true;
    }
    if (!blocked) throw new Error("Relationship-protected document deletion unexpectedly succeeded");
    await store.documentsRepo.findById(document.id, ctxA, "Document");
    if (!(await s3.headObject(document.storageKey))) {
      throw new Error("S3 blob was deleted before PostgreSQL deletion was allowed");
    }
  });

  await check("8. S3 deletion outage leaves a durable PostgreSQL retry operation", async () => {
    const storage = durableStorage();
    const service = new DocumentService(store, storage, new InMemoryDocumentIndexAdapter());
    const document = await service.uploadDocument(
      {
        name: "retry-delete.pdf",
        fileType: "pdf",
        category: "Other",
        size: "1 KB",
        contentBuffer: "Deletion should be retried from durable PostgreSQL outbox state",
      },
      ctxA
    );

    const failingService = new DocumentService(
      store,
      new FailingDeleteStorage(storage),
      new InMemoryDocumentIndexAdapter()
    );
    const deleted = await failingService.deleteDocument(document.id, ctxA);
    if (!deleted) throw new Error("PostgreSQL document deletion did not commit");
    await expectDocumentMissing(store, document.id, ctxA);
    if (!(await s3.headObject(document.storageKey))) {
      throw new Error("Injected delete outage did not preserve the blob for retry verification");
    }

    const logs = await storageOperationLogs(store, ctxA);
    const pending = logs.find(
      (log) => log.action === "document_storage:delete_pending" &&
        log.metadata?.documentId === document.id
    );
    if (!pending) throw new Error("S3 deletion outage did not leave durable pending operation state");
    if (!logs.some((log) => log.resourceId === pending.resourceId && log.action === "document_storage:retry_required")) {
      throw new Error("S3 deletion outage did not record retry-required diagnostics");
    }
  });

  await check("9. A fresh service instance drains pending S3 deletion after application restart", async () => {
    const restartStore = DatabaseStore.createPostgresStore(databaseUrl);
    const restartService = new DocumentService(
      restartStore,
      durableStorage(),
      new InMemoryDocumentIndexAdapter()
    );
    const result = await restartService.retryPendingStorageOperations(ctxA, 20);
    if (result.attempted < 1 || result.completed < 1) {
      throw new Error("Fresh service instance did not process durable pending storage operations");
    }

    const logs = await storageOperationLogs(restartStore, ctxA);
    const pendingDelete = logs.find(
      (log) => log.action === "document_storage:delete_pending" &&
        typeof log.metadata?.storageKey === "string" &&
        log.metadata.storageKey.includes("retry-delete.pdf")
    );
    if (!pendingDelete) throw new Error("Retry target operation could not be found after restart");
    if (await s3.headObject(String(pendingDelete.metadata?.storageKey))) {
      throw new Error("Retry drain did not remove the pending S3 object");
    }
    if (!logs.some((log) => log.resourceId === pendingDelete.resourceId && log.action === "document_storage:completed")) {
      throw new Error("Retry drain did not record durable completion");
    }
  });

  await check("10. Crash-like pending upload reservation is safely compensated after restart", async () => {
    const storage = durableStorage();
    const key = buildTenantDocumentObjectKey(ctxA.organizationId, "crash-reservation", "crash.pdf");
    await storage.putObject(key, "orphaned before metadata commit", "application/pdf");
    const operationId = `storage-op-crash-${Date.now()}`;
    await store.recordAuditLog({
      organizationId: ctxA.organizationId,
      actorId: ctxA.userId,
      actorEmail: ctxA.userEmail,
      action: "document_storage:upload_cleanup_pending",
      resource: "DocumentStorageOperation",
      resourceId: operationId,
      requestId: ctxA.requestId,
      status: "success",
      metadata: {
        documentId: "crash-reservation",
        storageKey: key,
        operationType: "upload_cleanup",
      },
      timestamp: now(),
    });

    const restart = new DocumentService(
      DatabaseStore.createPostgresStore(databaseUrl),
      durableStorage(),
      new InMemoryDocumentIndexAdapter()
    );
    const result = await restart.retryPendingStorageOperations(ctxA, 20);
    if (result.completed < 1) throw new Error("Crash-like upload reservation was not compensated");
    if (await s3.headObject(key)) throw new Error("Crash-like orphaned upload remained in S3");
  });

  await check("11. Tenant B cannot converge onto Tenant A object-key namespace", async () => {
    const a = buildTenantDocumentObjectKey(ctxA.organizationId, "same-doc", "same.pdf");
    const b = buildTenantDocumentObjectKey(ctxB.organizationId, "same-doc", "same.pdf");
    if (a === b || a.split("/")[1] === b.split("/")[1]) {
      throw new Error("Tenant-specific object key namespace collision detected");
    }
  });

  await check("12. Successful deletion removes PostgreSQL metadata and S3 blob", async () => {
    const service = new DocumentService(store, durableStorage(), new InMemoryDocumentIndexAdapter());
    const document = await service.uploadDocument(
      {
        name: "successful-delete.pdf",
        fileType: "pdf",
        category: "Other",
        size: "1 KB",
        contentBuffer: "Delete me from both authorities",
      },
      ctxB
    );
    if (!(await s3.headObject(document.storageKey))) throw new Error("Test blob was not created");
    if (!(await service.deleteDocument(document.id, ctxB))) throw new Error("Document delete returned false");
    await expectDocumentMissing(store, document.id, ctxB);
    if (await s3.headObject(document.storageKey)) throw new Error("Successful deletion left S3 blob behind");
  });

  // Clean the authoritative document created for restart verification.
  if (authoritativeDocumentId && authoritativeStorageKey) {
    const service = new DocumentService(store, durableStorage(), new InMemoryDocumentIndexAdapter());
    try { await service.deleteDocument(authoritativeDocumentId, ctxA); } catch { /* isolated test cleanup */ }
  }

  const failed = results.filter((result) => !result.passed);
  console.log("================================================================================");
  console.log("APEX ONE — STAGE 4D S3 DOCUMENT STORAGE INTEGRATION");
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
  console.error("Stage 4D S3 integration failed:", error);
  process.exit(1);
});
