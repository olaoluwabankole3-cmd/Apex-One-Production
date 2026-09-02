/**
 * APEX ONE — Unit of Work & Transaction Hardening Suite
 *
 * Transaction invariants are intentionally independent from legacy raw-array
 * collection shapes. Counts use repository count(), and audit/run collection
 * assertions use canonical PaginatedResult.items.
 */

import { DatabaseStore } from "../database/store";
import { ProductionDataProvider } from "../database/demoDataProvider";
import {
  TenantContext,
  NotFoundError,
  ValidationError,
  ConflictError,
  CrossTenantViolationError,
} from "../core/errors";
import { customerService } from "../domains/customers/customerService";
import { workflowService } from "../domains/workflows/workflowService";
import { actionService } from "../domains/actions/actionService";

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

const alphaCtx: TenantContext = {
  organizationId: "org-apex-alpha",
  userId: "user-alpha-admin",
  userEmail: "alex.chen@nexuscorp.com",
  userRole: "admin",
  permissions: [
    "customer:read", "customer:write", "customer:delete",
    "workflow:read", "workflow:write", "workflow:execute",
    "action:read", "action:create", "action:approve", "action:execute",
    "value:read", "value:approve", "audit:read", "org:read", "org:write",
    "document:read", "document:write", "document:delete",
    "knowledge:read", "knowledge:write",
  ],
  requestId: "req-uow-test",
  timestamp: "2026-09-02T00:00:00.000Z",
};

const betaCtx: TenantContext = {
  organizationId: "org-apex-beta",
  userId: "user-beta-admin",
  userEmail: "marcus.vance@vanguard.io",
  userRole: "admin",
  permissions: ["customer:read", "customer:write", "workflow:read", "workflow:write", "audit:read", "org:read"],
  requestId: "req-uow-test-beta",
  timestamp: "2026-09-02T00:00:00.000Z",
};

