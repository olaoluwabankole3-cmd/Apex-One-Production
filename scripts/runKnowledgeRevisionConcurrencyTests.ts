process.env.TEST_ENV = "true";

import { DatabaseStore } from "../lib/backend/database/store";
import type {
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
} from "../lib/backend/database/schema";
import type { TenantContext } from "../lib/backend/core/errors";
import { ControlledKnowledgeService } from "../lib/backend/domains/knowledge/controlledKnowledgeService";

interface Result { name: string; passed: boolean; error?: string }
const results: Result[] = [];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Stage 9 concurrency tests`);
  return value;
}

function now(): string { return new Date().toISOString(); }

function context(orgId: string, userId: string, email: string): TenantContext {
  return {
    organizationId: orgId,
    userId,
    userEmail: email,
    userRole: "CEO",
    permissions: ["org:read", "org:admin", "knowledge:read", "knowledge:write", "audit:read"],
    isSuperAdmin: false,
    requestId: `stage9-concurrency-${Math.random().toString(36).slice(2)}`,
    timestamp: now(),
  } as TenantContext;
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
  return { id, email, name: id, title: "Stage 9 Concurrency", status: "active", createdAt: now() };
}

function membership(id: string, orgId: string, userId: string): OrganizationMembershipRecord {
  return { id, organizationId: orgId, userId, role: "CEO", department: "Executive", joinedAt: now() };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function check(name: string, fn: () => Promise<void>): Promise<void> {
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

async function main(): Promise<void> {
  const databaseUrl = required("DATABASE_URL");
  const storeA = DatabaseStore.createPostgresStore(databaseUrl);
  await storeA.bootstrapPersistence();
  await storeA.clearPersistentStateForTesting();

  const orgId = "org-stage9-concurrency";
  const userId = "user-stage9-concurrency";
  const email = "stage9-concurrency@example.test";
  await storeA.createOrganizationRecord(organization(orgId));
  await storeA.createUserRecord(user(userId, email));
  await storeA.createMembershipRecord(membership(`membership-${orgId}-${userId}`, orgId, userId));
  const ctx = context(orgId, userId, email);

  const storeB = DatabaseStore.createPostgresStore(databaseUrl);
  const serviceA = new ControlledKnowledgeService(storeA);
  const serviceB = new ControlledKnowledgeService(storeB);

  const item = await serviceA.createKnowledgeItem({
    title: "Concurrent knowledge",
    category: "Policy",
    content: "Published revision one",
  }, ctx);
  await serviceA.validateRevision(item.id, 1, ctx);
  await serviceA.publishRevision(item.id, 1, "tenant", ctx);

  await check("1. concurrent application instances cannot create competing next revisions", async () => {
    const settled = await Promise.allSettled([
      serviceA.createRevision(item.id, { content: "Candidate revision from instance A" }, ctx),
      serviceB.createRevision(item.id, { content: "Candidate revision from instance B" }, ctx),
    ]);
    const successes = settled.filter((result) => result.status === "fulfilled");
    assert(successes.length === 1, `Expected exactly one revision winner, received ${successes.length}`);

    const restart = new ControlledKnowledgeService(DatabaseStore.createPostgresStore(databaseUrl));
    const history = await restart.getRevisionHistory(item.id, ctx);
    const materialized = await restart.getKnowledgeItemById(item.id, ctx);
    assert(history.latestRevision === 2, `Expected latest revision 2, received ${history.latestRevision}`);
    assert(history.revisions.length === 2, `Expected exactly two immutable snapshots, received ${history.revisions.length}`);
    assert(history.revisions[1].state === "draft", "Winning concurrent revision is not draft");
    assert(materialized.version === 2, "Materialized revision counter diverged after concurrent creation");
    assert(materialized.content === "Published revision one", "Pending concurrent revision mutated published content");
  });

  await check("2. concurrent publication leaves one immutable publish decision", async () => {
    const service = new ControlledKnowledgeService(DatabaseStore.createPostgresStore(databaseUrl));
    await service.validateRevision(item.id, 2, ctx);

    const settled = await Promise.allSettled([
      serviceA.publishRevision(item.id, 2, "tenant", ctx),
      serviceB.publishRevision(item.id, 2, "tenant", ctx),
    ]);
    assert(settled.some((result) => result.status === "fulfilled"), "No concurrent publisher succeeded");

    const restartStore = DatabaseStore.createPostgresStore(databaseUrl);
    const restart = new ControlledKnowledgeService(restartStore);
    const history = await restart.getRevisionHistory(item.id, ctx);
    assert(history.latestPublishedRevision === 2, "Revision 2 was not durably published");
    const logs = await restartStore.auditLogsRepo.findMany(ctx, {
      where: {
        resource: { eq: "KnowledgeRevision" },
        resourceId: { eq: item.id },
        action: { eq: "knowledge_revision:published" },
      },
      limit: 100,
    });
    const revisionTwoPublishes = logs.items.filter((log) => {
      const metadata = log.metadata as Record<string, unknown> | undefined;
      return metadata?.revision === 2;
    });
    assert(revisionTwoPublishes.length === 1, `Expected one publish decision for revision 2, received ${revisionTwoPublishes.length}`);
  });

  const failed = results.filter((result) => !result.passed);
  console.log("================================================================================");
  console.log("APEX ONE — STAGE 9 KNOWLEDGE REVISION CONCURRENCY");
  console.log("================================================================================");
  for (const result of results) {
    console.log(`${result.passed ? "✅ [PASS]" : "❌ [FAIL]"} ${result.name}`);
    if (result.error) console.log(`    ↳ ${result.error}`);
  }
  console.log(`TOTAL: ${results.length} | PASSED: ${results.length - failed.length} | FAILED: ${failed.length}`);
  if (failed.length > 0) process.exit(1);
}

void main().catch((error) => {
  console.error("Stage 9 knowledge revision concurrency suite failed:", error);
  process.exit(1);
});
