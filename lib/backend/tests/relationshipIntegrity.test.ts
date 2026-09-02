/**
 * APEX ONE — Relationship Integrity Test Suite
 *
 * Verifies that all tenant-owned entity relationships are validated for both
 * existence and same-organization tenant ownership before persistence on
 * create and update operations.
 */

import { DatabaseStore } from "../database/store";
import {
  TenantContext,
  NotFoundError,
  CrossTenantViolationError,
  ValidationError,
} from "../core/errors";
import type {
  ContractRecord,
  ValueOpportunityRecord,
} from "../database/schema";

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
  durationMs?: number;
}

export interface SuiteSummary {
  suiteName: string;
  total: number;
  passedCount: number;
  failedCount: number;
  results: TestResult[];
}

const orgA = "org-alpha";
const orgB = "org-beta";
const FIXED_NOW = "2026-09-02T00:00:00.000Z";

const ctxA: TenantContext = {
  organizationId: orgA,
  userId: "usr-alpha-1",
  userEmail: "alpha@apex.local",
  userRole: "admin",
  permissions: [
    "customer:read",
    "customer:write",
    "contract:read",
    "contract:write",
    "transaction:read",
    "transaction:write",
    "document:read",
    "document:write",
    "knowledge:read",
    "knowledge:write",
    "workflow:read",
    "workflow:write",
    "workflow:run",
    "opportunity:read",
    "opportunity:write",
    "value:read",
    "value:write",
    "signal:read",
    "signal:write",
  ],
  requestId: "req-rel-test-alpha",
  timestamp: FIXED_NOW,
};

const ctxB: TenantContext = {
  organizationId: orgB,
  userId: "usr-beta-1",
  userEmail: "beta@apex.local",
  userRole: "admin",
  permissions: [
    "customer:read",
    "customer:write",
    "contract:read",
    "contract:write",
    "transaction:read",
    "transaction:write",
    "document:read",
    "document:write",
    "knowledge:read",
    "knowledge:write",
    "workflow:read",
    "workflow:write",
    "workflow:run",
    "opportunity:read",
    "opportunity:write",
    "value:read",
    "value:write",
    "signal:read",
    "signal:write",
  ],
  requestId: "req-rel-test-beta",
  timestamp: FIXED_NOW,
};

function contractFixture(
  id: string,
  customerId: string,
  title: string,
  contractValue = 300000
): Omit<ContractRecord, "organizationId"> {
  return {
    id,
    customerId,
    title,
    contractValue,
    startDate: "2026-01-01",
    endDate: "2027-01-01",
    renewalDaysRemaining: 120,
    status: "active",
    slaCompliance: 99.9,
    volatilityIndexationClause: false,
    createdAt: FIXED_NOW,
  };
}

