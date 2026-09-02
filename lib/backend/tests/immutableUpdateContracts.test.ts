/**
 * APEX ONE — Immutable Update Contract Hardening Suite
 *
 * These tests intentionally use findById rather than collection reads so
 * immutable-field guarantees are tested independently of pagination shape.
 */

import { DatabaseStore } from "../database/store";
import { TenantContext } from "../core/errors";
import {
  UpdateCustomerInput,
  UpdateContractInput,
  UpdateTransactionInput,
  UpdateSignalInput,
  UpdateWorkflowRunInput,
} from "../database/schema";

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
  durationMs?: number;
}

export interface TestSuiteSummary {
  total: number;
  passedCount: number;
  failedCount: number;
  results: TestResult[];
}

const ctx: TenantContext = {
  organizationId: "org-apex-alpha",
  userId: "user-alpha-admin",
  userEmail: "admin@immutable.test",
  userRole: "Administrator",
  permissions: ["*"],
  requestId: "req-immutable",
};

async function createFixture() {
  const store = new DatabaseStore();
  await store.customersRepo.create({
    id: "cust-test-1",
    name: "Acme Corp",
    subsidiary: "Nigeria",
    tier: "Enterprise",
    status: "active",
    healthScore: 88,
    arr: 120000,
    contactName: "John Doe",
    contactEmail: "john@acme.test",
    since: "2023-01-01",
    growthYoY: 15,
    aiInsight: "Healthy account",
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z",
  } as any, ctx);

  await store.contractsRepo.create({
    id: "contract-test-1",
    customerId: "cust-test-1",
    title: "Enterprise MSA",
    contractValue: 120000,
    annualRecurringRevenue: 120000,
    currency: "USD",
    startDate: "2023-01-01",
    endDate: "2024-01-01",
    renewalDaysRemaining: 120,
    status: "active",
    billingCadence: "annual",
    slaCompliance: 99,
    volatilityIndexationClause: true,
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z",
  } as any, ctx);

  await store.transactionsRepo.create({
    id: "tx-test-1",
    customerId: "cust-test-1",
    type: "revenue",
    amount: 50000,
    currency: "USD",
    status: "cleared",
    reference: "INV-2023-001",
    category: "Subscription",
    date: "2023-06-01",
    createdAt: "2023-06-01T00:00:00.000Z",
    updatedAt: "2023-06-01T00:00:00.000Z",
  } as any, ctx);

  await store.signalsRepo.create({
    id: "signal-test-1",
    category: "revenue",
    severity: "medium",
    title: "Revenue Expansion Signal",
    description: "Expansion opportunity detected",
    evidence: "High usage",
    estimatedFinancialImpact: 30000,
    status: "active",
    detectedAt: "2023-07-01T00:00:00.000Z",
    createdAt: "2023-07-01T00:00:00.000Z",
    updatedAt: "2023-07-01T00:00:00.000Z",
  } as any, ctx);

  await store.workflowsRepo.create({
    id: "wf-test-1",
    name: "Account Review Workflow",
    status: "active",
    version: 1,
    steps: [],
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z",
  } as any, ctx);

  await store.workflowRunsRepo.create({
    id: "run-test-1",
    workflowId: "wf-test-1",
    workflowVersion: 1,
    triggerType: "manual",
    status: "running",
    steps: [],
    contextData: {},
    startedAt: "2023-08-01T00:00:00.000Z",
  } as any, ctx);

  return store;
}

