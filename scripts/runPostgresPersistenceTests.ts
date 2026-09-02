/**
 * APEX ONE — Stage 4B PostgreSQL persistence integration verification.
 *
 * Runs against a real PostgreSQL service. This is intentionally separate from
 * the deterministic in-memory security suite so production durability is not
 * inferred from mocks.
 */

import { DatabaseStore } from "../lib/backend/database/store";
import {
  ActionRecord,
  ContractRecord,
  CustomerRecord,
  DocumentRecord,
  KnowledgeItemRecord,
  OrganizationalMemoryRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  SignalRecord,
  TransactionRecord,
  UserRecord,
  ValueCapturedRecord,
  ValueOpportunityRecord,
  WorkflowRecord,
  WorkflowRunRecord,
} from "../lib/backend/database/schema";
import { ConflictError, NotFoundError, type TenantContext } from "../lib/backend/core/errors";
import { hashPassword } from "../lib/backend/core/crypto";
import { InMemorySessionStore, LocalAuthenticationProvider } from "../lib/backend/domains/auth/authProvider";

interface CheckResult {
  name: string;
  passed: boolean;
  error?: string;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required for Stage 4B PostgreSQL integration tests");
  process.exit(1);
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

function now(): string {
  return new Date().toISOString();
}

function context(org: string, user: string, email: string): TenantContext {
  return {
    organizationId: org,
    userId: user,
    userEmail: email,
    userRole: "CEO",
    permissions: [
      "org:read",
      "org:admin",
      "customer:read",
      "customer:write",
      "customer:delete",
      "financial:read",
      "financial:write",
      "document:read",
      "document:write",
      "document:delete",
      "knowledge:read",
      "knowledge:write",
      "workflow:read",
      "workflow:write",
      "workflow:execute",
      "value:read",
      "value:write",
      "value:approve",
      "action:create",
      "action:approve",
      "action:execute",
      "audit:read",
    ],
    isSuperAdmin: false,
    requestId: `req-${org}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

function user(id: string, email: string, password = "ApexPostgres2026!"): UserRecord {
  const credentials = hashPassword(password);
  return {
    id,
    email,
    name: id,
    title: "Test Operator",
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

async function seedIdentity(store: DatabaseStore, orgId: string, userId: string, email: string): Promise<TenantContext> {
  await store.createOrganizationRecord(organization(orgId));
  await store.createUserRecord(user(userId, email));
  await store.createMembershipRecord(membership(`mem-${orgId}-${userId}`, orgId, userId));
  return context(orgId, userId, email);
}

function customer(id: string, email: string): Omit<CustomerRecord, "organizationId"> {
  return {
    id,
    name: id,
    subsidiary: "Enterprise",
    tier: "Enterprise",
    status: "active",
    healthScore: 90,
    arr: 1_000_000,
    owner: "Owner",
    contactName: "Contact",
    contactRole: "Director",
    contactEmail: email,
    since: "2026-01-01",
    tags: ["postgres"],
    createdAt: now(),
    updatedAt: now(),
  };
}

async function main(): Promise<void> {
  const store = DatabaseStore.createPostgresStore(databaseUrl);

  await check("1. PostgreSQL migrations bootstrap idempotently", async () => {
    await store.bootstrapPersistence();
    const second = DatabaseStore.createPostgresStore(databaseUrl);
    await second.bootstrapPersistence();
    await second.clearPersistentStateForTesting();
  });

  await check("2. Organizations, users, and memberships persist and enforce unique identity constraints", async () => {
    await store.clearPersistentStateForTesting();
    await seedIdentity(store, "org-identity", "usr-identity", "identity@example.test");

    const restart = DatabaseStore.createPostgresStore(databaseUrl);
    const persistedUser = await restart.findUserByEmail("IDENTITY@example.test");
    const persistedOrg = await restart.findOrganizationById("org-identity");
    const persistedMembership = await restart.findUserMembership("usr-identity", "org-identity");
    if (!persistedUser || !persistedOrg || !persistedMembership) {
      throw new Error("Identity records did not survive a new DatabaseStore instance");
    }

    let duplicateEmailRejected = false;
    try {
      await restart.createUserRecord(user("usr-duplicate", "identity@example.test"));
    } catch (error) {
      duplicateEmailRejected = error instanceof ConflictError;
    }
    if (!duplicateEmailRejected) throw new Error("Duplicate normalized user email was not rejected");

    let duplicateMembershipRejected = false;
    try {
      await restart.createMembershipRecord(membership("mem-duplicate", "org-identity", "usr-identity"));
    } catch (error) {
      duplicateMembershipRejected = error instanceof ConflictError;
    }
    if (!duplicateMembershipRejected) throw new Error("Duplicate user/organization membership was not rejected");
  });

  await check("3. Every Stage 4B domain and audit record survives process/store restart", async () => {
    await store.clearPersistentStateForTesting();
    const ctx = await seedIdentity(store, "org-all", "usr-all", "all@example.test");

    const createdCustomer = await store.customersRepo.create(customer("cust-all", "cust-all@example.test"), ctx);

    const contract: Omit<ContractRecord, "organizationId"> = {
      id: "contract-all",
      customerId: createdCustomer.id,
      title: "PostgreSQL Contract",
      contractValue: 250_000,
      startDate: "2026-01-01",
      endDate: "2027-01-01",
      renewalDaysRemaining: 120,
      status: "active",
      slaCompliance: 99,
      volatilityIndexationClause: false,
      createdAt: now(),
    };
    await store.contractsRepo.create(contract, ctx);

    const transaction: Omit<TransactionRecord, "organizationId"> = {
      id: "txn-all",
      customerId: createdCustomer.id,
      type: "revenue",
      amount: 50_000,
      currency: "USD",
      status: "cleared",
      reference: "PG-001",
      category: "subscription",
      date: "2026-09-02",
      createdAt: now(),
    };
    await store.transactionsRepo.create(transaction, ctx);

    const document: Omit<DocumentRecord, "organizationId"> = {
      id: "doc-all",
      customerId: createdCustomer.id,
      name: "postgres.pdf",
      fileType: "pdf",
      category: "Contract",
      size: "10 KB",
      uploadedBy: ctx.userEmail,
      storageKey: "org-all/doc-all",
      status: "indexed",
      metadata: { fileSizeBytes: 10_240, mimeType: "application/pdf", storageUri: "s3://pending/doc-all" },
      extractedFields: [],
      tags: ["postgres"],
      createdAt: now(),
      updatedAt: now(),
    };
    await store.documentsRepo.create(document, ctx);

    const knowledge: Omit<KnowledgeItemRecord, "organizationId"> = {
      id: "knowledge-all",
      title: "PostgreSQL Knowledge",
      category: "Policy",
      content: "Persisted knowledge content",
      author: ctx.userEmail,
      sourceDocId: "doc-all",
      tags: ["postgres"],
      version: 1,
      createdAt: now(),
      updatedAt: now(),
    };
    await store.knowledgeRepo.create(knowledge, ctx);

    const memory: Omit<OrganizationalMemoryRecord, "organizationId"> = {
      id: "memory-all",
      type: "fact",
      title: "Persisted Memory",
      content: "PostgreSQL restart evidence",
      source: "integration-test",
      sourceReference: "stage4b",
      confidence: 100,
      effectiveAt: now(),
      verified: true,
      createdAt: now(),
    };
    await store.memoryRepo.create(memory, ctx);

    const signal: Omit<SignalRecord, "organizationId"> = {
      id: "signal-all",
      category: "revenue",
      severity: "medium",
      title: "Persisted Signal",
      description: "Database integration signal",
      evidence: "integration-test",
      estimatedFinancialImpact: 1000,
      status: "active",
      detectedAt: now(),
    };
    await store.signalsRepo.create(signal, ctx);

    const opportunity: Omit<ValueOpportunityRecord, "organizationId"> = {
      id: "opp-all",
      title: "Persisted Value",
      category: "Customer expansion",
      potentialValue: 15_000,
      confidence: 80,
      evidence: "integration-test",
      sourceEntityId: createdCustomer.id,
      sourceEntityType: "Customer",
      recommendedAction: "Expand",
      expectedOutcome: "Revenue",
      realizationSpeed: "Medium",
      strategicImportance: "High",
      risk: "Low",
      status: "Validated",
      createdAt: now(),
      updatedAt: now(),
    };
    await store.opportunitiesRepo.create(opportunity, ctx);

    const captured: Omit<ValueCapturedRecord, "organizationId"> = {
      id: "captured-all",
      opportunityId: "opp-all",
      opportunityTitle: opportunity.title,
      category: "Revenue generated",
      capturedValue: 5000,
      evidenceType: "integration-test",
      evidenceDescription: "PostgreSQL persistence",
      realizationDate: "2026-09-02",
      certifiedBy: ctx.userEmail,
      auditTrail: ["created"],
      createdAt: now(),
    };
    await store.valueCapturedRepo.create(captured, ctx);

    const workflow: Omit<WorkflowRecord, "organizationId"> = {
      id: "workflow-all",
      name: "Persisted Workflow",
      description: "PostgreSQL workflow",
      subsidiary: "Enterprise",
      status: "active",
      version: 1,
      nodes: [],
      connections: [],
      runsCount: 0,
      successRate: 100,
      createdAt: now(),
      updatedAt: now(),
    };
    await store.workflowsRepo.create(workflow, ctx);

    const run: Omit<WorkflowRunRecord, "organizationId"> = {
      id: "run-all",
      workflowId: "workflow-all",
      workflowVersion: 1,
      triggeredBy: ctx.userId,
      triggerType: "manual",
      status: "completed",
      steps: [],
      contextData: {},
      startedAt: now(),
      completedAt: now(),
    };
    await store.workflowRunsRepo.create(run, ctx);

    const action: Omit<ActionRecord, "organizationId"> = {
      id: "action-all",
      recommendation: "Persist action",
      owner: ctx.userEmail,
      deadline: "2026-12-01",
      expectedValue: 1000,
      status: "Ready",
      confidence: 90,
      automationType: "Manual",
      requiresHumanApproval: true,
      insightSource: "integration-test",
      decisionDetail: "PostgreSQL",
      resultMetric: "persisted",
      logs: [],
      createdAt: now(),
      updatedAt: now(),
    };
    await store.actionsRepo.create(action, ctx);

    await store.recordAuditLog({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action: "stage4b:persist",
      resource: "Integration",
      resourceId: "all",
      requestId: ctx.requestId,
      status: "success",
      timestamp: now(),
    });

    const restart = DatabaseStore.createPostgresStore(databaseUrl);
    const required = await Promise.all([
      restart.customersRepo.findById("cust-all", ctx),
      restart.contractsRepo.findById("contract-all", ctx),
      restart.transactionsRepo.findById("txn-all", ctx),
      restart.documentsRepo.findById("doc-all", ctx),
      restart.knowledgeRepo.findById("knowledge-all", ctx),
      restart.memoryRepo.findById("memory-all", ctx),
      restart.signalsRepo.findById("signal-all", ctx),
      restart.opportunitiesRepo.findById("opp-all", ctx),
      restart.valueCapturedRepo.findById("captured-all", ctx),
      restart.workflowsRepo.findById("workflow-all", ctx),
      restart.workflowRunsRepo.findById("run-all", ctx),
      restart.actionsRepo.findById("action-all", ctx),
    ]);
    if (required.length !== 12 || required.some((record) => !record)) {
      throw new Error("One or more domain records did not survive restart");
    }
    if ((await restart.auditLogsRepo.count(ctx, { where: { action: { eq: "stage4b:persist" } } })) !== 1) {
      throw new Error("Audit record did not survive restart");
    }
  });

  await check("4. Business mutation and audit rollback atomically on transaction failure", async () => {
    await store.clearPersistentStateForTesting();
    const ctx = await seedIdentity(store, "org-rollback", "usr-rollback", "rollback@example.test");
    let rejected = false;
    try {
      await store.runInTransaction(ctx, async (uow) => {
        await uow.customers.create(customer("cust-rollback", "rollback-customer@example.test"), ctx);
        await uow.recordAuditLog({
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          actorEmail: ctx.userEmail,
          action: "stage4b:rollback",
          resource: "Customer",
          resourceId: "cust-rollback",
          requestId: ctx.requestId,
          status: "success",
          timestamp: now(),
        });
        throw new Error("intentional rollback");
      });
    } catch (error: any) {
      rejected = error?.message === "intentional rollback";
    }
    if (!rejected) throw new Error("Transaction failure did not preserve the original error");

    const restart = DatabaseStore.createPostgresStore(databaseUrl);
    if ((await restart.customersRepo.count(ctx)) !== 0) throw new Error("Rolled-back business row persisted");
    if ((await restart.auditLogsRepo.count(ctx, { where: { action: { eq: "stage4b:rollback" } } })) !== 0) {
      throw new Error("Rolled-back audit row persisted");
    }
  });

  await check("5. Business mutation and audit commit atomically", async () => {
    await store.clearPersistentStateForTesting();
    const ctx = await seedIdentity(store, "org-commit", "usr-commit", "commit@example.test");
    await store.runInTransaction(ctx, async (uow) => {
      await uow.customers.create(customer("cust-commit", "commit-customer@example.test"), ctx);
      await uow.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "stage4b:commit",
        resource: "Customer",
        resourceId: "cust-commit",
        requestId: ctx.requestId,
        status: "success",
        timestamp: now(),
      });
    });
    const restart = DatabaseStore.createPostgresStore(databaseUrl);
    await restart.customersRepo.findById("cust-commit", ctx);
    if ((await restart.auditLogsRepo.count(ctx, { where: { action: { eq: "stage4b:commit" } } })) !== 1) {
      throw new Error("Committed audit row is missing");
    }
  });

  await check("6. Concurrent tenant transactions remain isolated and durable", async () => {
    await store.clearPersistentStateForTesting();
    const ctxA = await seedIdentity(store, "org-concurrent-a", "usr-concurrent-a", "a@example.test");
    const ctxB = await seedIdentity(store, "org-concurrent-b", "usr-concurrent-b", "b@example.test");

    await Promise.all(
      Array.from({ length: 8 }, (_, index) => {
        const ctx = index % 2 === 0 ? ctxA : ctxB;
        return store.runInTransaction(ctx, async (uow) => {
          const suffix = `${ctx.organizationId}-${index}`;
          await uow.customers.create(customer(`cust-${suffix}`, `${suffix}@example.test`), ctx);
          await new Promise((resolve) => setTimeout(resolve, (index % 3) * 3));
          await uow.recordAuditLog({
            organizationId: ctx.organizationId,
            actorId: ctx.userId,
            actorEmail: ctx.userEmail,
            action: "stage4b:concurrent",
            resource: "Customer",
            resourceId: `cust-${suffix}`,
            requestId: `${ctx.requestId}-${index}`,
            status: "success",
            timestamp: now(),
          });
        });
      })
    );

    const restart = DatabaseStore.createPostgresStore(databaseUrl);
    if ((await restart.customersRepo.count(ctxA)) !== 4 || (await restart.customersRepo.count(ctxB)) !== 4) {
      throw new Error("Concurrent transactions lost rows or crossed tenant boundaries");
    }
    if ((await restart.auditLogsRepo.count(ctxA, { where: { action: { eq: "stage4b:concurrent" } } })) !== 4) {
      throw new Error("Tenant A concurrent audit count is incorrect");
    }
    if ((await restart.auditLogsRepo.count(ctxB, { where: { action: { eq: "stage4b:concurrent" } } })) !== 4) {
      throw new Error("Tenant B concurrent audit count is incorrect");
    }
  });

  await check("7. PostgreSQL query boundary enforces tenant isolation", async () => {
    await store.clearPersistentStateForTesting();
    const ctxA = await seedIdentity(store, "org-tenant-a", "usr-tenant-a", "tenant-a@example.test");
    const ctxB = await seedIdentity(store, "org-tenant-b", "usr-tenant-b", "tenant-b@example.test");
    await store.customersRepo.create(customer("cust-tenant-a", "ca@example.test"), ctxA);
    await store.customersRepo.create(customer("cust-tenant-b", "cb@example.test"), ctxB);

    const pageA = await store.customersRepo.findMany(ctxA);
    if (pageA.items.length !== 1 || pageA.items[0].organizationId !== ctxA.organizationId) {
      throw new Error("Tenant A collection query returned foreign rows");
    }

    let hidden = false;
    try {
      await store.customersRepo.findById("cust-tenant-b", ctxA);
    } catch (error) {
      hidden = error instanceof NotFoundError;
    }
    if (!hidden) throw new Error("Cross-tenant ID lookup did not fail closed as NotFound");
  });

  await check("8. Production PostgreSQL repositories ignore compatibility Maps", async () => {
    await store.clearPersistentStateForTesting();
    const ctx = await seedIdentity(store, "org-map", "usr-map", "map@example.test");
    if (!store.isPostgresBacked()) throw new Error("Test store is not PostgreSQL backed");

    store.customers.set("phantom-map", {
      ...customer("phantom-map", "phantom@example.test"),
      organizationId: ctx.organizationId,
    });
    if ((await store.customersRepo.count(ctx)) !== 0) {
      throw new Error("A compatibility Map row became authoritative in PostgreSQL mode");
    }

    await store.customersRepo.create(customer("postgres-only", "postgres-only@example.test"), ctx);
    if (store.customers.has("postgres-only")) {
      throw new Error("PostgreSQL repository leaked authoritative data into compatibility Map state");
    }
  });

  await check("9. PostgreSQL relationship checks reject cross-tenant foreign references", async () => {
    await store.clearPersistentStateForTesting();
    const ctxA = await seedIdentity(store, "org-rel-a", "usr-rel-a", "rel-a@example.test");
    const ctxB = await seedIdentity(store, "org-rel-b", "usr-rel-b", "rel-b@example.test");
    await store.customersRepo.create(customer("cust-rel-b", "rel-b-customer@example.test"), ctxB);

    let rejected = false;
    try {
      await store.contractsRepo.create({
        id: "contract-cross-tenant",
        customerId: "cust-rel-b",
        title: "Invalid cross-tenant contract",
        contractValue: 100,
        startDate: "2026-01-01",
        endDate: "2027-01-01",
        renewalDaysRemaining: 100,
        status: "active",
        slaCompliance: 100,
        volatilityIndexationClause: false,
        createdAt: now(),
      }, ctxA);
    } catch (error) {
      rejected = error instanceof NotFoundError;
    }
    if (!rejected) throw new Error("Cross-tenant foreign relationship was accepted");
  });

  await check("10. Entity IDs remain unique under concurrent inserts", async () => {
    await store.clearPersistentStateForTesting();
    const ctx = await seedIdentity(store, "org-unique", "usr-unique", "unique@example.test");
    const attempts = await Promise.allSettled([
      store.customersRepo.create(customer("cust-unique", "unique-1@example.test"), ctx),
      store.customersRepo.create(customer("cust-unique", "unique-2@example.test"), ctx),
    ]);
    const fulfilled = attempts.filter((result) => result.status === "fulfilled").length;
    const rejected = attempts.filter((result) => result.status === "rejected").length;
    if (fulfilled !== 1 || rejected !== 1) throw new Error("Concurrent duplicate entity IDs were not serialized by PostgreSQL uniqueness");
    const reason = (attempts.find((result) => result.status === "rejected") as PromiseRejectedResult).reason;
    if (!(reason instanceof ConflictError)) throw new Error("Duplicate entity ID did not preserve ConflictError semantics");
  });

  await check("11. Authentication resolves durable PostgreSQL identity without Map authority", async () => {
    await store.clearPersistentStateForTesting();
    const password = "ApexPostgres2026!";
    await store.createOrganizationRecord(organization("org-auth-pg"));
    await store.createUserRecord(user("usr-auth-pg", "auth-pg@example.test", password));
    await store.createMembershipRecord(membership("mem-auth-pg", "org-auth-pg", "usr-auth-pg"));

    if (store.users.size !== 0 || store.memberships.size !== 0 || store.organizations.size !== 0) {
      throw new Error("PostgreSQL identity records were copied into compatibility Maps");
    }

    const sessionStore = new InMemorySessionStore();
    const provider = new LocalAuthenticationProvider(sessionStore, store);
    const authenticated = await provider.authenticateCredentials("AUTH-PG@example.test", password);
    if (authenticated.session.userId !== "usr-auth-pg" || authenticated.session.organizationId !== "org-auth-pg") {
      throw new Error("Authentication did not resolve PostgreSQL identity/membership authority");
    }
  });

  await check("12. Password credential mutation and audit share the PostgreSQL transaction boundary", async () => {
    await store.clearPersistentStateForTesting();
    const ctx = await seedIdentity(store, "org-password", "usr-password", "password@example.test");
    const before = await store.findUserById(ctx.userId);
    if (!before) throw new Error("Password test user missing");

    let rolledBack = false;
    try {
      await store.runInTransaction(ctx, async (uow) => {
        await store.updateUserPasswordCredentials(ctx.userId, ctx.organizationId, {
          passwordHash: "replacement-hash",
          passwordSalt: "replacement-salt",
        });
        await uow.recordAuditLog({
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          actorEmail: ctx.userEmail,
          action: "stage4b:password-rollback",
          resource: "User",
          resourceId: ctx.userId,
          requestId: ctx.requestId,
          status: "success",
          timestamp: now(),
        });
        throw new Error("rollback-password");
      });
    } catch (error: any) {
      rolledBack = error?.message === "rollback-password";
    }
    if (!rolledBack) throw new Error("Password rollback test did not reject");

    const restart = DatabaseStore.createPostgresStore(databaseUrl);
    const after = await restart.findUserById(ctx.userId);
    if (!after || after.passwordHash !== before.passwordHash || after.passwordSalt !== before.passwordSalt) {
      throw new Error("Rolled-back password credentials persisted");
    }
    if ((await restart.auditLogsRepo.count(ctx, { where: { action: { eq: "stage4b:password-rollback" } } })) !== 0) {
      throw new Error("Rolled-back password audit persisted");
    }
  });

  const failed = results.filter((result) => !result.passed);
  console.log("================================================================================");
  console.log("APEX ONE — STAGE 4B POSTGRESQL PERSISTENCE INTEGRATION");
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
  console.error("FATAL POSTGRESQL INTEGRATION ERROR", error);
  process.exit(1);
});