function opportunityFixture(
  id: string,
  title: string,
  sourceEntityType: ValueOpportunityRecord["sourceEntityType"],
  sourceEntityId: string,
  overrides: Partial<Omit<ValueOpportunityRecord, "id" | "organizationId" | "title" | "sourceEntityType" | "sourceEntityId">> = {}
): Omit<ValueOpportunityRecord, "organizationId"> {
  return {
    id,
    title,
    category: "Customer expansion",
    potentialValue: 200000,
    status: "Identified",
    confidence: 90,
    recommendedAction: "Review and execute the opportunity",
    expectedOutcome: "Validated tenant-scoped value opportunity",
    sourceEntityType,
    sourceEntityId,
    evidence: "Relationship integrity fixture",
    strategicImportance: "High",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

async function setupStore(): Promise<DatabaseStore> {
  const store = new DatabaseStore();

  store.users.set("usr-alpha-1", {
    id: "usr-alpha-1",
    email: "alpha@apex.local",
    name: "Alpha Admin",
    title: "Lead",
    status: "active",
    createdAt: FIXED_NOW,
  });
  store.memberships.set("mem-alpha-1", {
    id: "mem-alpha-1",
    organizationId: orgA,
    userId: "usr-alpha-1",
    role: "admin",
    joinedAt: FIXED_NOW,
  });

  store.users.set("usr-beta-1", {
    id: "usr-beta-1",
    email: "beta@apex.local",
    name: "Beta Admin",
    title: "Lead",
    status: "active",
    createdAt: FIXED_NOW,
  });
  store.memberships.set("mem-beta-1", {
    id: "mem-beta-1",
    organizationId: orgB,
    userId: "usr-beta-1",
    role: "admin",
    joinedAt: FIXED_NOW,
  });

  await store.customersRepo.create(
    {
      id: "cust-alpha-1",
      name: "Alpha Corp",
      tier: "Enterprise",
      status: "active",
      healthScore: 95,
      arr: 500000,
      owner: "alpha@apex.local",
      contactName: "Alice",
      contactRole: "VP",
      contactEmail: "alice@alpha.local",
      tags: ["Alpha"],
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    ctxA
  );

  await store.customersRepo.create(
    {
      id: "cust-alpha-2",
      name: "Alpha Logistics",
      tier: "Mid-Market",
      status: "active",
      healthScore: 85,
      arr: 250000,
      owner: "alpha@apex.local",
      contactName: "Alex",
      contactRole: "Director",
      contactEmail: "alex@alpha.local",
      tags: ["Alpha"],
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    ctxA
  );

  await store.customersRepo.create(
    {
      id: "cust-beta-1",
      name: "Beta Global",
      tier: "Enterprise",
      status: "active",
      healthScore: 90,
      arr: 750000,
      owner: "beta@apex.local",
      contactName: "Bob",
      contactRole: "COO",
      contactEmail: "bob@beta.local",
      tags: ["Beta"],
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    ctxB
  );

  return store;
}

export async function runRelationshipIntegrityTestSuite(): Promise<SuiteSummary> {
  const results: TestResult[] = [];

  const runTest = async (testName: string, fn: () => Promise<void>) => {
    const start = performance.now();
    try {
      await fn();
      results.push({
        suite: "Relationship Integrity",
        testName,
        passed: true,
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    } catch (err: unknown) {
      results.push({
        suite: "Relationship Integrity",
        testName,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    }
  };

  await runTest("Test 1: Valid same-tenant Contract creation succeeds", async () => {
    const store = await setupStore();
    const contract = await store.contractsRepo.create(
      contractFixture("contract-a-1", "cust-alpha-1", "Master Services Agreement", 500000),
      ctxA
    );

    if (contract.customerId !== "cust-alpha-1" || contract.organizationId !== orgA) {
      throw new Error("Contract not persisted with correct same-tenant customerId");
    }
  });

  await runTest("Test 2: Contract referencing nonexistent Customer is rejected with NotFoundError", async () => {
    const store = await setupStore();
    try {
      await store.contractsRepo.create(
        contractFixture("contract-fail-1", "cust-nonexistent-999", "Invalid Contract", 100000),
        ctxA
      );
      throw new Error("Expected NotFoundError but operation succeeded");
    } catch (err: unknown) {
      if (!(err instanceof NotFoundError)) {
        throw new Error(`Expected NotFoundError, got: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  await runTest("Test 3: Contract referencing another tenant's Customer is rejected (CrossTenantViolationError)", async () => {
    const store = await setupStore();
    try {
      await store.contractsRepo.create(
        contractFixture("contract-cross-1", "cust-beta-1", "Cross-Tenant Contract", 100000),
        ctxA
      );
      throw new Error("Expected cross-tenant violation error but operation succeeded");
    } catch (err: unknown) {
      if (!(err instanceof CrossTenantViolationError)) {
        throw new Error(`Expected CrossTenantViolationError, got: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  await runTest("Test 4: Transaction referencing another tenant's Customer is rejected", async () => {
    const store = await setupStore();
    try {
      await store.transactionsRepo.create(
        {
          id: "txn-cross-1",
          customerId: "cust-beta-1",
          type: "revenue",
          amount: 50000,
          currency: "USD",
          status: "cleared",
          reference: "TXN-001",
          category: "Subscription",
          date: "2026-02-01",
          createdAt: FIXED_NOW,
        },
        ctxA
      );
      throw new Error("Expected cross-tenant violation error on transaction create");
    } catch (err: unknown) {
      if (!(err instanceof CrossTenantViolationError)) {
        throw new Error(`Expected CrossTenantViolationError, got: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  await runTest("Test 5: Document with valid optional null/undefined customerId succeeds", async () => {
    const store = await setupStore();
    const doc = await store.documentsRepo.create(
      {
        id: "doc-alpha-1",
        name: "General Policy.pdf",
        fileType: "pdf",
        category: "Compliance Document",
        size: "1.2 MB",
        uploadedBy: "usr-alpha-1",
        storageKey: "s3://docs/alpha-1.pdf",
        status: "indexed",
        metadata: {
          fileSizeBytes: 1200000,
          mimeType: "application/pdf",
          storageUri: "s3://docs/alpha-1.pdf",
        },
        extractedFields: [],
        tags: ["Policy"],
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      },
      ctxA
    );

    if (doc.customerId !== undefined || doc.organizationId !== orgA) {
      throw new Error("Document optional customerId creation failed");
    }
  });

  await runTest("Test 6: Document referencing cross-tenant Customer is rejected", async () => {
    const store = await setupStore();
    try {
      await store.documentsRepo.create(
        {
          id: "doc-cross-1",
          customerId: "cust-beta-1",
          name: "SLA Agreement.pdf",
          fileType: "pdf",
          category: "SLA Agreement",
          size: "2.4 MB",
          uploadedBy: "usr-alpha-1",
          storageKey: "s3://docs/sla.pdf",
          status: "indexed",
          metadata: {
            fileSizeBytes: 2400000,
            mimeType: "application/pdf",
            storageUri: "s3://docs/sla.pdf",
          },
          extractedFields: [],
          tags: ["SLA"],
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        },
        ctxA
      );
      throw new Error("Expected cross-tenant violation on document create");
    } catch (err: unknown) {
      if (!(err instanceof CrossTenantViolationError)) {
        throw new Error(`Expected CrossTenantViolationError, got: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  await runTest("Test 7: Knowledge referencing cross-tenant Document (sourceDocId) is rejected", async () => {
    const store = await setupStore();

    await store.documentsRepo.create(
      {
        id: "doc-beta-1",
        name: "Beta Strategy.pdf",
        fileType: "pdf",
        category: "Board Paper",
        size: "3.1 MB",
        uploadedBy: "usr-beta-1",
        storageKey: "s3://docs/beta-1.pdf",
        status: "indexed",
        metadata: {
          fileSizeBytes: 3100000,
          mimeType: "application/pdf",
          storageUri: "s3://docs/beta-1.pdf",
        },
        extractedFields: [],
        tags: ["Board"],
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      },
      ctxB
    );

    try {
      await store.knowledgeRepo.create(
        {
          id: "know-cross-1",
          sourceDocId: "doc-beta-1",
          title: "Extracted Strategy",
          summary: "Strategy summary",
          category: "Policy",
          content: "Confidential strategy content",
          author: "Alpha Strategy Team",
          tags: ["Strategy"],
          version: 1,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        },
        ctxA
      );
      throw new Error("Expected cross-tenant rejection for knowledge referencing other tenant document");
    } catch (err: unknown) {
      if (!(err instanceof CrossTenantViolationError)) {
        throw new Error(`Expected CrossTenantViolationError, got: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  await runTest("Test 8: WorkflowRun referencing cross-tenant Workflow is rejected", async () => {
    const store = await setupStore();

    await store.workflowsRepo.create(
      {
        id: "wf-beta-1",
        name: "Beta Automated Billing",
        description: "Billing workflow",
        subsidiary: "Beta Corp",
        status: "active",
        version: 1,
        nodes: [],
        connections: [],
        runsCount: 0,
        successRate: 100,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      },
      ctxB
    );

    try {
      await store.workflowRunsRepo.create(
        {
          id: "run-cross-1",
          workflowId: "wf-beta-1",
          workflowVersion: 1,
          triggeredBy: "usr-alpha-1",
          triggerType: "manual",
          status: "pending",
          steps: [],
          contextData: {},
          startedAt: FIXED_NOW,
        },
        ctxA
      );
      throw new Error("Expected cross-tenant rejection for workflow run referencing other tenant workflow");
    } catch (err: unknown) {
      if (!(err instanceof CrossTenantViolationError)) {
        throw new Error(`Expected CrossTenantViolationError, got: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  await runTest("Test 9: WorkflowRun actor not a tenant member is rejected", async () => {
    const store = await setupStore();

    await store.workflowsRepo.create(
      {
        id: "wf-alpha-1",
        name: "Alpha Contract Review",
        description: "Review workflow",
        subsidiary: "Alpha Corp",
        status: "active",
        version: 1,
        nodes: [],
        connections: [],
        runsCount: 0,
        successRate: 100,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      },
      ctxA
    );

    try {
      await store.workflowRunsRepo.create(
        {
          id: "run-actor-fail",
          workflowId: "wf-alpha-1",
          workflowVersion: 1,
          triggeredBy: "usr-beta-1",
          triggerType: "manual",
          status: "pending",
          steps: [],
          contextData: {},
          startedAt: FIXED_NOW,
        },
        ctxA
      );
      throw new Error("Expected rejection for actor not belonging to tenant membership");
    } catch (err: unknown) {
      if (!(err instanceof CrossTenantViolationError) && !(err instanceof NotFoundError)) {
        throw new Error(`Expected CrossTenantViolationError or NotFoundError, got: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  await runTest("Test 10: ValueCaptured referencing cross-tenant Opportunity is rejected", async () => {
    const store = await setupStore();

    await store.opportunitiesRepo.create(
      opportunityFixture("opp-beta-1", "Beta FX Optimization", "Customer", "cust-beta-1"),
      ctxB
    );

    try {
      await store.valueCapturedRepo.create(
        {
          id: "val-cross-1",
          opportunityId: "opp-beta-1",
          opportunityTitle: "Beta FX Optimization",
          category: "Revenue recovered",
          capturedValue: 150000,
          evidenceType: "Relationship test evidence",
          evidenceDescription: "Foreign opportunity must be rejected before persistence",
          realizationDate: "2026-03-01",
          certifiedBy: "usr-alpha-1",
          auditTrail: [],
          createdAt: FIXED_NOW,
        },
        ctxA
      );
      throw new Error("Expected cross-tenant rejection for ValueCaptured referencing foreign opportunity");
    } catch (err: unknown) {
      if (!(err instanceof CrossTenantViolationError)) {
        throw new Error(`Expected CrossTenantViolationError, got: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  await runTest("Test 11: ValueOpportunity referencing cross-tenant source entity is rejected", async () => {
    const store = await setupStore();

    try {
      await store.opportunitiesRepo.create(
        opportunityFixture(
          "opp-alpha-cross",
          "Alpha Supply Renegotiation",
          "Customer",
          "cust-beta-1",
          { category: "Contract optimization" }
        ),
        ctxA
      );
      throw new Error("Expected cross-tenant rejection on opportunity with foreign sourceEntityId");
    } catch (err: unknown) {
      if (!(err instanceof CrossTenantViolationError)) {
        throw new Error(`Expected CrossTenantViolationError, got: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  await runTest("Test 12: Unsupported polymorphic sourceEntityType is rejected with ValidationError", async () => {
    const store = await setupStore();

    try {
      await store.opportunitiesRepo.create(
        opportunityFixture(
          "opp-invalid-type",
          "Exploit Attempt",
          "SecretInternalTable" as any,
          "cust-alpha-1",
          { confidence: 50 }
        ),
        ctxA
      );
      throw new Error("Expected ValidationError for unsupported polymorphic sourceEntityType");
    } catch (err: unknown) {
      if (!(err instanceof ValidationError)) {
        throw new Error(`Expected ValidationError, got: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  await runTest("Test 13: Valid relationship update to another same-tenant Customer succeeds", async () => {
    const store = await setupStore();
    const contract = await store.contractsRepo.create(
      contractFixture("contract-up-1", "cust-alpha-1", "Initial MSA"),
      ctxA
    );

    const updated = await store.contractsRepo.update(
      contract.id,
      { customerId: "cust-alpha-2" },
      ctxA
    );

    if (updated.customerId !== "cust-alpha-2") {
      throw new Error("Contract customerId was not updated to cust-alpha-2");
    }
  });

  await runTest("Test 14: Updating relationship to cross-tenant Customer is rejected", async () => {
    const store = await setupStore();
    const contract = await store.contractsRepo.create(
      contractFixture("contract-up-2", "cust-alpha-1", "Initial MSA"),
      ctxA
    );

    try {
      await store.contractsRepo.update(
        contract.id,
        { customerId: "cust-beta-1" },
        ctxA
      );
      throw new Error("Expected cross-tenant rejection during update");
    } catch (err: unknown) {
      if (!(err instanceof CrossTenantViolationError)) {
        throw new Error(`Expected CrossTenantViolationError, got: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  await runTest("Test 15: Existing valid relationship remains valid when updating unrelated fields", async () => {
    const store = await setupStore();
    const contract = await store.contractsRepo.create(
      contractFixture("contract-up-3", "cust-alpha-1", "Title Before Update"),
      ctxA
    );

    const updated = await store.contractsRepo.update(
      contract.id,
      { title: "Title After Safe Update", contractValue: 350000 },
      ctxA
    );

    if (
      updated.title !== "Title After Safe Update" ||
      updated.customerId !== "cust-alpha-1" ||
      updated.contractValue !== 350000
    ) {
      throw new Error("Unrelated field update corrupted relationship or fields");
    }
  });

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    suiteName: "Relationship Integrity",
    total: results.length,
    passedCount,
    failedCount,
    results,
  };
}