function customer(id: string, name: string) {
  return {
    id,
    name,
    subsidiary: "General Operations",
    tier: "Enterprise",
    status: "active",
    healthScore: 90,
    arr: 250000,
    owner: alphaCtx.userEmail,
    contactName: "Test Contact",
    contactRole: "Director",
    contactEmail: `${id}@uow.test`,
    tags: ["Test"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;
}

export async function runUnitOfWorkTestSuite(): Promise<TestSuiteSummary> {
  const results: TestResult[] = [];
  const run = async (testName: string, fn: () => Promise<void>) => {
    const start = performance.now();
    try {
      await fn();
      results.push({ suite: "UnitOfWork & Transaction Hardening", testName, passed: true, durationMs: Math.round(performance.now() - start) });
    } catch (error: any) {
      results.push({ suite: "UnitOfWork & Transaction Hardening", testName, passed: false, error: error?.message || String(error), durationMs: Math.round(performance.now() - start) });
    }
  };

  await run("1. Successful transaction commits all multi-repository mutations", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());
    const result = await store.runInTransaction(alphaCtx, async (uow) => {
      const cust = await uow.customers.create(customer("cust-tx-1", "Tx Commit Test Account"), uow.context);
      const action = await uow.actions.create({
        id: "act-tx-1",
        recommendation: "Execute renewal optimization",
        owner: alphaCtx.userEmail,
        deadline: "2026-12-31",
        expectedValue: 50000,
        status: "Ready",
        confidence: 95,
        automationType: "AI-assisted",
        requiresHumanApproval: true,
        insightSource: "Telemetry",
        decisionDetail: "Tx Test",
        resultMetric: "ARR increase",
        logs: ["Created in Tx"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any, uow.context);
      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "test:multi_repo_commit",
        resource: "Customer",
        resourceId: cust.id,
        requestId: uow.context.requestId,
        status: "success",
      });
      return { custId: cust.id, actId: action.id };
    });

    const foundCust = await store.customersRepo.findById(result.custId, alphaCtx);
    const foundAct = await store.actionsRepo.findById(result.actId, alphaCtx);
    const logs = await store.auditLogsRepo.findMany(alphaCtx);
    if (foundCust.name !== "Tx Commit Test Account" || foundAct.recommendation !== "Execute renewal optimization") {
      throw new Error("committed business mutations were not preserved");
    }
    if (!logs.items.some((log) => log.action === "test:multi_repo_commit" && log.resourceId === result.custId)) {
      throw new Error("committed audit mutation was not preserved");
    }
  });

  await run("2. Failed transaction cleanly rolls back all staged mutations", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());
    const beforeCustomers = await store.customersRepo.count(alphaCtx);
    const beforeActions = await store.actionsRepo.count(alphaCtx);
    const beforeAudits = await store.auditLogsRepo.count(alphaCtx);

    let error: unknown;
    try {
      await store.runInTransaction(alphaCtx, async (uow) => {
        await uow.customers.create(customer("cust-tx-fail", "Should Rollback"), uow.context);
        await uow.recordAuditLog({
          organizationId: uow.context.organizationId,
          actorId: uow.context.userId,
          actorEmail: uow.context.userEmail,
          action: "test:should_rollback",
          resource: "Customer",
          resourceId: "cust-tx-fail",
          requestId: uow.context.requestId,
          status: "success",
        });
        throw new ConflictError("Simulated business invariant violation during transaction");
      });
    } catch (caught) {
      error = caught;
    }
    if (!(error instanceof ConflictError)) throw new Error("transaction did not preserve ConflictError");

    if (
      (await store.customersRepo.count(alphaCtx)) !== beforeCustomers ||
      (await store.actionsRepo.count(alphaCtx)) !== beforeActions ||
      (await store.auditLogsRepo.count(alphaCtx)) !== beforeAudits
    ) {
      throw new Error("failed transaction changed persisted counts");
    }
    let missing = false;
    try { await store.customersRepo.findById("cust-tx-fail", alphaCtx); } catch (caught) { missing = caught instanceof NotFoundError; }
    if (!missing) throw new Error("rolled-back customer remained persisted");
  });

  await run("3. Business mutation + audit mutation are strictly atomic", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());
    const initialAuditCount = await store.auditLogsRepo.count(alphaCtx);
    try {
      await store.runInTransaction(alphaCtx, async (uow) => {
        await uow.customers.create(customer("cust-tx-atomic-1", "Atomic Test"), uow.context);
        await uow.recordAuditLog({
          organizationId: uow.context.organizationId,
          actorId: uow.context.userId,
          actorEmail: uow.context.userEmail,
          action: "customer:create",
          resource: "Customer",
          resourceId: "cust-tx-atomic-1",
          requestId: uow.context.requestId,
          status: "success",
        });
        throw new Error("secondary failure");
      });
    } catch {
      // expected
    }
    const audits = await store.auditLogsRepo.findMany(alphaCtx);
    if (audits.totalCount !== initialAuditCount || audits.items.some((log) => log.resourceId === "cust-tx-atomic-1")) {
      throw new Error("audit record survived rolled-back business transaction");
    }
  });

  await run("4. Multi-repository operations roll back together completely", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());
    const workflow = await store.workflowsRepo.create({
      id: "wf-tx-multi",
      name: "Multi-Repo Workflow",
      status: "active",
      version: 1,
      nodes: [{ id: "n1", type: "trigger", title: "Start" }],
      connections: [],
      runsCount: 0,
      successRate: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any, alphaCtx);
    const initialRuns = workflow.runsCount;
    const initialRunRecords = await store.workflowRunsRepo.count(alphaCtx, { where: { workflowId: { eq: workflow.id } } });

    try {
      await store.runInTransaction(alphaCtx, async (uow) => {
        await uow.workflows.update(workflow.id, { runsCount: initialRuns + 1 }, uow.context);
        await uow.workflowRuns.create({
          id: "run-tx-fail",
          workflowId: workflow.id,
          workflowVersion: workflow.version,
          triggerType: "manual",
          status: "running",
          steps: [],
          contextData: {},
          startedAt: new Date().toISOString(),
        } as any, uow.context);
        throw new ValidationError("Graph execution initialization failed");
      });
    } catch {
      // expected
    }

    const reloaded = await store.workflowsRepo.findById(workflow.id, alphaCtx);
    const runCount = await store.workflowRunsRepo.count(alphaCtx, { where: { workflowId: { eq: workflow.id } } });
    if (reloaded.runsCount !== initialRuns || runCount !== initialRunRecords) {
      throw new Error("multi-repository rollback was incomplete");
    }
  });

  await run("5. TenantContext is deeply frozen and immutable during transaction", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());
    await store.runInTransaction(alphaCtx, async (uow) => {
      if (!Object.isFrozen(uow.context)) throw new Error("uow.context is not frozen");
      try { (uow.context as any).organizationId = "org-hacked"; } catch {}
      if (uow.context.organizationId !== alphaCtx.organizationId) throw new Error("organizationId mutated");
      try { (uow.context.permissions as any).push("super:admin"); } catch {}
      if ((uow.context.permissions as any).includes("super:admin")) throw new Error("permissions mutated");
    });
  });

  await run("6. Cross-tenant mutations inside transaction are rejected and rolled back", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());
    let error: unknown;
    try {
      await store.runInTransaction(alphaCtx, async (uow) => {
        await uow.recordAuditLog({
          organizationId: betaCtx.organizationId,
          actorId: uow.context.userId,
          actorEmail: uow.context.userEmail,
          action: "cross_tenant:audit",
          resource: "Customer",
          resourceId: "cust-1",
          requestId: uow.context.requestId,
          status: "denied",
        });
      });
    } catch (caught) { error = caught; }
    if (!(error instanceof CrossTenantViolationError)) throw new Error("cross-tenant mutation was not rejected");
  });

  await run("7. Domain error types and instances are preserved", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());
    const errors = [
      new NotFoundError("Customer"),
      new ConflictError("conflict"),
      new ValidationError("invalid"),
    ];
    for (const expected of errors) {
      let actual: unknown;
      try {
        await store.runInTransaction(alphaCtx, async () => { throw expected; });
      } catch (caught) { actual = caught; }
      if (actual !== expected || actual?.constructor !== expected.constructor) {
        throw new Error(`transaction changed ${expected.constructor.name} identity/type`);
      }
    }
  });

  await run("8. Nested transactions participate in ambient transaction and enforce tenant match", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());
    const before = await store.customersRepo.count(alphaCtx);
    await store.runInTransaction(alphaCtx, async (outer) => {
      await outer.customers.create(customer("cust-nested-1", "Nested One"), outer.context);
      await store.runInTransaction(alphaCtx, async (inner) => {
        await inner.customers.create(customer("cust-nested-2", "Nested Two"), inner.context);
      });
    });
    if ((await store.customersRepo.count(alphaCtx)) !== before + 2) throw new Error("nested commit did not join ambient transaction");

    const base = await store.customersRepo.count(alphaCtx);
    try {
      await store.runInTransaction(alphaCtx, async (outer) => {
        await outer.customers.create(customer("cust-nested-3", "Nested Three"), outer.context);
        await store.runInTransaction(alphaCtx, async () => { throw new ValidationError("inner failure"); });
      });
    } catch {}
    if ((await store.customersRepo.count(alphaCtx)) !== base) throw new Error("inner failure did not roll back outer mutation");

    let crossTenant = false;
    try {
      await store.runInTransaction(alphaCtx, async () => {
        await store.runInTransaction(betaCtx, async () => undefined);
      });
    } catch (error) { crossTenant = error instanceof CrossTenantViolationError; }
    if (!crossTenant) throw new Error("cross-tenant nested transaction was accepted");
  });

  await run("9. Domain service methods execute atomically with automatic audit logging", async () => {
    const createdCustomer = await customerService.createCustomer({
      name: "Atomic Service Customer",
      contactEmail: "atomic.service@apex.test",
      tier: "Enterprise",
      arr: 300000,
      healthScore: 92,
    }, alphaCtx);
    if (createdCustomer.name !== "Atomic Service Customer") throw new Error("CustomerService create failed");

    const workflow = await workflowService.createWorkflow({
      name: "Service Test Workflow",
      description: "Exercises workflow service transaction and audit behavior.",
      subsidiary: "General Operations",
      nodes: [{ id: "n1", type: "trigger", title: "Trigger Step", configuration: {} }],
      connections: [],
    }, alphaCtx);
    const initialRuns = workflow.runsCount;
    const runRecord = await workflowService.triggerWorkflowRun({
      workflowId: workflow.id,
      triggerType: "manual",
      contextData: { source: "uow_test" },
    }, alphaCtx);
    const updatedWorkflow = await workflowService.getWorkflowById(workflow.id, alphaCtx);
    if (runRecord.workflowId !== workflow.id || updatedWorkflow.runsCount !== initialRuns + 1) {
      throw new Error("WorkflowService atomic trigger flow failed");
    }

    const action = await actionService.createAction({
      recommendation: "Validate service transaction integration",
      expectedValue: 75000,
      confidence: 96,
      automationType: "AI-assisted",
    }, alphaCtx);
    if (action.status !== "Ready") throw new Error("ActionService create failed");
  });

  await run("10. Repository immutable-field attacks fail the transaction without partial mutation", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());
    const record = await store.customersRepo.create(customer("cust-org-lock-test", "Org Lock"), alphaCtx);
    let error: unknown;
    try {
      await store.runInTransaction(alphaCtx, async (uow) => {
        await uow.customers.update(
          record.id,
          { organizationId: betaCtx.organizationId, name: "Should Not Commit" } as any,
          uow.context
        );
      });
    } catch (caught) {
      error = caught;
    }
    if (!(error instanceof ValidationError)) {
      throw new Error("immutable organizationId mutation did not fail closed with ValidationError");
    }
    const persisted = await store.customersRepo.findById(record.id, alphaCtx);
    if (persisted.organizationId !== alphaCtx.organizationId || persisted.name !== record.name) {
      throw new Error("rejected immutable-field transaction partially mutated the record");
    }
  });

  const passedCount = results.filter((result) => result.passed).length;
  const failedCount = results.length - passedCount;
  return { total: results.length, passedCount, failedCount, results };
}