export async function runImmutableUpdateContractsTestSuite(): Promise<TestSuiteSummary> {
  const results: TestResult[] = [];
  const run = async (testName: string, fn: () => Promise<void>) => {
    const start = performance.now();
    try {
      await fn();
      results.push({ suite: "Immutable Update Contracts", testName, passed: true, durationMs: Math.round(performance.now() - start) });
    } catch (error: any) {
      results.push({ suite: "Immutable Update Contracts", testName, passed: false, error: error?.message || String(error), durationMs: Math.round(performance.now() - start) });
    }
  };

  await run("1. Customer update cannot mutate organizationId or id even via un-typed payload", async () => {
    const store = await createFixture();
    const before = await store.customersRepo.findById("cust-test-1", ctx);
    const updated = await store.customersRepo.update(before.id, {
      name: "Renamed Safe Customer",
      organizationId: "org-hacked",
      id: "cust-hacked",
    } as unknown as UpdateCustomerInput, ctx);
    if (updated.organizationId !== ctx.organizationId || updated.id !== before.id || updated.name !== "Renamed Safe Customer") {
      throw new Error("customer immutable identity fields were not protected");
    }
  });

  await run("2. Customer update cannot mutate createdAt persistence timestamp", async () => {
    const store = await createFixture();
    const before = await store.customersRepo.findById("cust-test-1", ctx);
    const updated = await store.customersRepo.update(before.id, {
      healthScore: 95,
      createdAt: "1999-01-01T00:00:00.000Z",
    } as unknown as UpdateCustomerInput, ctx);
    if (updated.createdAt !== before.createdAt || updated.healthScore !== 95) {
      throw new Error("createdAt mutation defense failed");
    }
  });

  await run("3. Repository adapter manages updatedAt; caller cannot forge timestamp", async () => {
    const store = await createFixture();
    const before = await store.customersRepo.findById("cust-test-1", ctx);
    const forged = "2010-05-15T12:00:00.000Z";
    const start = Date.now();
    const updated = await store.customersRepo.update(before.id, {
      tier: "Enterprise",
      updatedAt: forged,
    } as unknown as UpdateCustomerInput, ctx);
    const end = Date.now();
    const actual = Date.parse(updated.updatedAt);
    if (updated.updatedAt === forged || actual < start - 100 || actual > end + 100) {
      throw new Error("updatedAt remained caller-controlled");
    }
  });

  await run("4. Nullable fields preserve null values without coercion", async () => {
    const store = await createFixture();
    const updated = await store.customersRepo.update("cust-test-1", {
      subsidiary: null,
      since: null,
      growthYoY: null,
      aiInsight: null,
    }, ctx);
    if (updated.subsidiary !== null || updated.since !== null || updated.growthYoY !== null || updated.aiInsight !== null) {
      throw new Error("nullable update semantics were not preserved");
    }
  });

  await run("5. Contract update cannot mutate id or organizationId", async () => {
    const store = await createFixture();
    const before = await store.contractsRepo.findById("contract-test-1", ctx);
    const updated = await store.contractsRepo.update(before.id, {
      title: "Updated Contract Title",
      organizationId: "org-hacked",
      id: "contract-hacked",
    } as unknown as UpdateContractInput, ctx);
    if (updated.id !== before.id || updated.organizationId !== ctx.organizationId || updated.title !== "Updated Contract Title") {
      throw new Error("contract immutable identity fields were not protected");
    }
  });

  await run("6. Transaction update cannot mutate id or organizationId", async () => {
    const store = await createFixture();
    const before = await store.transactionsRepo.findById("tx-test-1", ctx);
    const updated = await store.transactionsRepo.update(before.id, {
      status: "cleared",
      organizationId: "org-hacked",
      id: "tx-hacked",
    } as unknown as UpdateTransactionInput, ctx);
    if (updated.id !== before.id || updated.organizationId !== ctx.organizationId) {
      throw new Error("transaction immutable identity fields were not protected");
    }
  });

  await run("7. Signal update cannot mutate detectedAt initial detection timestamp", async () => {
    const store = await createFixture();
    const before = await store.signalsRepo.findById("signal-test-1", ctx);
    const updated = await store.signalsRepo.update(before.id, {
      severity: "critical",
      detectedAt: "2000-01-01T00:00:00.000Z",
    } as unknown as UpdateSignalInput, ctx);
    if (updated.detectedAt !== before.detectedAt) throw new Error("detectedAt was mutated");
  });

  await run("8. WorkflowRun update cannot mutate startedAt timestamp", async () => {
    const store = await createFixture();
    const before = await store.workflowRunsRepo.findById("run-test-1", ctx);
    const updated = await store.workflowRunsRepo.update(before.id, {
      status: "completed",
      startedAt: "2005-01-01T00:00:00.000Z",
    } as unknown as UpdateWorkflowRunInput, ctx);
    if (updated.startedAt !== before.startedAt) throw new Error("startedAt was mutated");
  });

  const passedCount = results.filter((result) => result.passed).length;
  const failedCount = results.length - passedCount;
  return { total: results.length, passedCount, failedCount, results };
}
