/**
 * APEX ONE — Immutable Update Contract Hardening Suite
 *
 * These tests intentionally use findById rather than collection reads so
 * immutable-field guarantees are tested independently of pagination shape.
 */

import { DatabaseStore } from "../database/store";
import { TenantContext, ValidationError } from "../core/errors";
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
  timestamp: "2026-09-02T00:00:00.000Z",
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

async function expectValidationRejection(
  work: () => Promise<unknown>,
  label: string
): Promise<void> {
  let caught: unknown;
  try {
    await work();
  } catch (error) {
    caught = error;
  }
  if (!(caught instanceof ValidationError)) {
    throw new Error(`${label} did not fail closed with ValidationError`);
  }
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

  await run("1. Customer update rejects organizationId or id mutation even via un-typed payload", async () => {
    const store = await createFixture();
    const before = await store.customersRepo.findById("cust-test-1", ctx);
    await expectValidationRejection(
      () => store.customersRepo.update(before.id, {
        name: "Renamed Unsafe Customer",
        organizationId: "org-hacked",
        id: "cust-hacked",
      } as unknown as UpdateCustomerInput, ctx),
      "customer immutable identity mutation"
    );
    const persisted = await store.customersRepo.findById(before.id, ctx);
    if (
      persisted.organizationId !== before.organizationId ||
      persisted.id !== before.id ||
      persisted.name !== before.name
    ) {
      throw new Error("rejected customer identity mutation changed persisted state");
    }
  });

  await run("2. Customer update rejects createdAt persistence timestamp mutation", async () => {
    const store = await createFixture();
    const before = await store.customersRepo.findById("cust-test-1", ctx);
    await expectValidationRejection(
      () => store.customersRepo.update(before.id, {
        healthScore: 95,
        createdAt: "1999-01-01T00:00:00.000Z",
      } as unknown as UpdateCustomerInput, ctx),
      "customer createdAt mutation"
    );
    const persisted = await store.customersRepo.findById(before.id, ctx);
    if (persisted.createdAt !== before.createdAt || persisted.healthScore !== before.healthScore) {
      throw new Error("rejected createdAt mutation changed persisted customer state");
    }
  });

  await run("3. Repository adapter rejects caller-forged updatedAt timestamp", async () => {
    const store = await createFixture();
    const before = await store.customersRepo.findById("cust-test-1", ctx);
    const forged = "2010-05-15T12:00:00.000Z";
    await expectValidationRejection(
      () => store.customersRepo.update(before.id, {
        tier: "Enterprise",
        updatedAt: forged,
      } as unknown as UpdateCustomerInput, ctx),
      "customer updatedAt mutation"
    );
    const persisted = await store.customersRepo.findById(before.id, ctx);
    if (persisted.updatedAt !== before.updatedAt) {
      throw new Error("rejected updatedAt mutation changed repository-controlled timestamp");
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

  await run("5. Contract update rejects id or organizationId mutation", async () => {
    const store = await createFixture();
    const before = await store.contractsRepo.findById("contract-test-1", ctx);
    await expectValidationRejection(
      () => store.contractsRepo.update(before.id, {
        title: "Unsafe Contract Title",
        organizationId: "org-hacked",
        id: "contract-hacked",
      } as unknown as UpdateContractInput, ctx),
      "contract immutable identity mutation"
    );
    const persisted = await store.contractsRepo.findById(before.id, ctx);
    if (
      persisted.id !== before.id ||
      persisted.organizationId !== before.organizationId ||
      persisted.title !== before.title
    ) {
      throw new Error("rejected contract identity mutation changed persisted state");
    }
  });

  await run("6. Transaction update rejects id or organizationId mutation", async () => {
    const store = await createFixture();
    const before = await store.transactionsRepo.findById("tx-test-1", ctx);
    await expectValidationRejection(
      () => store.transactionsRepo.update(before.id, {
        status: "cleared",
        organizationId: "org-hacked",
        id: "tx-hacked",
      } as unknown as UpdateTransactionInput, ctx),
      "transaction immutable identity mutation"
    );
    const persisted = await store.transactionsRepo.findById(before.id, ctx);
    if (
      persisted.id !== before.id ||
      persisted.organizationId !== before.organizationId ||
      persisted.status !== before.status
    ) {
      throw new Error("rejected transaction identity mutation changed persisted state");
    }
  });

  await run("7. Signal update rejects detectedAt initial detection timestamp mutation", async () => {
    const store = await createFixture();
    const before = await store.signalsRepo.findById("signal-test-1", ctx);
    await expectValidationRejection(
      () => store.signalsRepo.update(before.id, {
        severity: "critical",
        detectedAt: "2000-01-01T00:00:00.000Z",
      } as unknown as UpdateSignalInput, ctx),
      "signal detectedAt mutation"
    );
    const persisted = await store.signalsRepo.findById(before.id, ctx);
    if (persisted.detectedAt !== before.detectedAt || persisted.severity !== before.severity) {
      throw new Error("rejected detectedAt mutation changed persisted signal state");
    }
  });

  await run("8. WorkflowRun update rejects startedAt initial lifecycle timestamp mutation", async () => {
    const store = await createFixture();
    const before = await store.workflowRunsRepo.findById("run-test-1", ctx);
    await expectValidationRejection(
      () => store.workflowRunsRepo.update(before.id, {
        status: "waiting_approval",
        startedAt: "2005-01-01T00:00:00.000Z",
      } as unknown as UpdateWorkflowRunInput, ctx),
      "workflow run startedAt mutation"
    );
    const persisted = await store.workflowRunsRepo.findById(before.id, ctx);
    if (persisted.startedAt !== before.startedAt || persisted.status !== before.status) {
      throw new Error("rejected startedAt mutation changed persisted workflow-run state");
    }
  });

  const passedCount = results.filter((result) => result.passed).length;
  const failedCount = results.length - passedCount;
  return { total: results.length, passedCount, failedCount, results };
}