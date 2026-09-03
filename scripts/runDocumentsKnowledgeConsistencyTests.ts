process.env.TEST_ENV = "true";

import { readFileSync } from "node:fs";
import { DatabaseStore } from "../lib/backend/database/store";
import type { IDataProvider } from "../lib/backend/database/demoDataProvider";
import type {
  DocumentRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
} from "../lib/backend/database/schema";
import type { TenantContext } from "../lib/backend/core/errors";
import { EvidenceService } from "../lib/backend/domains/evidence/evidenceService";
import { DocumentConsistencyService } from "../lib/backend/domains/documents/documentConsistencyService";
import { InMemoryObjectStorageAdapter } from "../lib/backend/domains/documents/documentStorage";
import {
  InMemoryDocumentIndexAdapter,
  type IDocumentSearchIndex,
} from "../lib/backend/domains/documents/documentSearchIndex";
import { ControlledKnowledgeService } from "../lib/backend/domains/knowledge/controlledKnowledgeService";
import {
  createKnowledgeRevisionSnapshot,
  deriveKnowledgeRevisionView,
} from "../lib/backend/domains/knowledge/knowledgeRevisionModel";

interface Result { name: string; passed: boolean; error?: string }
const results: Result[] = [];

const EMPTY_PROVIDER: IDataProvider = {
  isDemoProvider: () => false,
  seedInitialTenants: () => undefined,
};

function now(): string { return new Date().toISOString(); }

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Stage 9 consistency tests`);
  return value;
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
  return {
    id,
    email,
    name: id,
    title: "Stage 9 Tester",
    status: "active",
    createdAt: now(),
  };
}

function membership(id: string, orgId: string, userId: string): OrganizationMembershipRecord {
  return { id, organizationId: orgId, userId, role: "CEO", department: "Executive", joinedAt: now() };
}

function context(orgId: string, userId: string, email: string, admin = true): TenantContext {
  return {
    organizationId: orgId,
    userId,
    userEmail: email,
    userRole: "CEO",
    permissions: [
      "org:read",
      ...(admin ? ["org:admin" as const] : []),
      "knowledge:read",
      "knowledge:write",
      "document:read",
      "document:write",
      "document:delete",
      "audit:read",
    ],
    isSuperAdmin: false,
    requestId: `stage9-${orgId}-${Math.random().toString(36).slice(2)}`,
    timestamp: now(),
  } as TenantContext;
}

async function seed(store: DatabaseStore, orgId: string, userId: string, email: string): Promise<TenantContext> {
  await store.createOrganizationRecord(organization(orgId));
  await store.createUserRecord(user(userId, email));
  await store.createMembershipRecord(membership(`membership-${orgId}-${userId}`, orgId, userId));
  return context(orgId, userId, email, true);
}

async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    results.push({ name, passed: false, error: message });
    console.error(`❌ ${name}: ${message}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectRejects(fn: () => Promise<unknown>): Promise<void> {
  let rejected = false;
  try { await fn(); } catch { rejected = true; }
  assert(rejected, "Expected operation to reject");
}

class ToggleIndex implements IDocumentSearchIndex {
  private readonly delegate = new InMemoryDocumentIndexAdapter();
  public failNextIndex = false;
  public failDelete = false;

  async indexDocument(orgId: string, documentId: string, text: string): Promise<string> {
    if (this.failNextIndex) {
      this.failNextIndex = false;
      throw new Error("Injected document index outage");
    }
    return this.delegate.indexDocument(orgId, documentId, text);
  }

  async removeDocument(orgId: string, documentId: string): Promise<boolean> {
    if (this.failDelete) throw new Error("Injected document index delete outage");
    return this.delegate.removeDocument(orgId, documentId);
  }

  search(orgId: string, query: string): Promise<string[]> {
    return this.delegate.search(orgId, query);
  }
}

