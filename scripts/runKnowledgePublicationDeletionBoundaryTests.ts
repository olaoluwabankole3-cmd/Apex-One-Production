process.env.TEST_ENV = "true";

import { DatabaseStore } from "../lib/backend/database/store";
import type { IDataProvider } from "../lib/backend/database/demoDataProvider";
import type {
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
} from "../lib/backend/database/schema";
import type { TenantContext } from "../lib/backend/core/errors";
import { PublicationSafeKnowledgeService } from "../lib/backend/domains/knowledge/publicationSafeKnowledgeService";

const EMPTY_PROVIDER: IDataProvider = {
  isDemoProvider: () => false,
  seedInitialTenants: () => undefined,
};

function now(): string { return new Date().toISOString(); }

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectRejects(fn: () => Promise<unknown>): Promise<void> {
  let rejected = false;
  try { await fn(); } catch { rejected = true; }
  assert(rejected, "Expected operation to reject");
}

async function main(): Promise<void> {
  const store = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
  const orgId = "org-stage9-delete-boundary";
  const userId = "user-stage9-delete-boundary";
  const email = "stage9-delete-boundary@example.test";
  const timestamp = now();

  const org: OrganizationRecord = {
    id: orgId,
    name: "Stage 9 Delete Boundary",
    displayName: "Stage 9 Delete Boundary",
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
    name: "Stage 9 Delete Boundary",
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
    permissions: ["org:read", "org:admin", "knowledge:read", "knowledge:write", "audit:read"],
    isSuperAdmin: false,
    requestId: "stage9-delete-boundary",
    timestamp,
  } as TenantContext;

  const service = new PublicationSafeKnowledgeService(store);

  const draft = await service.createKnowledgeItem({
    title: "Disposable draft",
    category: "Policy",
    content: "Draft content",
  }, ctx);
  const draftDeleted = await service.deleteKnowledgeItem(draft.id, ctx);
  assert(draftDeleted === true, "Unpublished draft could not be deleted");

  const published = await service.createKnowledgeItem({
    title: "Published policy",
    category: "Policy",
    content: "Published content",
  }, ctx);
  await service.validateRevision(published.id, 1, ctx);
  await service.publishRevision(published.id, 1, "platform", ctx);

  await expectRejects(() => service.deleteKnowledgeItem(published.id, ctx));
  const stillPresent = await service.getKnowledgeItemById(published.id, ctx);
  assert(stillPresent.id === published.id, "Published knowledge was removed by generic CRUD");

  console.log("✅ [PASS] Draft knowledge may delete, but published knowledge requires an explicit retraction lifecycle");
  console.log("TOTAL: 1 | PASSED: 1 | FAILED: 0");
}

void main().catch((error) => {
  console.error("❌ Stage 9 publication deletion boundary test failed:", error);
  process.exit(1);
});
