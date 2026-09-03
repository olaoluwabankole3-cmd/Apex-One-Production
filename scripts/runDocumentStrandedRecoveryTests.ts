process.env.TEST_ENV = "true";

import { DatabaseStore } from "../lib/backend/database/store";
import type { IDataProvider } from "../lib/backend/database/demoDataProvider";
import type {
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
} from "../lib/backend/database/schema";
import type { TenantContext } from "../lib/backend/core/errors";
import { DocumentConsistencyService } from "../lib/backend/domains/documents/documentConsistencyService";
import {
  buildTenantDocumentObjectKey,
  InMemoryObjectStorageAdapter,
} from "../lib/backend/domains/documents/documentStorage";
import { InMemoryDocumentIndexAdapter } from "../lib/backend/domains/documents/documentSearchIndex";

const EMPTY_PROVIDER: IDataProvider = {
  isDemoProvider: () => false,
  seedInitialTenants: () => undefined,
};

function now(): string { return new Date().toISOString(); }

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const store = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
  const orgId = "org-stage9-stranded";
  const userId = "user-stage9-stranded";
  const email = "stage9-stranded@example.test";
  const timestamp = now();

  const org: OrganizationRecord = {
    id: orgId,
    name: "Stage 9 Stranded Recovery",
    displayName: "Stage 9 Stranded Recovery",
    slug: orgId,
    industry: "technology",
    plan: "enterprise",
    currency: "USD",
    currencySymbol: "$",
    timezone: "UTC",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const user: UserRecord = {
    id: userId,
    email,
    name: "Stage 9 Recovery",
    title: "Tester",
    status: "active",
    createdAt: timestamp,
  };
  const membership: OrganizationMembershipRecord = {
    id: `membership-${orgId}`,
    organizationId: orgId,
    userId,
    role: "CEO",
    department: "Executive",
    joinedAt: timestamp,
  };
  await store.createOrganizationRecord(org);
  await store.createUserRecord(user);
  await store.createMembershipRecord(membership);

  const ctx: TenantContext = {
    organizationId: orgId,
    userId,
    userEmail: email,
    userRole: "CEO",
    permissions: ["document:read", "document:write", "document:delete", "audit:read"],
    isSuperAdmin: false,
    requestId: "stage9-stranded-recovery",
    timestamp,
  } as TenantContext;

  const storage = new InMemoryObjectStorageAdapter();
  const index = new InMemoryDocumentIndexAdapter();
  const service = new DocumentConsistencyService(store, storage, index);
  const documentId = "doc-stage9-stranded";
  const storageKey = buildTenantDocumentObjectKey(orgId, documentId, "stranded.pdf");
  const stored = await storage.putObject(
    storageKey,
    "Durable input committed before consistency event",
    "application/pdf"
  );

  await store.documentsRepo.create({
    id: documentId,
    name: "stranded.pdf",
    fileType: "pdf",
    category: "Other",
    size: "1 KB",
    uploadedBy: email,
    storageKey,
    status: "processing",
    metadata: {
      fileSizeBytes: stored.bytes,
      mimeType: "application/pdf",
      checksumSha256: stored.checksumSha256,
      storageUri: stored.uri,
    },
    extractedFields: [],
    tags: ["stage9"],
    createdAt: timestamp,
    updatedAt: timestamp,
  }, ctx);

  const before = await store.auditLogsRepo.findMany(ctx, {
    where: { resource: { eq: "DocumentConsistencyOperation" } },
    limit: 100,
  });
  assert(before.items.length === 0, "Fixture unexpectedly contained a consistency event");

  const summary = await service.retryPendingDocumentOperations(ctx, 20);
  assert(summary.processing.attempted === 1, "Stranded processing row was not discovered");
  assert(summary.processing.completed === 1, "Stranded processing row was not recovered");
  const recovered = await store.documentsRepo.findById(documentId, ctx, "Document");
  assert(recovered.status === "indexed", "Recovered stranded document did not become indexed");

  console.log("✅ [PASS] Durable processing/failed document state reconstructs retry work without an audit event");
  console.log("TOTAL: 1 | PASSED: 1 | FAILED: 0");
}

void main().catch((error) => {
  console.error("❌ Stage 9 stranded document recovery test failed:", error);
  process.exit(1);
});