function indexedSourceDocument(id: string, checksum: string): Omit<DocumentRecord, "organizationId"> {
  const timestamp = now();
  return {
    id,
    name: `${id}.pdf`,
    fileType: "pdf",
    category: "Policy" as never,
    size: "1 KB",
    uploadedBy: "stage9@example.test",
    storageKey: `tenants/test/documents/${id}/${id}.pdf`,
    status: "indexed",
    metadata: {
      fileSizeBytes: 1024,
      mimeType: "application/pdf",
      checksumSha256: checksum,
      storageUri: `s3://stage9/${id}`,
      indexRef: `idx-${id}`,
      extractedAt: timestamp,
    },
    extractedFields: [],
    tags: ["stage9"],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function main() {
  const databaseUrl = required("DATABASE_URL");

  await check("1. Revision model hashes immutable content and starts draft", () => {
    const snapshot = createKnowledgeRevisionSnapshot({
      knowledgeItemId: "knowledge-model",
      revision: 1,
      title: "Policy",
      category: "Policy",
      content: "Immutable body",
      tags: ["Policy"],
      createdBy: "tester",
      createdAt: now(),
    });
    const view = deriveKnowledgeRevisionView(snapshot, []);
    assert(view.state === "draft", "New revision was not draft");
    assert(snapshot.contentHashSha256.length === 64, "Revision SHA-256 hash missing");
    assert(view.validationKind === "consistency", "Stage 9 validation kind is not explicit");
  });

  await check("2. Revision state machine requires validation before publication", async () => {
    const snapshot = createKnowledgeRevisionSnapshot({
      knowledgeItemId: "knowledge-model-2",
      revision: 1,
      title: "Policy",
      category: "Policy",
      content: "Immutable body",
      tags: ["Policy"],
      createdBy: "tester",
      createdAt: now(),
    });
    await expectRejects(async () => deriveKnowledgeRevisionView(snapshot, [{
      knowledgeItemId: snapshot.knowledgeItemId,
      revision: 1,
      state: "published",
      contentHashSha256: snapshot.contentHashSha256,
      actorId: "tester",
      actorEmail: "tester@example.test",
      publicationScope: "tenant",
      createdAt: now(),
    }]));
  });

  const memory = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
  const memoryCtx = await seed(memory, "org-stage9-memory", "user-stage9-memory", "stage9-memory@example.test");
  const storage = new InMemoryObjectStorageAdapter();
  const index = new ToggleIndex();
  const documents = new DocumentConsistencyService(memory, storage, index);

  let failedDocumentId = "";
  await check("3. Processing failure transitions durable document metadata to failed/retryable", async () => {
    index.failNextIndex = true;
    await expectRejects(() => documents.uploadDocument({
      name: "retryable.pdf",
      fileType: "pdf",
      category: "Other",
      size: "1 KB",
      contentBuffer: "Stage 9 processing recovery content",
    }, memoryCtx));
    const failed = await memory.documentsRepo.findMany(memoryCtx, { where: { status: { eq: "failed" } } });
    assert(failed.items.length === 1, "Failed document did not persist as failed");
    failedDocumentId = failed.items[0].id;
    const logs = await memory.auditLogsRepo.findMany(memoryCtx, {
      where: { resource: { eq: "DocumentConsistencyOperation" } },
      limit: 100,
    });
    assert(logs.items.some((log) => log.action === "document_consistency:process_retry_required"), "Retry-required process event missing");
  });

  await check("4. Explicit retry command recovers failed processing to indexed", async () => {
    const summary = await documents.retryPendingDocumentOperations(memoryCtx, 20);
    assert(summary.processing.attempted >= 1 && summary.processing.completed >= 1, "Processing retry did not complete");
    const recovered = await memory.documentsRepo.findById(failedDocumentId, memoryCtx, "Document");
    assert(recovered.status === "indexed", "Recovered document did not become indexed");
  });

  await check("5. Deferred search-index deletion is durably retried after metadata deletion", async () => {
    const doc = await documents.uploadDocument({
      name: "delete-index.pdf",
      fileType: "pdf",
      category: "Other",
      size: "1 KB",
      contentBuffer: "Delete index recovery",
    }, memoryCtx);
    index.failDelete = true;
    await documents.deleteDocument(doc.id, memoryCtx);
    index.failDelete = false;
    const summary = await documents.retryPendingDocumentOperations(memoryCtx, 20);
    assert(summary.searchIndex.attempted >= 1 && summary.searchIndex.completed >= 1, "Deferred index delete was not retried");
    const logs = await memory.auditLogsRepo.findMany(memoryCtx, {
      where: { resource: { eq: "Document" }, resourceId: { eq: doc.id } },
      limit: 100,
    });
    assert(logs.items.some((log) => log.action === "document_search:delete_retry_completed"), "Index retry completion was not durable");
  });

  const knowledge = new ControlledKnowledgeService(memory);
  let knowledgeId = "";
  await check("6. Knowledge creation cannot self-assert platform publication", async () => {
    await expectRejects(() => knowledge.createKnowledgeItem({
      title: "Unsafe publish",
      category: "Policy",
      content: "Must remain draft",
      isPublicPlatformKnowledge: true,
    }, memoryCtx));
  });

  await check("7. Knowledge creation produces an immutable draft revision", async () => {
    const item = await knowledge.createKnowledgeItem({
      title: "Controlled policy",
      category: "Policy",
      content: "Published body v1",
      tags: ["governance"],
    }, memoryCtx);
    knowledgeId = item.id;
    assert(item.isPublicPlatformKnowledge === false, "Draft became public");
    const history = await knowledge.getRevisionHistory(item.id, memoryCtx);
    assert(history.revisions.length === 1 && history.revisions[0].state === "draft", "Initial immutable draft revision missing");
  });

  await check("8. Unvalidated revision cannot publish", async () => {
    await expectRejects(() => knowledge.publishRevision(knowledgeId, 1, "tenant", memoryCtx));
  });

  await check("9. Consistency validation does not auto-verify or certify knowledge", async () => {
    const validated = await knowledge.validateRevision(knowledgeId, 1, memoryCtx);
    assert(validated.state === "validated", "Revision was not validated");
    const evidence = await new EvidenceService(memory).getStatus("KnowledgeItem", knowledgeId, memoryCtx);
    assert(evidence.verificationState === "unverified", "Consistency validation became canonical verification");
    assert(evidence.certificationState === "uncertified", "Consistency validation became canonical certification");
  });

  await check("10. Validated revision publishes only through explicit command", async () => {
    const published = await knowledge.publishRevision(knowledgeId, 1, "tenant", memoryCtx);
    assert(published.content === "Published body v1", "Published body mismatch");
    assert(published.isPublicPlatformKnowledge === false, "Tenant publication became platform-public");
    const history = await knowledge.getRevisionHistory(knowledgeId, memoryCtx);
    assert(history.latestPublishedRevision === 1, "Published revision basis missing");
  });

  await check("11. New revision does not mutate currently published content", async () => {
    const draft = await knowledge.createRevision(knowledgeId, { content: "Pending body v2" }, memoryCtx);
    assert(draft.snapshot.revision === 2 && draft.state === "draft", "Pending revision not created");
    const materialized = await knowledge.getKnowledgeItemById(knowledgeId, memoryCtx);
    assert(materialized.content === "Published body v1", "Published content mutated before validation/publication");
    assert(materialized.version === 2, "Latest revision counter did not advance monotonically");
  });

  await check("12. Latest validated revision replaces published projection", async () => {
    await knowledge.validateRevision(knowledgeId, 2, memoryCtx);
    const published = await knowledge.publishRevision(knowledgeId, 2, "tenant", memoryCtx);
    assert(published.content === "Pending body v2", "Validated v2 did not become published projection");
    await expectRejects(() => knowledge.publishRevision(knowledgeId, 1, "tenant", memoryCtx));
  });

  await check("13. Rejected revision can be superseded without reusing its immutable number", async () => {
    const rejectedDraft = await knowledge.createRevision(knowledgeId, { content: "Reject me" }, memoryCtx);
    assert(rejectedDraft.snapshot.revision === 3, "Expected revision 3");
    const rejected = await knowledge.rejectRevision(knowledgeId, 3, "Incorrect policy wording", memoryCtx);
    assert(rejected.state === "rejected", "Revision was not rejected");
    const replacement = await knowledge.createRevision(knowledgeId, { content: "Replacement body v4" }, memoryCtx);
    assert(replacement.snapshot.revision === 4, "Rejected revision number was reused");
  });

  await check("14. Platform publication requires explicit org:admin authority", async () => {
    await knowledge.validateRevision(knowledgeId, 4, memoryCtx);
    const nonAdmin = context(memoryCtx.organizationId, memoryCtx.userId, memoryCtx.userEmail, false);
    await expectRejects(() => knowledge.publishRevision(knowledgeId, 4, "platform", nonAdmin));
    const published = await knowledge.publishRevision(knowledgeId, 4, "platform", memoryCtx);
    assert(published.isPublicPlatformKnowledge === true, "Authorized platform publication was not materialized");
  });

  await check("15. Source-document checksum drift invalidates a revision basis", async () => {
    const checksumA = "a".repeat(64);
    const checksumB = "b".repeat(64);
    const source = await memory.documentsRepo.create(indexedSourceDocument("source-stage9", checksumA), memoryCtx);
    const sourced = await knowledge.createKnowledgeItem({
      title: "Sourced policy",
      category: "Policy",
      content: "Bound to exact source bytes",
      sourceDocId: source.id,
    }, memoryCtx);
    await memory.documentsRepo.update(source.id, {
      metadata: { ...source.metadata, checksumSha256: checksumB },
    }, memoryCtx, "Document");
    await expectRejects(() => knowledge.validateRevision(sourced.id, 1, memoryCtx));
  });

  await check("16. PostgreSQL restart recovers failed document processing operation", async () => {
    const storeA = DatabaseStore.createPostgresStore(databaseUrl);
    await storeA.bootstrapPersistence();
    await storeA.clearPersistentStateForTesting();
    const ctx = await seed(storeA, "org-stage9-pg", "user-stage9-pg", "stage9-pg@example.test");
    const pgStorage = new InMemoryObjectStorageAdapter();
    const pgIndex = new ToggleIndex();
    pgIndex.failNextIndex = true;
    const serviceA = new DocumentConsistencyService(storeA, pgStorage, pgIndex);
    await expectRejects(() => serviceA.uploadDocument({
      name: "restart.pdf",
      fileType: "pdf",
      category: "Other",
      size: "1 KB",
      contentBuffer: "restart processing body",
    }, ctx));

    const storeB = DatabaseStore.createPostgresStore(databaseUrl);
    const serviceB = new DocumentConsistencyService(storeB, pgStorage, pgIndex);
    const summary = await serviceB.retryPendingDocumentOperations(ctx, 20);
    assert(summary.processing.completed >= 1, "Fresh PostgreSQL service did not drain process retry");
    const docs = await storeB.documentsRepo.findMany(ctx, { where: { status: { eq: "indexed" } } });
    assert(docs.items.length === 1, "Document processing state was not recovered after restart");
  });

  await check("17. PostgreSQL restart preserves immutable revision history and publication", async () => {
    const store = DatabaseStore.createPostgresStore(databaseUrl);
    const ctx = context("org-stage9-pg", "user-stage9-pg", "stage9-pg@example.test", true);
    const service = new ControlledKnowledgeService(store);
    const item = await service.createKnowledgeItem({
      title: "Restart knowledge",
      category: "Policy",
      content: "Durable revision content",
    }, ctx);
    await service.validateRevision(item.id, 1, ctx);
    await service.publishRevision(item.id, 1, "tenant", ctx);

    const restart = new ControlledKnowledgeService(DatabaseStore.createPostgresStore(databaseUrl));
    const history = await restart.getRevisionHistory(item.id, ctx);
    const materialized = await restart.getKnowledgeItemById(item.id, ctx);
    assert(history.latestPublishedRevision === 1, "Published revision history did not survive restart");
    assert(materialized.content === "Durable revision content", "Published projection did not survive restart");
  });

  await check("18. Canonical HTTP routes expose commands and reject direct publication fields", () => {
    const createRoute = readFileSync("app/api/v1/knowledge/route.ts", "utf8");
    const revisionRoute = readFileSync("app/api/v1/knowledge/[id]/revisions/route.ts", "utf8");
    const validateRoute = readFileSync("app/api/v1/knowledge/[id]/revisions/[revision]/validate/route.ts", "utf8");
    const publishRoute = readFileSync("app/api/v1/knowledge/[id]/revisions/[revision]/publish/route.ts", "utf8");
    const retryRoute = readFileSync("app/api/v1/documents/retry/route.ts", "utf8");
    assert(!/KNOWLEDGE_BODY_KEYS[\s\S]*isPublicPlatformKnowledge/.test(createRoute), "Create route still accepts direct publication authority");
    assert(revisionRoute.includes("createRevision") && validateRoute.includes("validateRevision"), "Revision command routes missing");
    assert(publishRoute.includes("publishRevision"), "Explicit publish command route missing");
    assert(retryRoute.includes("retryPendingDocumentOperations"), "Document consistency retry command missing");
  });

  const failed = results.filter((result) => !result.passed);
  console.log("================================================================================");
  console.log("APEX ONE — STAGE 9 DOCUMENTS / KNOWLEDGE CONSISTENCY");
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

void main().catch((error) => {
  console.error("Stage 9 consistency suite failed:", error);
  process.exit(1);
});
