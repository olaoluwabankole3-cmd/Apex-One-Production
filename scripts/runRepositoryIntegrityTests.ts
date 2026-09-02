/**
 * APEX ONE — Stage 5 transaction and repository integrity verification.
 *
 * Exercises both deterministic in-memory semantics and the real PostgreSQL
 * authority so local/test behavior cannot diverge from production integrity.
 */

import { DatabaseStore } from "../lib/backend/database/store";
import type { IDataProvider } from "../lib/backend/database/demoDataProvider";
import {
  ActionRecord,
  CustomerRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
  WorkflowRecord,
  WorkflowRunRecord,
} from "../lib/backend/database/schema";
import {
  ConflictError,
  CrossTenantViolationError,
  InvalidStateTransitionError,
  TenantContext,
  ValidationError,
} from "../lib/backend/core/errors";

interface CheckResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: CheckResult[] = [];
const EMPTY_PROVIDER: IDataProvider = { seedInitialTenants: () => undefined };

function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required for Stage 5 repository integrity tests");
  return value;
}

function now(): string {
  return new Date().toISOString();
}

function ctx(org: string, user: string, email: string): TenantContext {
  return {
    organizationId: org,
    userId: user,
    userEmail: email,
    userRole: "CEO",
    permissions: [
      "org:read",
      "org:write",
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
      "action:cancel",
      "audit:read",
    ],
    requestId: `req-${org}-${Math.random().toString(36).slice(2)}`,
    timestamp: now(),
  };
}

function organization(id: string, slug = id): OrganizationRecord {
  return {
    id,
    name: `${id} Holdings`,
    displayName: id,
    slug,
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
    title: "Integrity Tester",
    status: "active",
    createdAt: now(),
  };
}

function membership(id: string, organizationId: string, userId: string): OrganizationMembershipRecord {
  return {
    id,
    organizationId,
    userId,
    role: "CEO",
    department: "Engineering",
    joinedAt: now(),
  };
}

