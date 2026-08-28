/**
 * APEX ONE — Entity Lifecycle & Deletion Integrity Test Suite
 * 
 * Task 04.05.03:
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

  const orgA = "org-alpha";
  const orgB = "org-beta";

  const ctxA: TenantContext = {
    organizationId: orgA,
    userId: "usr-alpha-1",
    userEmail: "alpha@apex.local",
    userRole: "admin",
    permissions: [
      "customer:read",
      "customer:write",
      "customer:delete",
      "contract:read",
      "contract:write",
      "contract:delete",
      "financial:read",
      "financial:write",
      "financial:delete",
      "document:read",
      "document:write",
      "document:delete",
      "knowledge:read",
      "knowledge:write",
      "knowledge:delete",
      "workflow:read",
      "workflow:write",
      "workflow:delete",
      "value:read",
      "value:write",
      "value:delete",
      "signal:read",
      "signal:write",
      "signal:delete",
    ],
    requestId: "req-alpha-lifecycle",
  };

  const ctxB: TenantContext = {
    organizationId: orgB,
    userId: "usr-beta-1",
    userEmail: "beta@apex.local",
    userRole: "admin",
    permissions: [
      "customer:read",
      "customer:write",
      "customer:delete",
      "contract:read",
      "contract:write",
      "contract:delete",
      "financial:read",
      "financial:write",
      "financial:delete",
      "document:read",
      "document:write",
      "document:delete",
      "knowledge:read",
      "knowledge:write",
      "knowledge:delete",
      "workflow:read",
      "workflow:write",
      "workflow:delete",
      "value:read",
      "value:write",
      "value:delete",
      "signal:read",
      "signal:write",
      "signal:delete",
    ],
    requestId: "req-beta-lifecycle",
  };

  // Helper to assert throws specific error
  const assertThrows = async (
    fn: () => Promise<unknown>,
    expectedErrorClass: new (...args: unknown[]) => Error,
    messageSubstring?: string
  ) => {
    let threw = false;
    let actualError: unknown = null;
    try {
      await fn();
    } catch (e: unknown) {
      threw = true;
      actualError = e;
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

  // =========================================================================
  // 1. CUSTOMER DELETION INTEGRITY (RESTRICT)
  // =========================================================================

  await runTest(
    "1.1 RESTRICT: Rejects Customer deletion when active Contract depends on Customer",
    async () => {
      const db = new DatabaseStore();
      const cust = await db.customersRepo.create(
        {
          id: "cust-del-1",
          name: "Acme Corp",
          tier: "Enterprise",
          status: "active",
          healthScore: 90,
          arr: 120000,
          owner: "owner@apex.local",
          contactName: "John Doe",
          contactRole: "VP Tech",
          contactEmail: "john@acme.com",
          since: "2026-01-01",
          tags: ["core"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      await db.contractsRepo.create(
        {
          id: "cnt-del-1",
          customerId: cust.id,
          title: "Master Services Agreement",
          contractNumber: "MSA-2026-001",
          type: "MSA",
          status: "active",
          value: 120000,
          startDate: "2026-01-01",
          endDate: "2027-01-01",
          renewalDaysRemaining: 180,
          paymentTerms: "Net 30",
          autoRenew: true,
          owner: "owner@apex.local",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      // Attempt deletion should be rejected with ConflictError
      await assertThrows(
        () => db.customersRepo.delete(cust.id, ctxA),
        ConflictError,
        "Cannot delete Customer because dependent Contract records exist"
      );

      // Confirm customer still exists
      const found = await db.customersRepo.findById(cust.id, ctxA);
      if (!found) throw new Error("Customer was deleted despite dependency check");
    }
  );

  await runTest(
    "1.2 RESTRICT: Rejects Customer deletion when active Transaction depends on Customer",
    async () => {
      const db = new DatabaseStore();
      const cust = await db.customersRepo.create(
        {
          id: "cust-del-2",
          name: "Beta Logistics",
          tier: "Mid-Market",
          status: "active",
          healthScore: 85,
          arr: 50000,
          owner: "owner@apex.local",
          contactName: "Jane Smith",
          contactRole: "Director",
          contactEmail: "jane@betalogistics.com",
          since: "2026-02-01",
          tags: ["logistics"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      await db.transactionsRepo.create(
        {
          id: "txn-del-2",
          customerId: cust.id,
          description: "Monthly subscription",
          amount: 5000,
          currency: "USD",
          type: "revenue",
          status: "settled",
          paymentMethod: "bank_transfer",
          referenceNumber: "INV-2026-002",
          category: "subscription",
          recognizedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
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
        {
          id: "cust-del-3",
          name: "Gamma Tech",
          tier: "SMB",
          status: "active",
          healthScore: 80,
          arr: 25000,
          owner: "owner@apex.local",
          contactName: "Gamma Contact",
          contactRole: "Lead",
          contactEmail: "contact@gamma.com",
          since: "2026-03-01",
          tags: ["saas"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      await db.documentsRepo.create(
        {
          id: "doc-del-3",
          name: "SLA Agreement.pdf",
          fileSize: "1.2 MB",
          mimeType: "application/pdf",
          storageKey: "docs/sla.pdf",
          status: "indexed",
          category: "sla",
          tags: ["sla"],
          customerId: cust.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
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
        {
          id: "cust-del-4",
          name: "Delta Retail",
          tier: "Enterprise",
          status: "active",
          healthScore: 92,
          arr: 200000,
          owner: "owner@apex.local",
          contactName: "Delta Contact",
          contactRole: "VP Retail",
          contactEmail: "delta@retail.com",
          since: "2026-01-15",
          tags: ["retail"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      await db.opportunitiesRepo.create(
        {
          id: "opp-del-4",
          title: "Enterprise Expansion",
          category: "expansion",
          confidenceScore: 0.85,
          sourceEntityType: "Customer",
          sourceEntityId: cust.id,
          projectedValue: 75000,
          status: "identified",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
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
        {
          id: "cust-del-5",
          name: "Epsilon Analytics",
          tier: "Mid-Market",
          status: "active",
          healthScore: 88,
          arr: 45000,
          owner: "owner@apex.local",
          contactName: "Epsilon Contact",
          contactRole: "CTO",
          contactEmail: "cto@epsilon.com",
          since: "2026-01-20",
          tags: ["analytics"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      const contract = await db.contractsRepo.create(
        {
          id: "cnt-del-5",
          customerId: cust.id,
          title: "Service Order",
          contractNumber: "SO-2026-005",
          type: "Order",
          status: "active",
          value: 45000,
          startDate: "2026-01-01",
          endDate: "2027-01-01",
          renewalDaysRemaining: 180,
          paymentTerms: "Net 30",
          autoRenew: false,
          owner: "owner@apex.local",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      // Contract deletion first
      const deletedContract = await db.contractsRepo.delete(contract.id, ctxA);
      if (!deletedContract) throw new Error("Contract deletion failed");

      // Customer deletion now succeeds
      const deletedCust = await db.customersRepo.delete(cust.id, ctxA);
      if (!deletedCust) throw new Error("Customer deletion failed after contract removal");

      // Verifying customer is gone
      await assertThrows(() => db.customersRepo.findById(cust.id, ctxA), NotFoundError);
    }
  );

  // =========================================================================
  // 2. DOCUMENT & KNOWLEDGE DELETION INTEGRITY
  // =========================================================================

  await runTest(
    "2.1 RESTRICT: Rejects Document deletion when KnowledgeItem depends on Document",
    async () => {
      const db = new DatabaseStore();
      const doc = await db.documentsRepo.create(
        {
          id: "doc-del-21",
          name: "Security Whitepaper.pdf",
          fileSize: "2.4 MB",
          mimeType: "application/pdf",
          storageKey: "docs/whitepaper.pdf",
          status: "indexed",
          category: "security",
          tags: ["security", "compliance"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      await db.knowledgeRepo.create(
        {
          id: "k-del-21",
          title: "SOC2 Compliance Framework",
          category: "security",
          content: "Comprehensive overview of SOC2 Type II compliance controls.",
          summary: "SOC2 overview",
          tags: ["compliance"],
          confidenceScore: 0.95,
          sourceDocId: doc.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
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
        {
          id: "doc-del-22",
          name: "Architecture Diagram.png",
          fileSize: "500 KB",
          mimeType: "image/png",
          storageKey: "docs/arch.png",
          status: "indexed",
          category: "architecture",
          tags: ["diagram"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      const k = await db.knowledgeRepo.create(
        {
          id: "k-del-22",
          title: "System Topology",
          category: "architecture",
          content: "Diagram overview",
          tags: ["diagram"],
          confidenceScore: 0.9,
          sourceDocId: doc.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      // Delete Knowledge record
      await db.knowledgeRepo.delete(k.id, ctxA);

      // Now Document delete succeeds
      const deleted = await db.documentsRepo.delete(doc.id, ctxA);
      if (!deleted) throw new Error("Document deletion failed");
      await assertThrows(() => db.documentsRepo.findById(doc.id, ctxA), NotFoundError);
    }
  );

  // =========================================================================
  // 3. WORKFLOW & WORKFLOW RUN DELETION INTEGRITY
  // =========================================================================

  await runTest(
    "3.1 RESTRICT: Rejects Workflow deletion when WorkflowRun depends on Workflow",
    async () => {
      const db = new DatabaseStore();
      const wf = await db.workflowsRepo.create(
        {
          id: "wf-del-31",
          name: "Customer Onboarding Pipeline",
          category: "onboarding",
          trigger: "customer_created",
          steps: [{ id: "step-1", name: "Send Welcome", type: "email" }],
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      await db.workflowRunsRepo.create(
        {
          id: "wfr-del-31",
          workflowId: wf.id,
          status: "running",
          triggeredBy: ctxA.userId,
          currentStep: "step-1",
          logs: ["Started"],
          startedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        ctxA
      );

      await assertThrows(
        () => db.workflowsRepo.delete(wf.id, ctxA),
        ConflictError,
        "Cannot delete Workflow because dependent WorkflowRun records exist"
      );
    }
  );

  await runTest(
    "3.2 SUCCESS: Workflow deletion succeeds when no WorkflowRuns exist",
    async () => {
      const db = new DatabaseStore();
      const wf = await db.workflowsRepo.create(
        {
          id: "wf-del-32",
          name: "Deprecated Email Batch",
          category: "marketing",
          trigger: "manual",
          steps: [],
          status: "paused",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      const deleted = await db.workflowsRepo.delete(wf.id, ctxA);
      if (!deleted) throw new Error("Workflow deletion failed");
      await assertThrows(() => db.workflowsRepo.findById(wf.id, ctxA), NotFoundError);
    }
  );

  // =========================================================================
  // 4. VALUE OPPORTUNITY & VALUE CAPTURED DELETION INTEGRITY
  // =========================================================================

  await runTest(
    "4.1 RESTRICT: Rejects ValueOpportunity deletion when ValueCaptured references Opportunity",
    async () => {
      const db = new DatabaseStore();
      const opp = await db.opportunitiesRepo.create(
        {
          id: "opp-del-41",
          title: "Cost Optimization in Cloud",
          category: "cost_reduction",
          confidenceScore: 0.92,
          sourceEntityType: "Operation",
          sourceEntityId: "cloud-infra-audit",
          projectedValue: 15000,
          status: "in_progress",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      await db.valueCapturedRepo.create(
        {
          id: "vc-del-41",
          opportunityId: opp.id,
          capturedValue: 12500,
          methodology: "EC2 Reserved Instance migration",
          verifiedBy: ctxA.userEmail,
          capturedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        ctxA
      );

      await assertThrows(
        () => db.opportunitiesRepo.delete(opp.id, ctxA),
        ConflictError,
        "Cannot delete ValueOpportunity because dependent ValueCaptured records exist"
      );
    }
  );

  await runTest(
    "4.2 SUCCESS: ValueOpportunity deletion succeeds when no ValueCaptured records exist",
    async () => {
      const db = new DatabaseStore();
      const opp = await db.opportunitiesRepo.create(
        {
          id: "opp-del-42",
          title: "Discarded Opportunity",
          category: "retention",
          confidenceScore: 0.2,
          sourceEntityType: "Operation",
          sourceEntityId: "survey-feedback",
          projectedValue: 5000,
          status: "dismissed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      const deleted = await db.opportunitiesRepo.delete(opp.id, ctxA);
      if (!deleted) throw new Error("Opportunity deletion failed");
      await assertThrows(() => db.opportunitiesRepo.findById(opp.id, ctxA), NotFoundError);
    }
  );

  // =========================================================================
  // 5. POLYMORPHIC SOURCE ENTITY DELETIONS (CONTRACT, TRANSACTION, SIGNAL)
  // =========================================================================

  await runTest(
    "5.1 RESTRICT: Rejects Contract deletion when ValueOpportunity polymorphically references Contract",
    async () => {
      const db = new DatabaseStore();
      const cust = await db.customersRepo.create(
        {
          id: "cust-del-51",
          name: "Zeta Partners",
          tier: "Enterprise",
          status: "active",
          healthScore: 95,
          arr: 300000,
          owner: "owner@apex.local",
          contactName: "Zeta Contact",
          contactRole: "Managing Director",
          contactEmail: "zeta@partners.com",
          since: "2026-01-01",
          tags: ["partners"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      const contract = await db.contractsRepo.create(
        {
          id: "cnt-del-51",
          customerId: cust.id,
          title: "Multi-Year Service Contract",
          contractNumber: "CTR-2026-051",
          type: "Enterprise",
          status: "active",
          value: 300000,
          startDate: "2026-01-01",
          endDate: "2029-01-01",
          renewalDaysRemaining: 365,
          paymentTerms: "Annual Prepay",
          autoRenew: true,
          owner: "owner@apex.local",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      await db.opportunitiesRepo.create(
        {
          id: "opp-del-51",
          title: "Renewal Upsell",
          category: "upsell",
          confidenceScore: 0.9,
          sourceEntityType: "Contract",
          sourceEntityId: contract.id,
          projectedValue: 60000,
          status: "identified",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
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
      const signal = await db.signalsRepo.create(
        {
          id: "sig-del-52",
          title: "Usage Surge Detected",
          description: "API call volume exceeded normal baseline by 300%",
          source: "API Gateway Telemetry",
          category: "usage",
          severity: "medium",
          status: "active",
          timestamp: new Date().toISOString(),
          metadata: { baseline: 1000, current: 4000 },
        },
        ctxA
      );

      await db.opportunitiesRepo.create(
        {
          id: "opp-del-52",
          title: "Tier Upgrade Opportunity",
          category: "expansion",
          confidenceScore: 0.88,
          sourceEntityType: "Signal",
          sourceEntityId: signal.id,
          projectedValue: 20000,
          status: "identified",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      await assertThrows(
        () => db.signalsRepo.delete(signal.id, ctxA),
        ConflictError,
        "Cannot delete Signal because dependent ValueOpportunity records exist"
      );
    }
  );

  // =========================================================================
  // 6. TENANT ISOLATION BOUNDARY IN DELETION INTEGRITY
  // =========================================================================

  await runTest(
    "6.1 ISOLATION: Org B dependent record does NOT block deletion of Org A record",
    async () => {
      const db = new DatabaseStore();
      // Org A Customer
      const custA = await db.customersRepo.create(
        {
          id: "cust-shared-id-1",
          name: "Org A Customer",
          tier: "SMB",
          status: "active",
          healthScore: 90,
          arr: 10000,
          owner: "alpha@apex.local",
          contactName: "Contact A",
          contactRole: "Lead",
          contactEmail: "a@test.com",
          since: "2026-01-01",
          tags: ["a"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      // Org B Customer with different ID, and Org B Contract referencing Org B customer
      const custB = await db.customersRepo.create(
        {
          id: "cust-org-b-1",
          name: "Org B Customer",
          tier: "SMB",
          status: "active",
          healthScore: 90,
          arr: 20000,
          owner: "beta@apex.local",
          contactName: "Contact B",
          contactRole: "Lead",
          contactEmail: "b@test.com",
          since: "2026-01-01",
          tags: ["b"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxB
      );

      await db.contractsRepo.create(
        {
          id: "cnt-org-b-1",
          customerId: custB.id,
          title: "Org B Contract",
          contractNumber: "CTR-B-1",
          type: "Standard",
          status: "active",
          value: 20000,
          startDate: "2026-01-01",
          endDate: "2027-01-01",
          renewalDaysRemaining: 100,
          paymentTerms: "Net 30",
          autoRenew: false,
          owner: "beta@apex.local",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxB
      );

      // Deleting custA in Org A should succeed without interference from Org B records
      const deleted = await db.customersRepo.delete(custA.id, ctxA);
      if (!deleted) throw new Error("Deletion in Org A failed");
    }
  );

  await runTest(
    "6.2 ISOLATION: Cross-tenant deletion attempt throws CrossTenantViolationError",
    async () => {
      const db = new DatabaseStore();
      const custA = await db.customersRepo.create(
        {
          id: "cust-org-a-private",
          name: "Org A Private Customer",
          tier: "Enterprise",
          status: "active",
          healthScore: 95,
          arr: 500000,
          owner: "alpha@apex.local",
          contactName: "Private Lead",
          contactRole: "Lead",
          contactEmail: "lead@priv.com",
          since: "2026-01-01",
          tags: ["private"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      // Org B user attempts to delete Org A customer
      await assertThrows(
        () => db.customersRepo.delete(custA.id, ctxB),
        CrossTenantViolationError
      );
    }
  );

  // =========================================================================
  // 7. AUDIT TRAIL LOGGING ON DELETION
  // =========================================================================

  await runTest(
    "7.1 AUDIT: Deleting an entity logs a successful audit event with actor context",
    async () => {
      const db = new DatabaseStore();
      const cust = await db.customersRepo.create(
        {
          id: "cust-audit-del",
          name: "Audit Test Customer",
          tier: "SMB",
          status: "active",
          healthScore: 90,
          arr: 15000,
          owner: "alpha@apex.local",
          contactName: "Audit Contact",
          contactRole: "Manager",
          contactEmail: "audit@test.com",
          since: "2026-01-01",
          tags: ["audit"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ctxA
      );

      await db.customersRepo.delete(cust.id, ctxA);

      const logs = await db.auditLogsRepo.findMany(ctxA, 10);
      const deleteLog = logs.find(
        (l) => l.action === "customer:delete" && l.resourceId === cust.id
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
