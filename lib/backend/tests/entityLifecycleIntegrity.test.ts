/**
 * APEX ONE — Entity Lifecycle & Deletion Integrity Test Suite
 *
 * Verifies that the RESTRICT deletion policy prevents dangling foreign references
 * and enforces tenant-scoped dependency validation prior to record deletion.
 */

import { DatabaseStore } from "../database/store";
import {
  TenantContext,
  NotFoundError,
  CrossTenantViolationError,
  ConflictError,
} from "../core/errors";
import type {
  ContractRecord,
  DocumentRecord,
  KnowledgeItemRecord,
  WorkflowRecord,
  WorkflowRunRecord,
  ValueOpportunityRecord,
  ValueCapturedRecord,
  SignalRecord,
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

type ErrorConstructor = new (...args: any[]) => Error;

const orgA = "org-alpha";
const orgB = "org-beta";
const FIXED_NOW = "2026-09-02T00:00:00.000Z";

const ctxA: TenantContext = {
  organizationId: orgA,
  userId: "usr-alpha-1",
  userEmail: "alpha@apex.local",
  userRole: "admin",
  permissions: [
    "customer:read", "customer:write", "customer:delete",
    "contract:read", "contract:write", "contract:delete",
    "financial:read", "financial:write", "financial:delete",
    "document:read", "document:write", "document:delete",
    "knowledge:read", "knowledge:write", "knowledge:delete",
    "workflow:read", "workflow:write", "workflow:delete",
    "value:read", "value:write", "value:delete",
    "signal:read", "signal:write", "signal:delete",
  ],
  requestId: "req-alpha-lifecycle",
  timestamp: FIXED_NOW,
};

const ctxB: TenantContext = {
  organizationId: orgB,
  userId: "usr-beta-1",
  userEmail: "beta@apex.local",
  userRole: "admin",
  permissions: [
    "customer:read", "customer:write", "customer:delete",
    "contract:read", "contract:write", "contract:delete",
    "financial:read", "financial:write", "financial:delete",
    "document:read", "document:write", "document:delete",
    "knowledge:read", "knowledge:write", "knowledge:delete",
    "workflow:read", "workflow:write", "workflow:delete",
    "value:read", "value:write", "value:delete",
    "signal:read", "signal:write", "signal:delete",
  ],
  requestId: "req-beta-lifecycle",
  timestamp: FIXED_NOW,
};

function contractFixture(
  id: string,
  customerId: string,
  title: string,
  contractValue: number
): Omit<ContractRecord, "organizationId"> {
  return {
    id,
    customerId,
    title,
    contractValue,
    startDate: "2026-01-01",
    endDate: "2027-01-01",
    renewalDaysRemaining: 180,
    status: "active",
    slaCompliance: 99,
    volatilityIndexationClause: false,
    createdAt: FIXED_NOW,
  };
}

function documentFixture(
  id: string,
  name: string,
  category: DocumentRecord["category"],
  customerId?: string
): Omit<DocumentRecord, "organizationId"> {
  const isImage = name.toLowerCase().endsWith(".png");
  return {
    id,
    ...(customerId ? { customerId } : {}),
    name,
    fileType: isImage ? "image" : "pdf",
    category,
    size: isImage ? "500 KB" : "1.2 MB",
    uploadedBy: "",
    storageKey: `docs/${id}`,
    status: "indexed",
    metadata: {
      fileSizeBytes: isImage ? 500_000 : 1_200_000,
      mimeType: isImage ? "image/png" : "application/pdf",
      storageUri: `memory://documents/${id}`,
    },
    extractedFields: [],
    tags: [],
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

function knowledgeFixture(
  id: string,
  title: string,
  sourceDocId: string
): Omit<KnowledgeItemRecord, "organizationId"> {
  return {
    id,
    title,
    category: "Policy",
    content: `${title} content`,
    summary: `${title} summary`,
    author: "System",
    sourceDocId,
    tags: ["lifecycle"],
    version: 1,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

function workflowFixture(
  id: string,
  name: string,
  status: WorkflowRecord["status"] = "active"
): Omit<WorkflowRecord, "organizationId"> {
  return {
    id,
    name,
    description: `${name} lifecycle fixture`,
    subsidiary: "General Operations",
    status,
    version: 1,
    nodes: [],
    connections: [],
    runsCount: 0,
    successRate: 0,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

function workflowRunFixture(
  id: string,
  workflowId: string
): Omit<WorkflowRunRecord, "organizationId"> {
  return {
    id,
    workflowId,
    workflowVersion: 1,
    triggeredBy: "system",
    triggerType: "manual",
    status: "running",
    steps: [],
    contextData: {},
    startedAt: FIXED_NOW,
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
    category: "Process optimization",
    potentialValue: 15000,
    confidence: 90,
    evidence: "Lifecycle dependency fixture",
    sourceEntityType,
    sourceEntityId,
    recommendedAction: "Review dependency",
    expectedOutcome: "Dependency preserved",
    realizationSpeed: "Medium",
    strategicImportance: "Medium",
    risk: "Low",
    status: "Identified",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

function valueCapturedFixture(
  id: string,
  opportunityId: string,
  opportunityTitle: string
): Omit<ValueCapturedRecord, "organizationId"> {
  return {
    id,
    opportunityId,
    opportunityTitle,
    category: "Cost avoided",
    capturedValue: 12500,
    evidenceType: "Lifecycle fixture",
    evidenceDescription: "Captured value dependency record",
    realizationDate: "2026-09-02",
    certifiedBy: "system",
    auditTrail: [],
    createdAt: FIXED_NOW,
  };
}

function signalFixture(id: string): Omit<SignalRecord, "organizationId"> {
  return {
    id,
    category: "operation",
    severity: "medium",
    title: "Usage Surge Detected",
    description: "API call volume exceeded normal baseline by 300%",
    evidence: "API Gateway telemetry",
    estimatedFinancialImpact: 20000,
    status: "active",
    detectedAt: FIXED_NOW,
  };
}

function customerFixture(id: string, name: string, email: string, arr: number) {
  return {
    id,
    name,
    tier: "Enterprise" as const,
    status: "active" as const,
    healthScore: 90,
    arr,
    owner: "owner@apex.local",
    contactName: `${name} Contact`,
    contactRole: "Lead",
    contactEmail: email,
    since: "2026-01-01",
    tags: ["lifecycle"],
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

export async function runEntityLifecycleIntegrityTestSuite(): Promise<SuiteSummary> {
  const results: TestResult[] = [];

  const runTest = async (testName: string, fn: () => Promise<void>) => {
    const start = performance.now();
    try {
      await fn();
      results.push({
        suite: "Entity Lifecycle & Deletion Integrity",
        testName,
        passed: true,
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    } catch (err: unknown) {
      results.push({
        suite: "Entity Lifecycle & Deletion Integrity",
        testName,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    }
  };

  const assertThrows = async (
    fn: () => Promise<unknown>,
    expectedErrorClass: ErrorConstructor,
    messageSubstring?: string
  ) => {
    let threw = false;
    try {
      await fn();
    } catch (e: unknown) {
      threw = true;
      if (!(e instanceof expectedErrorClass)) {
        throw new Error(
          `Expected error of type ${expectedErrorClass.name}, but got ${
            e instanceof Error ? e.constructor.name : typeof e
          }: ${e instanceof Error ? e.message : String(e)}`
        );
      }
      if (messageSubstring && e instanceof Error && !e.message.includes(messageSubstring)) {
        throw new Error(
          `Expected error message to contain '${messageSubstring}', but got '${e.message}'`
        );
      }
    }
    if (!threw) {
      throw new Error(`Expected function to throw ${expectedErrorClass.name}, but it succeeded`);
    }
  };

  await runTest(
    "1.1 RESTRICT: Rejects Customer deletion when active Contract depends on Customer",
    async () => {
      const db = new DatabaseStore();
      const cust = await db.customersRepo.create(
        customerFixture("cust-del-1", "Acme Corp", "john@acme.com", 120000),
        ctxA
      );
      await db.contractsRepo.create(
        contractFixture("cnt-del-1", cust.id, "Master Services Agreement", 120000),
        ctxA
      );

      await assertThrows(
        () => db.customersRepo.delete(cust.id, ctxA),
        ConflictError,
        "Cannot delete Customer because dependent Contract records exist"
      );
      const found = await db.customersRepo.findById(cust.id, ctxA);
      if (!found) throw new Error("Customer was deleted despite dependency check");
    }
  );

  await runTest(
    "1.2 RESTRICT: Rejects Customer deletion when active Transaction depends on Customer",
    async () => {
      const db = new DatabaseStore();
      const cust = await db.customersRepo.create(
        customerFixture("cust-del-2", "Beta Logistics", "jane@betalogistics.com", 50000),
        ctxA
      );
      await db.transactionsRepo.create(
        {
          id: "txn-del-2",
          customerId: cust.id,
          type: "revenue",
          amount: 5000,
          currency: "USD",
          status: "cleared",
          reference: "INV-2026-002",
          category: "subscription",
          date: "2026-09-02",
          createdAt: FIXED_NOW,
        },
        ctxA
      );

      await assertThrows(
        () => db.customersRepo.delete(cust.id, ctxA),
        ConflictError,
        "Cannot delete Customer because dependent Transaction records exist"
      );
    }
  );

  await runTest(
    "1.3 RESTRICT: Rejects Customer deletion when active Document references Customer",
    async () => {
      const db = new DatabaseStore();
      const cust = await db.customersRepo.create(
        customerFixture("cust-del-3", "Gamma Tech", "contact@gamma.com", 25000),
        ctxA
      );
      await db.documentsRepo.create(
        documentFixture("doc-del-3", "SLA Agreement.pdf", "SLA Agreement", cust.id),
        ctxA
      );

      await assertThrows(
        () => db.customersRepo.delete(cust.id, ctxA),
        ConflictError,
        "Cannot delete Customer because dependent Document records exist"
      );
    }
  );

  await runTest(
    "1.4 RESTRICT: Rejects Customer deletion when ValueOpportunity polymorphically references Customer",
    async () => {
      const db = new DatabaseStore();
      const cust = await db.customersRepo.create(
        customerFixture("cust-del-4", "Delta Retail", "delta@retail.com", 200000),
        ctxA
      );
      await db.opportunitiesRepo.create(
        opportunityFixture(
          "opp-del-4",
          "Enterprise Expansion",
          "Customer",
          cust.id,
          { category: "Customer expansion", potentialValue: 75000, confidence: 85 }
        ),
        ctxA
      );

      await assertThrows(
        () => db.customersRepo.delete(cust.id, ctxA),
        ConflictError,
        "Cannot delete Customer because dependent ValueOpportunity records exist"
      );
    }
  );

  await runTest(
    "1.5 SUCCESS: Customer deletion succeeds when dependent records are removed first",
    async () => {
      const db = new DatabaseStore();
      const cust = await db.customersRepo.create(
        customerFixture("cust-del-5", "Epsilon Analytics", "cto@epsilon.com", 45000),
        ctxA
      );
      const contract = await db.contractsRepo.create(
        contractFixture("cnt-del-5", cust.id, "Service Order", 45000),
        ctxA
      );

      const deletedContract = await db.contractsRepo.delete(contract.id, ctxA);
      if (!deletedContract) throw new Error("Contract deletion failed");
      const deletedCust = await db.customersRepo.delete(cust.id, ctxA);
      if (!deletedCust) throw new Error("Customer deletion failed after contract removal");
      await assertThrows(() => db.customersRepo.findById(cust.id, ctxA), NotFoundError);
    }
  );

  await runTest(
    "2.1 RESTRICT: Rejects Document deletion when KnowledgeItem depends on Document",
    async () => {
      const db = new DatabaseStore();
      const doc = await db.documentsRepo.create(
        documentFixture("doc-del-21", "Security Whitepaper.pdf", "Compliance Document"),
        ctxA
      );
      await db.knowledgeRepo.create(
        knowledgeFixture("k-del-21", "SOC2 Compliance Framework", doc.id),
        ctxA
      );

      await assertThrows(
        () => db.documentsRepo.delete(doc.id, ctxA),
        ConflictError,
        "Cannot delete Document because dependent Knowledge records exist"
      );
    }
  );

  await runTest(
    "2.2 SUCCESS: Document deletion succeeds after KnowledgeItem dependency is removed",
    async () => {
      const db = new DatabaseStore();
      const doc = await db.documentsRepo.create(
        documentFixture("doc-del-22", "Architecture Diagram.png", "Other"),
        ctxA
      );
      const knowledge = await db.knowledgeRepo.create(
        knowledgeFixture("k-del-22", "System Topology", doc.id),
        ctxA
      );

      await db.knowledgeRepo.delete(knowledge.id, ctxA);
      const deleted = await db.documentsRepo.delete(doc.id, ctxA);
      if (!deleted) throw new Error("Document deletion failed");
      await assertThrows(() => db.documentsRepo.findById(doc.id, ctxA), NotFoundError);
    }
  );

  await runTest(
    "3.1 RESTRICT: Rejects Workflow deletion when WorkflowRun depends on Workflow",
    async () => {
      const db = new DatabaseStore();
      const workflow = await db.workflowsRepo.create(
        workflowFixture("wf-del-31", "Customer Onboarding Pipeline"),
        ctxA
      );
      await db.workflowRunsRepo.create(
        workflowRunFixture("wfr-del-31", workflow.id),
        ctxA
      );

      await assertThrows(
        () => db.workflowsRepo.delete(workflow.id, ctxA),
        ConflictError,
        "Cannot delete Workflow because dependent WorkflowRun records exist"
      );
    }
  );

  await runTest(
    "3.2 SUCCESS: Workflow deletion succeeds when no WorkflowRuns exist",
    async () => {
      const db = new DatabaseStore();
      const workflow = await db.workflowsRepo.create(
        workflowFixture("wf-del-32", "Deprecated Email Batch", "paused"),
        ctxA
      );
      const deleted = await db.workflowsRepo.delete(workflow.id, ctxA);
      if (!deleted) throw new Error("Workflow deletion failed");
      await assertThrows(() => db.workflowsRepo.findById(workflow.id, ctxA), NotFoundError);
    }
  );

  await runTest(
    "4.1 RESTRICT: Rejects ValueOpportunity deletion when ValueCaptured references Opportunity",
    async () => {
      const db = new DatabaseStore();
      const opportunity = await db.opportunitiesRepo.create(
        opportunityFixture(
          "opp-del-41",
          "Cost Optimization in Cloud",
          "Operation",
          "cloud-infra-audit",
          { category: "Process optimization", potentialValue: 15000, status: "Executing" }
        ),
        ctxA
      );
      await db.valueCapturedRepo.create(
        valueCapturedFixture("vc-del-41", opportunity.id, opportunity.title),
        ctxA
      );

      await assertThrows(
        () => db.opportunitiesRepo.delete(opportunity.id, ctxA),
        ConflictError,
        "Cannot delete ValueOpportunity because dependent ValueCaptured records exist"
      );
    }
  );

  await runTest(
    "4.2 SUCCESS: ValueOpportunity deletion succeeds when no ValueCaptured records exist",
    async () => {
      const db = new DatabaseStore();
      const opportunity = await db.opportunitiesRepo.create(
        opportunityFixture(
          "opp-del-42",
          "Discarded Opportunity",
          "Operation",
          "survey-feedback",
          { confidence: 20, risk: "High" }
        ),
        ctxA
      );
      const deleted = await db.opportunitiesRepo.delete(opportunity.id, ctxA);
      if (!deleted) throw new Error("Opportunity deletion failed");
      await assertThrows(() => db.opportunitiesRepo.findById(opportunity.id, ctxA), NotFoundError);
    }
  );

  await runTest(
    "5.1 RESTRICT: Rejects Contract deletion when ValueOpportunity polymorphically references Contract",
    async () => {
      const db = new DatabaseStore();
      const cust = await db.customersRepo.create(
        customerFixture("cust-del-51", "Zeta Partners", "zeta@partners.com", 300000),
        ctxA
      );
      const contract = await db.contractsRepo.create(
        contractFixture("cnt-del-51", cust.id, "Multi-Year Service Contract", 300000),
        ctxA
      );
      await db.opportunitiesRepo.create(
        opportunityFixture(
          "opp-del-51",
          "Renewal Upsell",
          "Contract",
          contract.id,
          { category: "Customer expansion", potentialValue: 60000 }
        ),
        ctxA
      );

      await assertThrows(
        () => db.contractsRepo.delete(contract.id, ctxA),
        ConflictError,
        "Cannot delete Contract because dependent ValueOpportunity records exist"
      );
    }
  );

  await runTest(
    "5.2 RESTRICT: Rejects Signal deletion when ValueOpportunity polymorphically references Signal",
    async () => {
      const db = new DatabaseStore();
      const signal = await db.signalsRepo.create(signalFixture("sig-del-52"), ctxA);
      await db.opportunitiesRepo.create(
        opportunityFixture(
          "opp-del-52",
          "Tier Upgrade Opportunity",
          "Signal",
          signal.id,
          { category: "Customer expansion", potentialValue: 20000, confidence: 88 }
        ),
        ctxA
      );

      await assertThrows(
        () => db.signalsRepo.delete(signal.id, ctxA),
        ConflictError,
        "Cannot delete Signal because dependent ValueOpportunity records exist"
      );
    }
  );

  await runTest(
    "6.1 ISOLATION: Org B dependent record does NOT block deletion of Org A record",
    async () => {
      const db = new DatabaseStore();
      const custA = await db.customersRepo.create(
        customerFixture("cust-shared-id-1", "Org A Customer", "a@test.com", 10000),
        ctxA
      );
      const custB = await db.customersRepo.create(
        customerFixture("cust-org-b-1", "Org B Customer", "b@test.com", 20000),
        ctxB
      );
      await db.contractsRepo.create(
        contractFixture("cnt-org-b-1", custB.id, "Org B Contract", 20000),
        ctxB
      );

      const deleted = await db.customersRepo.delete(custA.id, ctxA);
      if (!deleted) throw new Error("Deletion in Org A failed");
    }
  );

  await runTest(
    "6.2 ISOLATION: Cross-tenant deletion attempt throws CrossTenantViolationError",
    async () => {
      const db = new DatabaseStore();
      const custA = await db.customersRepo.create(
        customerFixture("cust-org-a-private", "Org A Private Customer", "lead@priv.com", 500000),
        ctxA
      );
      await assertThrows(
        () => db.customersRepo.delete(custA.id, ctxB),
        CrossTenantViolationError
      );
    }
  );

  await runTest(
    "7.1 AUDIT: Deleting an entity logs a successful audit event with actor context",
    async () => {
      const db = new DatabaseStore();
      const cust = await db.customersRepo.create(
        customerFixture("cust-audit-del", "Audit Test Customer", "audit@test.com", 15000),
        ctxA
      );
      await db.customersRepo.delete(cust.id, ctxA);

      const logs = await db.auditLogsRepo.findMany(ctxA, { limit: 10 });
      const deleteLog = logs.items.find(
        (log) => log.action === "customer:delete" && log.resourceId === cust.id
      );

      if (!deleteLog) {
        throw new Error("Audit log entry for customer:delete was not recorded");
      }
      if (deleteLog.actorId !== ctxA.userId) {
        throw new Error(`Expected actorId ${ctxA.userId}, got ${deleteLog.actorId}`);
      }
      if (deleteLog.organizationId !== ctxA.organizationId) {
        throw new Error(`Expected organizationId ${ctxA.organizationId}, got ${deleteLog.organizationId}`);
      }
    }
  );

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    suiteName: "Entity Lifecycle & Deletion Integrity",
    total: results.length,
    passedCount,
    failedCount,
    results,
  };
}