function customer(id: string): Omit<CustomerRecord, "organizationId"> {
  const timestamp = now();
  return {
    id,
    name: id,
    tier: "Enterprise",
    status: "active",
    healthScore: 90,
    arr: 100_000,
    owner: "Integrity Owner",
    contactName: "Integrity Contact",
    contactRole: "Director",
    contactEmail: `${id}@example.test`,
    tags: ["stage5"],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function workflow(id: string): Omit<WorkflowRecord, "organizationId"> {
  const timestamp = now();
  return {
    id,
    name: id,
    description: "Stage 5 concurrency workflow",
    subsidiary: "Operations",
    status: "active",
    version: 1,
    nodes: [],
    connections: [],
    runsCount: 0,
    successRate: 100,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function action(id: string): Omit<ActionRecord, "organizationId"> {
  const timestamp = now();
  return {
    id,
    recommendation: "Validate Stage 5 repository lifecycle integrity",
    owner: "Integrity Owner",
    deadline: "2026-12-31",
    expectedValue: 1000,
    status: "Ready",
    confidence: 99,
    automationType: "Manual",
    requiresHumanApproval: true,
    insightSource: "Stage 5 test",
    decisionDetail: "Lifecycle verification",
    resultMetric: "Integrity",
    logs: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function workflowRun(
  id: string,
  workflowId: string,
  triggeredBy: string
): Omit<WorkflowRunRecord, "organizationId"> {
  return {
    id,
    workflowId,
    workflowVersion: 1,
    triggeredBy,
    triggerType: "manual",
    status: "running",
    steps: [],
    contextData: {},
    startedAt: now(),
  };
}

async function seedIdentity(
  store: DatabaseStore,
  organizationId: string,
  userId: string,
  email: string
): Promise<TenantContext> {
  await store.createOrganizationRecord(organization(organizationId));
  await store.createUserRecord(user(userId, email));
  await store.createMembershipRecord(
    membership(`membership-${organizationId}-${userId}`, organizationId, userId)
  );
  return ctx(organizationId, userId, email);
}

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      error: error?.stack || error?.message || String(error),
    });
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function expectError<T extends Error>(
  work: () => Promise<unknown>,
  type: new (...args: any[]) => T,
  label: string
): Promise<T> {
  try {
    await work();
  } catch (error) {
    if (error instanceof type) return error;
    throw new Error(`${label} threw ${error instanceof Error ? error.constructor.name : String(error)} instead of ${type.name}`);
  }
  throw new Error(`${label} did not throw ${type.name}`);
}

async function main(): Promise<void> {
  const pgUrl = databaseUrl();

  await check("1. Concurrent in-memory top-level transactions no longer share global nested state", async () => {
    const store = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
    const a = await seedIdentity(store, "org-memory-a", "user-memory-a", "memory-a@example.test");
    const b = await seedIdentity(store, "org-memory-b", "user-memory-b", "memory-b@example.test");
    const entered = deferred();
    const release = deferred();
    let secondEntered = false;

    const first = store.runInTransaction(a, async (uow) => {
      await uow.customers.create(customer("cust-memory-a"), uow.context);
      entered.resolve();
      await release.promise;
    });
    await entered.promise;

    const second = store.runInTransaction(b, async (uow) => {
      secondEntered = true;
      await uow.customers.create(customer("cust-memory-b"), uow.context);
    });

    await new Promise((resolve) => setTimeout(resolve, 25));
    if (secondEntered) throw new Error("Second top-level memory transaction bypassed serialization lock");
    release.resolve();
    await Promise.all([first, second]);

    if (!(await store.customersRepo.findById("cust-memory-a", a))) throw new Error("First transaction missing");
    if (!(await store.customersRepo.findById("cust-memory-b", b))) throw new Error("Second transaction missing");
  });

  await check("2. In-memory rollback cannot erase a concurrently queued committed transaction", async () => {
    const store = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
    const context = await seedIdentity(store, "org-memory-rollback", "user-memory-rollback", "rollback@example.test");
    const entered = deferred();
    const release = deferred();

    const failing = store.runInTransaction(context, async (uow) => {
      await uow.customers.create(customer("cust-rolled-back"), uow.context);
      entered.resolve();
      await release.promise;
      throw new Error("injected rollback");
    });
    await entered.promise;

    const committed = store.runInTransaction(context, async (uow) => {
      await uow.customers.create(customer("cust-committed-after-rollback"), uow.context);
    });
    release.resolve();
    await Promise.allSettled([failing, committed]);

    if (store.customers.has("cust-rolled-back")) throw new Error("Rolled-back memory record survived");
    await store.customersRepo.findById("cust-committed-after-rollback", context);
  });

  await check("3. Nested same-tenant memory work is atomic and nested cross-tenant work fails closed", async () => {
    const store = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
    const a = await seedIdentity(store, "org-nested-a", "user-nested-a", "nested-a@example.test");
    const b = await seedIdentity(store, "org-nested-b", "user-nested-b", "nested-b@example.test");

    await expectError(
      () =>
        store.runInTransaction(a, async (outer) => {
          await outer.customers.create(customer("cust-nested-outer"), outer.context);
          await store.runInTransaction(a, async (inner) => {
            await inner.customers.create(customer("cust-nested-inner"), inner.context);
          });
          throw new Error("rollback nested unit");
        }),
      Error,
      "nested rollback"
    );
    if (store.customers.has("cust-nested-outer") || store.customers.has("cust-nested-inner")) {
      throw new Error("Nested memory transaction escaped outer rollback");
    }

    await store.runInTransaction(a, async () => {
      await expectError(
        () => store.runInTransaction(b, async () => undefined),
        CrossTenantViolationError,
        "cross-tenant nested transaction"
      );
    });
  });

  await check("4. Duplicate domain creates are ConflictError and never overwrite the original in memory", async () => {
    const store = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
    const context = await seedIdentity(store, "org-memory-duplicate", "user-memory-duplicate", "duplicate-memory@example.test");
    const original = await store.customersRepo.create(customer("cust-duplicate"), context);
    const replacement = { ...customer("cust-duplicate"), name: "SHOULD NOT REPLACE" };
    await expectError(
      () => store.customersRepo.create(replacement, context),
      ConflictError,
      "memory duplicate create"
    );
    const persisted = await store.customersRepo.findById(original.id, context);
    if (persisted.name !== original.name) throw new Error("Memory duplicate create overwrote original record");
  });

  await check("5. Memory identity uniqueness matches production slug/email/membership semantics", async () => {
    const store = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
    await seedIdentity(store, "org-memory-identity", "user-memory-identity", "CaseSensitive@example.test");
    await expectError(
      () => store.createOrganizationRecord(organization("org-memory-identity-2", " ORG-MEMORY-IDENTITY ")),
      ConflictError,
      "duplicate normalized organization slug"
    );
    await expectError(
      () => store.createUserRecord(user("user-memory-identity-2", "casesensitive@EXAMPLE.TEST")),
      ConflictError,
      "duplicate normalized user email"
    );
    await expectError(
      () =>
        store.createMembershipRecord(
          membership("membership-memory-identity-2", "org-memory-identity", "user-memory-identity")
        ),
      ConflictError,
      "duplicate organization membership"
    );
  });

  await check("6. Runtime immutable persistence-field mutation is rejected in memory", async () => {
    const store = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
    const context = await seedIdentity(store, "org-memory-immutable", "user-memory-immutable", "immutable-memory@example.test");
    const created = await store.customersRepo.create(customer("cust-memory-immutable"), context);
    await expectError(
      () => store.customersRepo.update(created.id, { createdAt: "2099-01-01" } as any, context),
      ValidationError,
      "memory immutable createdAt"
    );
  });

  await check("7. Memory lifecycle repositories reject skipped/backward and terminal mutations", async () => {
    const store = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
    const context = await seedIdentity(store, "org-memory-lifecycle", "user-memory-lifecycle", "lifecycle-memory@example.test");
    await store.actionsRepo.create(action("action-memory-lifecycle"), context);
    await expectError(
      () => store.actionsRepo.update("action-memory-lifecycle", { status: "Completed" }, context),
      InvalidStateTransitionError,
      "memory skipped Action transition"
    );

    await store.actionsRepo.update("action-memory-lifecycle", { status: "Approved" }, context);
    await store.actionsRepo.update("action-memory-lifecycle", { status: "In Progress" }, context);
    await store.actionsRepo.update("action-memory-lifecycle", { status: "Completed" }, context);
    await store.actionsRepo.update("action-memory-lifecycle", { status: "Measured" }, context);
    await expectError(
      () => store.actionsRepo.update("action-memory-lifecycle", { owner: "mutated" }, context),
      ConflictError,
      "memory terminal Action mutation"
    );
  });

  await check("8. WorkflowRun identity/lifecycle fields and terminal completion rules are enforced in memory", async () => {
    const store = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
    const context = await seedIdentity(store, "org-memory-run", "user-memory-run", "run-memory@example.test");
    await store.workflowsRepo.create(workflow("workflow-memory-run"), context);
    await store.workflowRunsRepo.create(
      workflowRun("run-memory-integrity", "workflow-memory-run", context.userEmail),
      context
    );

    await expectError(
      () =>
        store.workflowRunsRepo.update(
          "run-memory-integrity",
          { workflowId: "other-workflow" } as any,
          context
        ),
      ValidationError,
      "memory immutable WorkflowRun identity"
    );
    await expectError(
      () =>
        store.workflowRunsRepo.update(
          "run-memory-integrity",
          { completedAt: now() },
          context
        ),
      ValidationError,
      "memory non-terminal completedAt"
    );
    await store.workflowRunsRepo.update(
      "run-memory-integrity",
      { status: "completed", completedAt: now() },
      context
    );
    await expectError(
      () => store.workflowRunsRepo.update("run-memory-integrity", { contextData: { late: true } }, context),
      ConflictError,
      "memory terminal WorkflowRun mutation"
    );
  });

  await check("9. PostgreSQL duplicate creates match memory ConflictError semantics and preserve original", async () => {
    const store = DatabaseStore.createPostgresStore(pgUrl);
    await store.bootstrapPersistence();
    await store.clearPersistentStateForTesting();
    const context = await seedIdentity(store, "org-pg-duplicate", "user-pg-duplicate", "duplicate-pg@example.test");
    const original = await store.customersRepo.create(customer("cust-pg-duplicate"), context);
    await expectError(
      () =>
        store.customersRepo.create(
          { ...customer("cust-pg-duplicate"), name: "SHOULD NOT REPLACE" },
          context
        ),
      ConflictError,
      "PostgreSQL duplicate create"
    );
    const persisted = await store.customersRepo.findById(original.id, context);
    if (persisted.name !== original.name) throw new Error("PostgreSQL duplicate create replaced original record");
  });

  await check("10. PostgreSQL rejects runtime immutable fields and invalid lifecycle transitions", async () => {
    const store = DatabaseStore.createPostgresStore(pgUrl);
    await store.clearPersistentStateForTesting();
    const context = await seedIdentity(store, "org-pg-integrity", "user-pg-integrity", "integrity-pg@example.test");
    const created = await store.customersRepo.create(customer("cust-pg-immutable"), context);
    await expectError(
      () => store.customersRepo.update(created.id, { createdAt: "2099-01-01" } as any, context),
      ValidationError,
      "PostgreSQL immutable createdAt"
    );

    await store.actionsRepo.create(action("action-pg-lifecycle"), context);
    await expectError(
      () => store.actionsRepo.update("action-pg-lifecycle", { status: "Completed" }, context),
      InvalidStateTransitionError,
      "PostgreSQL skipped Action transition"
    );
  });

  await check("11. PostgreSQL WorkflowRun identity and terminal lifecycle are immutable", async () => {
    const store = DatabaseStore.createPostgresStore(pgUrl);
    await store.clearPersistentStateForTesting();
    const context = await seedIdentity(store, "org-pg-run", "user-pg-run", "run-pg@example.test");
    await store.workflowsRepo.create(workflow("workflow-pg-run"), context);
    await store.workflowRunsRepo.create(workflowRun("run-pg-integrity", "workflow-pg-run", context.userEmail), context);

    await expectError(
      () => store.workflowRunsRepo.update("run-pg-integrity", { workflowVersion: 99 } as any, context),
      ValidationError,
      "PostgreSQL immutable WorkflowRun version"
    );
    await expectError(
      () => store.workflowRunsRepo.update("run-pg-integrity", { completedAt: now() }, context),
      ValidationError,
      "PostgreSQL non-terminal completedAt"
    );
    await store.workflowRunsRepo.update(
      "run-pg-integrity",
      { status: "completed", completedAt: now() },
      context
    );
    await expectError(
      () => store.workflowRunsRepo.update("run-pg-integrity", { contextData: { late: true } }, context),
      ConflictError,
      "PostgreSQL terminal WorkflowRun mutation"
    );
  });

  await check("12. Concurrent PostgreSQL workflow revisions allow one winner and reject stale lost update", async () => {
    const seed = DatabaseStore.createPostgresStore(pgUrl);
    await seed.clearPersistentStateForTesting();
    const context = await seedIdentity(seed, "org-pg-version", "user-pg-version", "version-pg@example.test");
    await seed.workflowsRepo.create(workflow("workflow-pg-version"), context);

    const storeA = DatabaseStore.createPostgresStore(pgUrl);
    const storeB = DatabaseStore.createPostgresStore(pgUrl);
    const barrier = deferred();
    let reads = 0;

    const contender = async (store: DatabaseStore, name: string) =>
      store.runInTransaction(context, async (uow) => {
        const existing = await uow.workflows.findById("workflow-pg-version", uow.context);
        reads += 1;
        if (reads === 2) barrier.resolve();
        await barrier.promise;
        return uow.workflows.update(
          existing.id,
          { name, version: existing.version + 1 },
          uow.context
        );
      });

    const settled = await Promise.allSettled([
      contender(storeA, "winner-a"),
      contender(storeB, "winner-b"),
    ]);
    const fulfilled = settled.filter((result) => result.status === "fulfilled");
    const rejected = settled.filter((result) => result.status === "rejected") as PromiseRejectedResult[];
    if (fulfilled.length !== 1 || rejected.length !== 1) {
      throw new Error(`Expected one workflow update winner and one conflict; got ${fulfilled.length}/${rejected.length}`);
    }
    if (!(rejected[0].reason instanceof ConflictError)) {
      throw new Error(`Losing concurrent workflow update was not canonical ConflictError: ${String(rejected[0].reason)}`);
    }
    const persisted = await seed.workflowsRepo.findById("workflow-pg-version", context);
    if (persisted.version !== 2) throw new Error(`Expected workflow version 2, received ${persisted.version}`);
  });

  await check("13. Concurrent PostgreSQL runsCount increments cannot silently lose one writer", async () => {
    const seed = DatabaseStore.createPostgresStore(pgUrl);
    await seed.clearPersistentStateForTesting();
    const context = await seedIdentity(seed, "org-pg-counter", "user-pg-counter", "counter-pg@example.test");
    await seed.workflowsRepo.create(workflow("workflow-pg-counter"), context);

    const storeA = DatabaseStore.createPostgresStore(pgUrl);
    const storeB = DatabaseStore.createPostgresStore(pgUrl);
    const barrier = deferred();
    let reads = 0;

    const increment = async (store: DatabaseStore) =>
      store.runInTransaction(context, async (uow) => {
        const existing = await uow.workflows.findById("workflow-pg-counter", uow.context);
        reads += 1;
        if (reads === 2) barrier.resolve();
        await barrier.promise;
        return uow.workflows.update(
          existing.id,
          { runsCount: existing.runsCount + 1 },
          uow.context
        );
      });

    const firstRound = await Promise.allSettled([increment(storeA), increment(storeB)]);
    if (firstRound.filter((result) => result.status === "fulfilled").length !== 1) {
      throw new Error("Concurrent runsCount writers did not produce exactly one initial winner");
    }
    const loser = firstRound.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
    if (!loser || !(loser.reason instanceof ConflictError)) {
      throw new Error("Stale runsCount writer did not receive canonical ConflictError");
    }

    const afterFirst = await seed.workflowsRepo.findById("workflow-pg-counter", context);
    if (afterFirst.runsCount !== 1) throw new Error(`Lost-update guard expected runsCount=1, got ${afterFirst.runsCount}`);

    await storeB.workflowsRepo.update(
      "workflow-pg-counter",
      { runsCount: afterFirst.runsCount + 1 },
      context
    );
    const afterRetry = await seed.workflowsRepo.findById("workflow-pg-counter", context);
    if (afterRetry.runsCount !== 2) throw new Error(`Fresh retry did not converge runsCount to 2; got ${afterRetry.runsCount}`);
  });

  console.log("=".repeat(80));
  console.log("APEX ONE — STAGE 5 TRANSACTION / REPOSITORY INTEGRITY");
  console.log("=".repeat(80));
  for (const [index, result] of results.entries()) {
    console.log(`${result.passed ? "✅ [PASS]" : "❌ [FAIL]"} ${index + 1}. ${result.name.replace(/^\d+\.\s*/, "")}`);
    if (!result.passed && result.error) console.log(result.error);
  }
  const passed = results.filter((result) => result.passed).length;
  console.log("-".repeat(80));
  console.log(`TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${results.length - passed}`);
  console.log("=".repeat(80));
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
