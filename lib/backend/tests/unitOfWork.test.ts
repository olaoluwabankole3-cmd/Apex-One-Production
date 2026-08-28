/**
 * APEX ONE — Unit of Work & Transaction Hardening Test Suite
 * 
 * Tests atomic transaction boundaries, multi-repository atomicity,
 * audit trail atomicity, snapshot/rollback semantics, tenant context immutability,
 * error preservation, and nested transaction semantics.
 */

import { DatabaseStore } from "../database/store";
import { ProductionDataProvider } from "../database/demoDataProvider";
import {
  TenantContext,
  NotFoundError,
  ValidationError,
  ForbiddenError,
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

export async function runUnitOfWorkTestSuite(): Promise<TestSuiteSummary> {
  const results: TestResult[] = [];

  const runTest = async (name: string, fn: () => Promise<void>) => {
    const t0 = performance.now();
    try {
      await fn();
      results.push({
        suite: "UnitOfWork & Transaction Hardening",
        testName: name,
        passed: true,
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (err: any) {
      results.push({
        suite: "UnitOfWork & Transaction Hardening",
        testName: name,
        passed: false,
        error: err?.message || String(err),
        durationMs: Math.round(performance.now() - t0),
      });
    }
  };

  const alphaCtx: TenantContext = {
    organizationId: "org-apex-alpha",
    userId: "user-alpha-admin",
    userEmail: "alex.chen@nexuscorp.com",
    userRole: "admin",
    permissions: [
      "customer:read",
      "customer:write",
      "customer:delete",
      "workflow:read",
      "workflow:write",
      "workflow:execute",
      "action:read",
      "action:create",
      "action:approve",
      "action:execute",
      "value:read",
      "value:approve",
      "audit:read",
      "org:read",
      "org:write",
      "document:read",
      "document:write",
      "document:delete",
      "knowledge:read",
      "knowledge:write",
    ],
    requestId: "req-uow-test",
  };

  const betaCtx: TenantContext = {
    organizationId: "org-apex-beta",
    userId: "user-beta-admin",
    userEmail: "marcus.vance@vanguard.io",
    userRole: "admin",
    permissions: [
      "customer:read",
      "customer:write",
      "customer:delete",
      "workflow:read",
      "workflow:write",
      "workflow:execute",
      "action:read",
      "action:create",
      "audit:read",
      "org:read",
      "org:write",
    ],
    requestId: "req-uow-test-beta",
  };

  // Test 1: Successful transaction commits all mutations
  await runTest("1. Successful transaction commits all multi-repository mutations", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());

    const result = await store.runInTransaction(alphaCtx, async (uow) => {
      const cust = await uow.customers.create(
        {
          id: "cust-tx-1",
          name: "Tx Commit Test Account",
          subsidiary: "General Operations",
          tier: "Enterprise",
          status: "active",
          healthScore: 90,
          arr: 250000,
          owner: alphaCtx.userEmail,
          contactName: "John Doe",
          contactRole: "Director",
          contactEmail: "john.doe@testcommit.com",
          tags: ["Test"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        uow.context
      );

      const action = await uow.actions.create(
        {
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
        },
        uow.context
      );

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

    // Verify both items and the audit log exist in store
    const foundCust = await store.customersRepo.findById(result.custId, alphaCtx);
    if (!foundCust || foundCust.name !== "Tx Commit Test Account") {
      throw new Error("Customer record was not committed to store");
    }

    const foundAct = await store.actionsRepo.findById(result.actId, alphaCtx);
    if (!foundAct || foundAct.recommendation !== "Execute renewal optimization") {
      throw new Error("Action record was not committed to store");
    }

    const logs = await store.auditLogsRepo.findMany(alphaCtx);
    const hasLog = logs.some((l) => l.action === "test:multi_repo_commit" && l.resourceId === result.custId);
    if (!hasLog) {
      throw new Error("Audit log record was not committed to store");
    }
  });

  // Test 2: Failed transaction rolls back all mutations
  await runTest("2. Failed transaction cleanly rolls back all staged mutations", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());
    const initialCustomerCount = (await store.customersRepo.findMany(alphaCtx)).length;
    const initialActionCount = (await store.actionsRepo.findMany(alphaCtx)).length;
    const initialAuditCount = (await store.auditLogsRepo.findMany(alphaCtx)).length;

    let thrownError: any = null;
    try {
      await store.runInTransaction(alphaCtx, async (uow) => {
        await uow.customers.create(
          {
            id: "cust-tx-fail",
            name: "Should Rollback Account",
            subsidiary: "General Operations",
            tier: "Enterprise",
            status: "active",
            healthScore: 90,
            arr: 100000,
            owner: alphaCtx.userEmail,
            contactName: "Fail Doe",
            contactRole: "Lead",
            contactEmail: "fail@rollback.com",
            tags: ["Fail"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          uow.context
        );

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

        // Deliberately trigger failure
        throw new ConflictError("Simulated business invariant violation during transaction");
      });
    } catch (err: any) {
      thrownError = err;
    }

    if (!thrownError || !(thrownError instanceof ConflictError)) {
      throw new Error(`Expected ConflictError but received ${thrownError}`);
    }

    // Verify complete rollback in store
    const postCustomerCount = (await store.customersRepo.findMany(alphaCtx)).length;
    const postActionCount = (await store.actionsRepo.findMany(alphaCtx)).length;
    const postAuditCount = (await store.auditLogsRepo.findMany(alphaCtx)).length;

    if (postCustomerCount !== initialCustomerCount) {
      throw new Error(`Customer count changed after rollback: before=${initialCustomerCount}, after=${postCustomerCount}`);
    }
    if (postActionCount !== initialActionCount) {
      throw new Error(`Action count changed after rollback: before=${initialActionCount}, after=${postActionCount}`);
    }
    if (postAuditCount !== initialAuditCount) {
      throw new Error(`Audit log count changed after rollback: before=${initialAuditCount}, after=${postAuditCount}`);
    }

    // Verify entity is not findable
    let findThrew = false;
    try {
      await store.customersRepo.findById("cust-tx-fail", alphaCtx);
    } catch (e: any) {
      if (e instanceof NotFoundError) findThrew = true;
    }
    if (!findThrew) {
      throw new Error("Rolled back customer record should not exist in database");
    }
  });

  // Test 3: Audit + Business mutation are atomic
  await runTest("3. Business mutation + audit mutation are strictly atomic", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());
    const initialAuditLogs = await store.auditLogsRepo.findMany(alphaCtx);

    // Case A: Business mutation succeeds, but an error in transaction callback triggers rollback
    try {
      await store.runInTransaction(alphaCtx, async (uow) => {
        await uow.customers.create(
          {
            id: "cust-tx-atomic-1",
            name: "Atomic Test",
            subsidiary: "General Operations",
            tier: "Enterprise",
            status: "active",
            healthScore: 80,
            arr: 100000,
            owner: alphaCtx.userEmail,
            contactName: "Atomic Lead",
            contactRole: "Lead",
            contactEmail: "atomic@test.com",
            tags: ["Atomic"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          uow.context
        );

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

        throw new Error("Simulated secondary failure after recording audit");
      });
    } catch {
      // Expected
    }

    const currentAuditLogs = await store.auditLogsRepo.findMany(alphaCtx);
    if (currentAuditLogs.length !== initialAuditLogs.length) {
      throw new Error("Audit log was persisted despite transaction failure!");
    }
    const hasOrphanAudit = currentAuditLogs.some((l) => l.resourceId === "cust-tx-atomic-1");
    if (hasOrphanAudit) {
      throw new Error("Audit log for rolled back customer exists in database");
    }
  });

  // Test 4: Multi-repository mutation rolls back together
  await runTest("4. Multi-repository operations roll back together completely", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());

    // Create a base workflow to operate on
    const wf = await store.workflowsRepo.create(
      {
        id: "wf-tx-multi",
        organizationId: alphaCtx.organizationId,
        name: "Multi-Repo Test Workflow",
        description: "Testing multi-repo rollback",
        subsidiary: "General Operations",
        status: "active",
        version: 1,
        nodes: [{ id: "n1", type: "trigger", title: "Start" }],
        connections: [],
        runsCount: 0,
        successRate: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      alphaCtx
    );

    const initialRunsCount = wf.runsCount;
    const initialRunRecordsCount = (await store.workflowRunsRepo.findByWorkflow(wf.id, alphaCtx)).length;

    try {
      await store.runInTransaction(alphaCtx, async (uow) => {
        // Step 1: Update workflow runs count
        await uow.workflows.update(wf.id, { runsCount: initialRunsCount + 1 }, uow.context);

        // Step 2: Create workflow run record
        await uow.workflowRuns.create(
          {
            id: "run-tx-fail",
            organizationId: uow.context.organizationId,
            workflowId: wf.id,
            workflowVersion: wf.version,
            triggeredBy: uow.context.userEmail,
            triggerType: "manual",
            status: "running",
            steps: [],
            contextData: {},
            startedAt: new Date().toISOString(),
          },
          uow.context
        );

        // Step 3: Failure on third operation
        throw new ValidationError("Graph execution initialization failed");
      });
    } catch {
      // Expected
    }

    const reloadedWf = await store.workflowsRepo.findById(wf.id, alphaCtx);
    if (reloadedWf.runsCount !== initialRunsCount) {
      throw new Error(`Workflow runsCount was not rolled back: expected ${initialRunsCount}, got ${reloadedWf.runsCount}`);
    }

    const reloadedRuns = await store.workflowRunsRepo.findByWorkflow(wf.id, alphaCtx);
    if (reloadedRuns.length !== initialRunRecordsCount) {
      throw new Error(`Workflow run record was not rolled back: expected ${initialRunRecordsCount}, got ${reloadedRuns.length}`);
    }
  });

  // Test 5: TenantContext remains unchanged and immutable
  await runTest("5. TenantContext is deeply frozen and immutable during transaction", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());

    await store.runInTransaction(alphaCtx, async (uow) => {
      // Verify frozen context
      if (!Object.isFrozen(uow.context)) {
        throw new Error("uow.context is not frozen");
      }

      // Attempting mutation should throw or fail silently without changing value
      try {
        (uow.context as any).organizationId = "org-apex-hacked";
      } catch {
        // TypeError expected in strict mode
      }

      if (uow.context.organizationId !== "org-apex-alpha") {
        throw new Error(`TenantContext organizationId was mutated to ${uow.context.organizationId}`);
      }

      try {
        (uow.context.permissions as any).push("super:admin");
      } catch {
        // TypeError expected in strict mode
      }

      if ((uow.context.permissions as any).includes("super:admin")) {
        throw new Error("TenantContext permissions array was mutated");
      }
    });
  });

  // Test 6: Cross-tenant mutation remains strictly rejected
  await runTest("6. Cross-tenant mutations inside transaction are rejected and rolled back", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());

    let caughtError: any = null;
    try {
      await store.runInTransaction(alphaCtx, async (uow) => {
        // Attempting to record audit for a foreign organization inside alpha transaction
        await uow.recordAuditLog({
          organizationId: "org-apex-beta", // foreign org
          actorId: uow.context.userId,
          actorEmail: uow.context.userEmail,
          action: "cross_tenant:audit",
          resource: "Customer",
          resourceId: "cust-1",
          requestId: uow.context.requestId,
          status: "denied",
        });
      });
    } catch (err: any) {
      caughtError = err;
    }

    if (!caughtError || !(caughtError instanceof CrossTenantViolationError)) {
      throw new Error(`Expected CrossTenantViolationError, got ${caughtError}`);
    }
  });

  // Test 7: Original error types and instances are preserved
  await runTest("7. Domain error types (NotFoundError, ConflictError, ValidationError, etc.) are preserved", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());

    // 7.1 NotFoundError preservation
    try {
      await store.runInTransaction(alphaCtx, async (uow) => {
        await uow.customers.findById("non-existent-id", uow.context, "Customer");
      });
      throw new Error("Should have thrown NotFoundError");
    } catch (err: any) {
      if (!(err instanceof NotFoundError)) {
        throw new Error(`Expected NotFoundError instance, received: ${err?.constructor?.name}`);
      }
      if (err.code !== "NOT_FOUND" || err.statusCode !== 404) {
        throw new Error(`Expected NOT_FOUND with status 404, got code=${err.code}, status=${err.statusCode}`);
      }
    }

    // 7.2 ValidationError preservation
    try {
      await store.runInTransaction(alphaCtx, async () => {
        throw new ValidationError("Invalid field input");
      });
      throw new Error("Should have thrown ValidationError");
    } catch (err: any) {
      if (!(err instanceof ValidationError)) {
        throw new Error(`Expected ValidationError instance, received: ${err?.constructor?.name}`);
      }
    }

    // 7.3 ForbiddenError preservation
    try {
      await store.runInTransaction(alphaCtx, async () => {
        throw new ForbiddenError("Insufficient privileges");
      });
      throw new Error("Should have thrown ForbiddenError");
    } catch (err: any) {
      if (!(err instanceof ForbiddenError)) {
        throw new Error(`Expected ForbiddenError instance, received: ${err?.constructor?.name}`);
      }
    }
  });

  // Test 8: Nested transactions participate in ambient transaction (Propagation REQUIRED)
  await runTest("8. Nested transactions participate in ambient transaction and enforce tenant match", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());
    const initialCustomerCount = (await store.customersRepo.findMany(alphaCtx)).length;

    // 8.1 Successful nested transaction
    await store.runInTransaction(alphaCtx, async (outerUow) => {
      await outerUow.customers.create(
        {
          id: "cust-nested-1",
          name: "Outer Account",
          subsidiary: "General Operations",
          tier: "Enterprise",
          status: "active",
          healthScore: 85,
          arr: 150000,
          owner: alphaCtx.userEmail,
          contactName: "Outer Lead",
          contactRole: "Lead",
          contactEmail: "outer@test.com",
          tags: ["Nested"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        outerUow.context
      );

      // Inner nested transaction with same tenant context
      await store.runInTransaction(alphaCtx, async (innerUow) => {
        await innerUow.customers.create(
          {
            id: "cust-nested-2",
            name: "Inner Account",
            subsidiary: "General Operations",
            tier: "Enterprise",
            status: "active",
            healthScore: 90,
            arr: 120000,
            owner: alphaCtx.userEmail,
            contactName: "Inner Lead",
            contactRole: "Lead",
            contactEmail: "inner@test.com",
            tags: ["Nested"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          innerUow.context
        );
      });
    });

    const postCount = (await store.customersRepo.findMany(alphaCtx)).length;
    if (postCount !== initialCustomerCount + 2) {
      throw new Error(`Expected ${initialCustomerCount + 2} customers, found ${postCount}`);
    }

    // 8.2 Inner failure rolls back outer mutations
    const baseCount = (await store.customersRepo.findMany(alphaCtx)).length;
    try {
      await store.runInTransaction(alphaCtx, async (outerUow) => {
        await outerUow.customers.create(
          {
            id: "cust-nested-3",
            name: "Outer Should Rollback",
            subsidiary: "General Operations",
            tier: "Enterprise",
            status: "active",
            healthScore: 85,
            arr: 150000,
            owner: alphaCtx.userEmail,
            contactName: "Lead",
            contactRole: "Lead",
            contactEmail: "lead@test.com",
            tags: ["Rollback"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          outerUow.context
        );

        // Inner nested transaction throws
        await store.runInTransaction(alphaCtx, async () => {
          throw new ConflictError("Inner nested operation failed");
        });
      });
    } catch {
      // Expected
    }

    const rollbackCount = (await store.customersRepo.findMany(alphaCtx)).length;
    if (rollbackCount !== baseCount) {
      throw new Error(`Outer transaction was not rolled back when inner transaction failed: base=${baseCount}, current=${rollbackCount}`);
    }

    // 8.3 Cross-tenant nested transaction is rejected
    let crossTenantThrew = false;
    try {
      await store.runInTransaction(alphaCtx, async () => {
        await store.runInTransaction(betaCtx, async () => {
          // Should not execute
        });
      });
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError) {
        crossTenantThrew = true;
      }
    }
    if (!crossTenantThrew) {
      throw new Error("Cross-tenant nested transaction should have thrown CrossTenantViolationError");
    }
  });

  // Test 9: Domain Service Integrations (CustomerService, WorkflowService, ActionService)
  await runTest("9. Domain service methods execute atomically with automatic audit logging", async () => {
    // 9.1 CustomerService.createCustomer
    const createdCust = await customerService.createCustomer(
      {
        name: "Atomic Service Customer",
        contactEmail: "atomic.service@apex.test",
        tier: "Enterprise",
        arr: 300000,
        healthScore: 92,
      },
      alphaCtx
    );

    if (!createdCust || createdCust.name !== "Atomic Service Customer") {
      throw new Error("CustomerService.createCustomer failed to create customer");
    }

    // 9.2 WorkflowService.createWorkflow + triggerWorkflowRun
    const createdWf = await workflowService.createWorkflow(
      {
        name: "Service Test Workflow",
        nodes: [{ id: "n1", type: "trigger", title: "Trigger Step" }],
        connections: [],
      },
      alphaCtx
    );

    const initialRuns = createdWf.runsCount;
    const run = await workflowService.triggerWorkflowRun(
      {
        workflowId: createdWf.id,
        triggerType: "manual",
        contextData: { source: "uow_test" },
      },
      alphaCtx
    );

    if (!run || run.workflowId !== createdWf.id) {
      throw new Error("WorkflowService.triggerWorkflowRun failed to return valid run record");
    }

    const updatedWf = await workflowService.getWorkflowById(createdWf.id, alphaCtx);
    if (updatedWf.runsCount !== initialRuns + 1) {
      throw new Error(`Workflow runsCount did not increment atomically: before=${initialRuns}, after=${updatedWf.runsCount}`);
    }

    // 9.3 ActionService.createAction
    const action = await actionService.createAction(
      {
        recommendation: "Validate service transaction integration",
        expectedValue: 75000,
        confidence: 96,
        automationType: "AI-assisted",
      },
      alphaCtx
    );

    if (!action || action.status !== "Ready") {
      throw new Error("ActionService.createAction failed");
    }
  });

  // Test 10: No transaction allows organizationId mutation
  await runTest("10. Repository update mutations cannot change organizationId even in transaction", async () => {
    const store = DatabaseStore.createFreshStore(new ProductionDataProvider());
    const cust = await store.customersRepo.create(
      {
        id: "cust-org-lock-test",
        name: "Org Lock Test Account",
        subsidiary: "General Operations",
        tier: "Enterprise",
        status: "active",
        healthScore: 90,
        arr: 200000,
        owner: alphaCtx.userEmail,
        contactName: "Lock Lead",
        contactRole: "Lead",
        contactEmail: "lock@test.com",
        tags: ["Lock"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      alphaCtx
    );

    await store.runInTransaction(alphaCtx, async (uow) => {
      // Attempting to update organizationId should be stripped by repository
      await uow.customers.update(
        cust.id,
        {
          name: "Updated Name Safe",
          organizationId: "org-apex-beta", // Attacking tenant ownership
        } as any,
        uow.context
      );
    });

    const reloaded = await store.customersRepo.findById(cust.id, alphaCtx);
    if (reloaded.organizationId !== "org-apex-alpha") {
      throw new Error(`Customer organizationId was illegally updated to ${reloaded.organizationId}`);
    }
    if (reloaded.name !== "Updated Name Safe") {
      throw new Error("Customer name was not updated");
    }
  });

  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  return {
    total,
    passedCount,
    failedCount,
    results,
  };
}
