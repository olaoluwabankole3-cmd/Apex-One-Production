/**
 * APEX ONE — Immutable Update Fields & Contract Hardening Test Suite
 * 
 * Verifies that repository update contracts strictly defend against mutation
 * of immutable persistence fields (id, organizationId, createdAt, etc.),
 * both at compile-time and through defense-in-depth runtime stripping.
 */

import { DatabaseStore } from "../database/store";
import { ProductionDataProvider } from "../database/demoDataProvider";
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

export async function runImmutableUpdateContractsTestSuite(): Promise<TestSuiteSummary> {
  const results: TestResult[] = [];

  const runTest = async (name: string, fn: () => Promise<void>) => {
    const t0 = performance.now();
    try {
      await fn();
      results.push({
        suite: "Immutable Update Contracts",
        testName: name,
        passed: true,
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (err: any) {
      results.push({
        suite: "Immutable Update Contracts",
        testName: name,
        passed: false,
        error: err?.message || String(err),
        durationMs: Math.round(performance.now() - t0),
      });
    }
  };

  const createFreshStore = async (): Promise<{ store: DatabaseStore; ctxA: TenantContext; ctxB: TenantContext }> => {
    const store = new DatabaseStore();

    const ctxA: TenantContext = {
      organizationId: "org-apex-alpha",
      userId: "user-alpha-admin",
      userEmail: "elena.rostova@apex-enterprises.com",
      userRole: "admin",
      clientIp: "127.0.0.1",
      userAgent: "Security-Test-Agent",
      requestId: "req_test_immutable_a",
      correlationId: "corr_test_immutable_a",
    };

    const ctxB: TenantContext = {
      organizationId: "org-apex-beta",
      userId: "user-beta-admin",
      userEmail: "marcus.vance@vanguard.io",
      userRole: "admin",
      clientIp: "127.0.0.1",
      userAgent: "Security-Test-Agent",
      requestId: "req_test_immutable_b",
      correlationId: "corr_test_immutable_b",
    };

    // Seed test customer
    await store.customersRepo.create(
      {
        id: "cust-test-1",
        name: "Acme Corp",
        subsidiary: "Nigeria",
        tier: "Enterprise",
        status: "active",
        healthScore: 88,
        arr: 120000,
        owner: "user-alpha-admin",
        contactName: "John Doe",
        contactRole: "CTO",
        contactEmail: "john@acme.test",
        since: "2023-01-01",
        tags: ["enterprise"],
        industry: "Finance",
        growthYoY: 15,
        engagementLevel: 90,
        contractStatus: "Active",
        supportActivity: "Normal",
        supportTickets: 2,
        paymentBehavior: "Pristine",
        paymentStatus: "pristine",
        riskLevel: "Low",
        riskScore: 10,
        riskReason: null,
        expansionPotential: "High",
        potentialArrNaira: 200000,
        opportunityNaira: 50000,
        opportunityReason: "Expansion",
        riskReasons: [],
        aiInsight: "Healthy account",
        recommendedAction: "Upsell",
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
      },
      ctxA
    );

    // Seed test contract
    await store.contractsRepo.create(
      {
        id: "contract-test-1",
        customerId: "cust-test-1",
        title: "Enterprise Master Service Agreement",
        contractValue: 120000,
        startDate: "2023-01-01",
        endDate: "2024-01-01",
        renewalDaysRemaining: 120,
        status: "active",
        slaCompliance: 99,
        volatilityIndexationClause: true,
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
      },
      ctxA
    );

    // Seed test transaction
    await store.transactionsRepo.create(
      {
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
      },
      ctxA
    );

    // Seed test signal
    await store.signalsRepo.create(
      {
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
      },
      ctxA
    );

    // Seed test workflow and run
    await store.workflowsRepo.create(
      {
        id: "wf-test-1",
        name: "Account Review Workflow",
        description: "Quarterly review",
        subsidiary: "Nigeria",
        status: "active",
        version: 1,
        nodes: [],
        connections: [],
        runsCount: 1,
        successRate: 100,
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
      },
      ctxA
    );

    await store.workflowRunsRepo.create(
      {
        id: "run-test-1",
        workflowId: "wf-test-1",
        workflowVersion: 1,
        triggeredBy: "user-alpha-admin",
        triggerType: "manual",
        status: "running",
        steps: [],
        contextData: {},
        startedAt: "2023-08-01T00:00:00.000Z",
      },
      ctxA
    );

    return { store, ctxA, ctxB };
  };

  console.log("📦 IMMUTABLE UPDATE CONTRACTS SUITE");
  console.log("--------------------------------------------------------------------------------");

  // -------------------------------------------------------------
  // TEST 1: Customer update cannot mutate organizationId or id
  // -------------------------------------------------------------
  await runTest(
    "1. Customer update cannot mutate organizationId or id even via un-typed payload",
    async () => {
      const { store, ctxA } = await createFreshStore();
      const customers = await store.customersRepo.findMany(ctxA);
      const target = customers[0];

      const maliciousPayload = {
        name: "Renamed Safe Customer",
        organizationId: "org_hacked_tenant",
        id: "cust_malicious_override",
      } as unknown as UpdateCustomerInput;

      const updated = await store.customersRepo.update(target.id, maliciousPayload, ctxA);

      if (updated.organizationId !== ctxA.organizationId) {
        throw new Error(`organizationId was mutated! Expected ${ctxA.organizationId}, got ${updated.organizationId}`);
      }
      if (updated.id !== target.id) {
        throw new Error(`id was mutated! Expected ${target.id}, got ${updated.id}`);
      }
      if (updated.name !== "Renamed Safe Customer") {
        throw new Error(`Valid field update failed! Expected "Renamed Safe Customer", got ${updated.name}`);
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 2: Customer update cannot mutate createdAt
  // -------------------------------------------------------------
  await runTest(
    "2. Customer update cannot mutate createdAt persistence timestamp",
    async () => {
      const { store, ctxA } = await createFreshStore();
      const customers = await store.customersRepo.findMany(ctxA);
      const target = customers[0];
      const originalCreatedAt = target.createdAt;

      const maliciousPayload = {
        healthScore: 95,
        createdAt: "1999-01-01T00:00:00.000Z",
      } as unknown as UpdateCustomerInput;

      const updated = await store.customersRepo.update(target.id, maliciousPayload, ctxA);

      if (updated.createdAt !== originalCreatedAt) {
        throw new Error(`createdAt was mutated! Expected ${originalCreatedAt}, got ${updated.createdAt}`);
      }
      if (updated.healthScore !== 95) {
        throw new Error(`Valid healthScore update failed! Expected 95, got ${updated.healthScore}`);
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 3: Repository adapter sets and manages updatedAt reliably
  // -------------------------------------------------------------
  await runTest(
    "3. Repository adapter manages updatedAt; caller cannot forge past/future updatedAt timestamp",
    async () => {
      const { store, ctxA } = await createFreshStore();
      const customers = await store.customersRepo.findMany(ctxA);
      const target = customers[0];
      const forgedDate = "2010-05-15T12:00:00.000Z";

      const maliciousPayload = {
        tier: "Enterprise" as const,
        updatedAt: forgedDate,
      } as unknown as UpdateCustomerInput;

      const beforeTime = new Date().getTime();
      const updated = await store.customersRepo.update(target.id, maliciousPayload, ctxA);
      const afterTime = new Date().getTime();

      const actualUpdatedTime = new Date(updated.updatedAt).getTime();

      if (updated.updatedAt === forgedDate) {
        throw new Error(`Caller was able to forge updatedAt timestamp!`);
      }
      if (actualUpdatedTime < beforeTime - 50 || actualUpdatedTime > afterTime + 50) {
        throw new Error(`updatedAt timestamp ${updated.updatedAt} is not near current execution time!`);
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 4: Nullable fields preserve null semantics during updates
  // -------------------------------------------------------------
  await runTest(
    "4. Nullable fields preserve null values without coercing to undefined or default strings",
    async () => {
      const { store, ctxA } = await createFreshStore();
      const customers = await store.customersRepo.findMany(ctxA);
      const target = customers[0];

      const nullableUpdate: UpdateCustomerInput = {
        subsidiary: null,
        since: null,
        growthYoY: null,
        aiInsight: null,
      };

      const updated = await store.customersRepo.update(target.id, nullableUpdate, ctxA);

      if (updated.subsidiary !== null) {
        throw new Error(`subsidiary expected null, got ${updated.subsidiary}`);
      }
      if (updated.since !== null) {
        throw new Error(`since expected null, got ${updated.since}`);
      }
      if (updated.growthYoY !== null) {
        throw new Error(`growthYoY expected null, got ${updated.growthYoY}`);
      }
      if (updated.aiInsight !== null) {
        throw new Error(`aiInsight expected null, got ${updated.aiInsight}`);
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 5: Contract update cannot mutate id or organizationId
  // -------------------------------------------------------------
  await runTest(
    "5. Contract update cannot mutate id or organizationId",
    async () => {
      const { store, ctxA } = await createFreshStore();
      const contracts = await store.contractsRepo.findMany(ctxA);
      const target = contracts[0];

      const maliciousPayload = {
        title: "Updated Contract Title",
        organizationId: "org_zenith_test",
        id: "contract_hacked",
      } as unknown as UpdateContractInput;

      const updated = await store.contractsRepo.update(target.id, maliciousPayload, ctxA);

      if (updated.organizationId !== ctxA.organizationId) {
        throw new Error(`Contract organizationId was mutated!`);
      }
      if (updated.id !== target.id) {
        throw new Error(`Contract id was mutated!`);
      }
      if (updated.title !== "Updated Contract Title") {
        throw new Error(`Contract title update failed!`);
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 6: Transaction update cannot mutate id or organizationId
  // -------------------------------------------------------------
  await runTest(
    "6. Transaction update cannot mutate id or organizationId",
    async () => {
      const { store, ctxA } = await createFreshStore();
      const txs = await store.transactionsRepo.findMany(ctxA);
      const target = txs[0];

      const maliciousPayload = {
        status: "cleared" as const,
        organizationId: "org_zenith_test",
        id: "tx_hacked",
      } as unknown as UpdateTransactionInput;

      const updated = await store.transactionsRepo.update(target.id, maliciousPayload, ctxA);

      if (updated.organizationId !== ctxA.organizationId) {
        throw new Error(`Transaction organizationId was mutated!`);
      }
      if (updated.id !== target.id) {
        throw new Error(`Transaction id was mutated!`);
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 7: Signal update cannot mutate detectedAt timestamp
  // -------------------------------------------------------------
  await runTest(
    "7. Signal update cannot mutate detectedAt initial detection timestamp",
    async () => {
      const { store, ctxA } = await createFreshStore();
      const signals = await store.signalsRepo.findMany(ctxA);
      const target = signals[0];
      const originalDetectedAt = target.detectedAt;

      const maliciousPayload = {
        severity: "critical" as const,
        detectedAt: "2000-01-01T00:00:00.000Z",
      } as unknown as UpdateSignalInput;

      const updated = await store.signalsRepo.update(target.id, maliciousPayload, ctxA);

      if (updated.detectedAt !== originalDetectedAt) {
        throw new Error(`Signal detectedAt was mutated! Expected ${originalDetectedAt}, got ${updated.detectedAt}`);
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 8: WorkflowRun update cannot mutate startedAt timestamp
  // -------------------------------------------------------------
  await runTest(
    "8. WorkflowRun update cannot mutate startedAt timestamp",
    async () => {
      const { store, ctxA } = await createFreshStore();
      const runs = await store.workflowRunsRepo.findMany(ctxA);
      const target = runs[0];
      const originalStartedAt = target.startedAt;

      const maliciousPayload = {
        status: "completed" as const,
        startedAt: "2005-01-01T00:00:00.000Z",
      } as unknown as UpdateWorkflowRunInput;

      const updated = await store.workflowRunsRepo.update(target.id, maliciousPayload, ctxA);

      if (updated.startedAt !== originalStartedAt) {
        throw new Error(`WorkflowRun startedAt was mutated! Expected ${originalStartedAt}, got ${updated.startedAt}`);
      }
    }
  );

  for (const r of results) {
    console.log(`  ${r.passed ? "✅ [PASS]" : "❌ [FAIL]"} ${r.testName} (${r.durationMs}ms)`);
    if (!r.passed && r.error) {
      console.log(`     Error: ${r.error}`);
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passedCount,
    failedCount,
    results,
  };
}
