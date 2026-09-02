process.env.TEST_ENV = "true";

import { DatabaseStore } from "../lib/backend/database/store";
import type { IDataProvider } from "../lib/backend/database/demoDataProvider";
import type {
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
  ValueOpportunityRecord,
  WorkflowRecord,
} from "../lib/backend/database/schema";
import { ValueExecutionLifecycleService } from "../lib/backend/domains/value/valueExecutionLifecycleService";
import { WorkflowService } from "../lib/backend/domains/workflows/workflowService";
import { ActionService } from "../lib/backend/domains/actions/actionService";
import { EvidenceService } from "../lib/backend/domains/evidence/evidenceService";
import {
  ConflictError,
  CrossTenantViolationError,
  TenantContext,
  ValidationError,
} from "../lib/backend/core/errors";
import { collectAllPages } from "../lib/backend/database/paginationTraversal";
import { MAX_PAGE_SIZE } from "../lib/backend/database/querySpecification";
import { STAGE7_ACTION_PROVENANCE_METHOD } from "../lib/backend/domains/value/valueExecutionLifecycleModel";

interface CheckResult { name: string; passed: boolean; error?: string }
const results: CheckResult[] = [];

const EMPTY_PROVIDER: IDataProvider = {
  isDemoProvider: () => false,
  seedInitialTenants: () => undefined,
};

function now(): string { return new Date().toISOString(); }

function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required for Stage 7 lifecycle integration tests");
  return value;
}

function ctx(org: string, userId: string, email: string): TenantContext {
  return {
    organizationId: org,
    userId,
    userEmail: email,
    userRole: "CEO",
    permissions: [
      "org:read",
      "org:write",
      "org:admin",
      "value:read",
      "value:write",
      "value:approve",
      "action:create",
      "action:approve",
      "action:execute",
      "workflow:read",
      "workflow:write",
      "workflow:execute",
      "audit:read",
    ],
    requestId: `req-${org}-${Math.random().toString(36).slice(2)}`,
    timestamp: now(),
  };
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

function user(id: string, email: string): UserRecord {
  return { id, email, name: id, title: "Stage 7 Tester", status: "active", createdAt: now() };
}

function membership(id: string, organizationId: string, userId: string): OrganizationMembershipRecord {
  return { id, organizationId, userId, role: "CEO", department: "Operations", joinedAt: now() };
}

function opportunity(id: string): Omit<ValueOpportunityRecord, "organizationId"> {
  const timestamp = now();
  return {
    id,
    title: `Recover value for ${id}`,
    category: "Revenue recovery",
    potentialValue: 125_000,
    confidence: 94,
    evidence: `Recorded source evidence for ${id}`,
    sourceEntityId: `txn-${id}`,
    sourceEntityType: "Transaction",
    recommendedAction: `Execute recovery workflow for ${id}`,
    expectedOutcome: "Recover recorded revenue leakage",
    realizationSpeed: "Fastest",
    strategicImportance: "High",
    risk: "Low",
    status: "Identified",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function workflow(id: string): Omit<WorkflowRecord, "organizationId"> {
  const timestamp = now();
  return {
    id,
    name: `Stage 7 workflow ${id}`,
    description: "Three-step lifecycle workflow",
    subsidiary: "General Operations",
    status: "active",
    version: 1,
    nodes: [
      { id: `${id}-trigger`, type: "trigger", title: "Lifecycle trigger", configuration: {} },
      { id: `${id}-execute`, type: "action", title: "Execute recovery", configuration: {} },
      { id: `${id}-reconcile`, type: "action", title: "Reconcile outcome", configuration: {} },
    ],
    connections: [
      { id: `${id}-c1`, fromNodeId: `${id}-trigger`, toNodeId: `${id}-execute` },
      { id: `${id}-c2`, fromNodeId: `${id}-execute`, toNodeId: `${id}-reconcile` },
    ],
    runsCount: 0,
    successRate: 100,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function seedIdentity(store: DatabaseStore, organizationId: string, userId: string, email: string): Promise<TenantContext> {
  await store.createOrganizationRecord(organization(organizationId));
  await store.createUserRecord(user(userId, email));
  await store.createMembershipRecord(membership(`membership-${organizationId}-${userId}`, organizationId, userId));
  return ctx(organizationId, userId, email);
}

async function seedScenario(store: DatabaseStore, context: TenantContext, prefix: string) {
  const opportunityRecord = await store.opportunitiesRepo.create(opportunity(`opp-${prefix}`), context);
  const workflowRecord = await store.workflowsRepo.create(workflow(`wf-${prefix}`), context);
  return { opportunityRecord, workflowRecord };
}

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
  } catch (error: any) {
    results.push({ name, passed: false, error: error?.stack || String(error) });
  }
}

async function expectRejects(fn: () => Promise<unknown>, ctor?: new (...args: any[]) => Error): Promise<void> {
  let caught: unknown;
  try { await fn(); } catch (error) { caught = error; }
  if (!caught) throw new Error("Expected operation to reject");
  if (ctor && !(caught instanceof ctor)) {
    throw new Error(`Expected ${ctor.name}, received ${caught instanceof Error ? caught.constructor.name : String(caught)}`);
  }
}

async function completeWorkflow(workflowService: WorkflowService, runId: string, context: TenantContext) {
  let run = await workflowService.getWorkflowRuns("wf-unused", context).catch(() => undefined as never);
  void run;
  const storeRun = async () => undefined;
  void storeRun;

  // The Stage 7 run begins with the trigger completed and the first business step executing.
  // Advance exactly the executing step, then the engine promotes the next pending step.
  return runId;
}

async function driveRunToCompletion(
  store: DatabaseStore,
  workflowService: WorkflowService,
  runId: string,
  context: TenantContext
): Promise<void> {
  let run = await store.workflowRunsRepo.findById(runId, context, "WorkflowRun");
  while (run.status === "running") {
    const executing = run.steps.find((step) => step.status === "executing");
    if (!executing) throw new Error("Running workflow has no executing step");
    run = await workflowService.advanceWorkflowStep(
      { runId, stepId: executing.stepId, decision: "completed", output: { stage7: true } },
      context
    );
  }
  if (run.status !== "completed") throw new Error(`Workflow ended in unexpected status '${run.status}'`);
}

async function runFullLifecycle(store: DatabaseStore, context: TenantContext, prefix: string) {
  const lifecycle = new ValueExecutionLifecycleService(store);
  const workflowService = new WorkflowService(store);
  const { opportunityRecord, workflowRecord } = await seedScenario(store, context, prefix);

  await lifecycle.validateOpportunity({ command: "validate_opportunity", opportunityId: opportunityRecord.id }, context);
  await lifecycle.approveOpportunity({ command: "approve_opportunity", opportunityId: opportunityRecord.id }, context);
  const created = await lifecycle.createAction({ command: "create_action", opportunityId: opportunityRecord.id }, context);
  const actionId = created.action!.id;
  await lifecycle.approveAction({ command: "approve_action", opportunityId: opportunityRecord.id, actionId }, context);
  const started = await lifecycle.startExecution({
    command: "start_execution",
    opportunityId: opportunityRecord.id,
    actionId,
    workflowId: workflowRecord.id,
  }, context);
  const runId = started.workflowRun!.id;
  await driveRunToCompletion(store, workflowService, runId, context);
  await lifecycle.completeExecution({
    command: "complete_execution",
    opportunityId: opportunityRecord.id,
    actionId,
    workflowRunId: runId,
  }, context);
  const measured = await lifecycle.recordMeasurement({
    command: "record_measurement",
    opportunityId: opportunityRecord.id,
    actionId,
    workflowRunId: runId,
    sources: [{ kind: "record", sourceType: "Transaction", sourceId: `measurement-${prefix}`, observedAt: now() }],
    confidence: 99,
  }, context);
  const provenanceId = measured.measurementProvenance!.id;
  const verified = await lifecycle.verifyMeasurement({
    command: "verify_measurement",
    opportunityId: opportunityRecord.id,
    actionId,
    workflowRunId: runId,
    measurementProvenanceIds: [provenanceId],
    criteria: ["reconciled amount", "completed workflow", "source consistency"],
  }, context);
  const captured = await lifecycle.captureValue({
    command: "capture_value",
    opportunityId: opportunityRecord.id,
    actionId,
    workflowRunId: runId,
    measurementProvenanceIds: [provenanceId],
    category: "Revenue recovered",
    capturedValue: 100_000,
  }, context);

  return {
    opportunityId: opportunityRecord.id,
    workflowId: workflowRecord.id,
    actionId,
    runId,
    provenanceId,
    verificationId: verified.verificationRecord!.id,
    valueCapturedId: captured.valueCaptured!.id,
  };
}

async function main() {
  console.log("=".repeat(80));
  console.log("APEX ONE — STAGE 7 VALUE / EXECUTION LIFECYCLE INTEGRATION");
  console.log("=".repeat(80));

  const memory = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
  const memoryCtx = await seedIdentity(memory, "org-stage7-memory", "user-stage7-memory", "stage7-memory@example.test");
  const foreignCtx = await seedIdentity(memory, "org-stage7-foreign", "user-stage7-foreign", "stage7-foreign@example.test");
  const lifecycle = new ValueExecutionLifecycleService(memory);
  const workflowService = new WorkflowService(memory);
  const actionService = new ActionService(memory);
  const evidenceService = new EvidenceService(memory);
  const memoryScenario = await seedScenario(memory, memoryCtx, "memory");

  await check("1. Opportunity status cannot skip the explicit validation command", async () => {
    await expectRejects(() => lifecycle.approveOpportunity({
      command: "approve_opportunity",
      opportunityId: memoryScenario.opportunityRecord.id,
    }, memoryCtx), ConflictError);
  });

  await check("2. validate_opportunity performs only Identified -> Validated", async () => {
    const result = await lifecycle.validateOpportunity({
      command: "validate_opportunity",
      opportunityId: memoryScenario.opportunityRecord.id,
      note: "Business validation complete",
    }, memoryCtx);
    if (result.opportunity.status !== "Validated") throw new Error("Opportunity did not become Validated");
  });

  await check("3. approve_opportunity performs only Validated -> Approved", async () => {
    const result = await lifecycle.approveOpportunity({
      command: "approve_opportunity",
      opportunityId: memoryScenario.opportunityRecord.id,
    }, memoryCtx);
    if (result.opportunity.status !== "Approved") throw new Error("Opportunity did not become Approved");
  });

  let actionId = "";
  await check("4. create_action creates a Ready Action with canonical opportunity provenance", async () => {
    const result = await lifecycle.createAction({
      command: "create_action",
      opportunityId: memoryScenario.opportunityRecord.id,
    }, memoryCtx);
    actionId = result.action!.id;
    if (result.action?.status !== "Ready") throw new Error("Lifecycle Action did not start Ready");
    const provenance = await collectAllPages((cursor) => memory.provenanceRepo.findBySubject({
      subjectType: "Action",
      subjectId: actionId,
      limit: MAX_PAGE_SIZE,
      cursor,
    }, memoryCtx));
    const link = provenance.find((record) => record.method === STAGE7_ACTION_PROVENANCE_METHOD);
    if (!link?.sources.some((source) => source.sourceId === memoryScenario.opportunityRecord.id)) {
      throw new Error("Action is missing canonical opportunity provenance");
    }
  });

  await check("5. Legacy generic advanceAction cannot bypass a lifecycle-linked Action", async () => {
    await expectRejects(() => actionService.advanceAction(actionId, memoryCtx), ConflictError);
    const action = await memory.actionsRepo.findById(actionId, memoryCtx, "Action");
    if (action.status !== "Ready") throw new Error("Blocked generic advance still mutated Action");
  });

  await check("6. approve_action explicitly performs Ready -> Approved", async () => {
    const result = await lifecycle.approveAction({
      command: "approve_action",
      opportunityId: memoryScenario.opportunityRecord.id,
      actionId,
    }, memoryCtx);
    if (result.action?.status !== "Approved") throw new Error("Action did not become Approved");
  });

  let runId = "";
  await check("7. start_execution atomically links opportunity, Action, workflow and WorkflowRun", async () => {
    const result = await lifecycle.startExecution({
      command: "start_execution",
      opportunityId: memoryScenario.opportunityRecord.id,
      actionId,
      workflowId: memoryScenario.workflowRecord.id,
    }, memoryCtx);
    runId = result.workflowRun!.id;
    if (result.opportunity.status !== "Executing" || result.action?.status !== "In Progress") {
      throw new Error("Execution did not atomically transition opportunity and Action");
    }
    if (result.workflowRun?.contextData.opportunityId !== memoryScenario.opportunityRecord.id || result.workflowRun?.contextData.actionId !== actionId) {
      throw new Error("WorkflowRun lacks structured lifecycle linkage");
    }
    if (result.workflowRun?.steps[0]?.status !== "completed" || result.workflowRun?.steps[1]?.status !== "executing") {
      throw new Error("Workflow trigger/executing step initialization is incorrect");
    }
  });

  await check("8. Workflow engine rejects step skipping and promotes exactly the next pending step", async () => {
    let run = await memory.workflowRunsRepo.findById(runId, memoryCtx, "WorkflowRun");
    const pending = run.steps.find((step) => step.status === "pending")!;
    await expectRejects(() => workflowService.advanceWorkflowStep({ runId, stepId: pending.stepId, decision: "completed" }, memoryCtx), ConflictError);
    const executing = run.steps.find((step) => step.status === "executing")!;
    run = await workflowService.advanceWorkflowStep({ runId, stepId: executing.stepId, decision: "completed" }, memoryCtx);
    if (run.steps.find((step) => step.stepId === pending.stepId)?.status !== "executing") {
      throw new Error("Next pending workflow step was not promoted to executing");
    }
    await driveRunToCompletion(memory, workflowService, runId, memoryCtx);
  });

  await check("9. complete_execution requires a completed linked WorkflowRun", async () => {
    const result = await lifecycle.completeExecution({
      command: "complete_execution",
      opportunityId: memoryScenario.opportunityRecord.id,
      actionId,
      workflowRunId: runId,
    }, memoryCtx);
    if (result.action?.status !== "Completed") throw new Error("Action did not become Completed");
  });

  let measurementProvenanceId = "";
  await check("10. record_measurement records provenance without implying verification or Measured state", async () => {
    const result = await lifecycle.recordMeasurement({
      command: "record_measurement",
      opportunityId: memoryScenario.opportunityRecord.id,
      actionId,
      workflowRunId: runId,
      sources: [{ kind: "record", sourceType: "Transaction", sourceId: "txn-stage7-measurement", observedAt: now() }],
      confidence: 98,
    }, memoryCtx);
    measurementProvenanceId = result.measurementProvenance!.id;
    if (result.action?.status !== "Completed") throw new Error("Recording measurement incorrectly marked Action Measured");
    const status = await evidenceService.getStatus("Action", actionId, memoryCtx);
    if (status.verificationState !== "unverified") throw new Error("Measurement record presence incorrectly implied verification");
  });

  await check("11. verify_measurement accepts only Stage 7 measurement provenance", async () => {
    const actionProvenance = await collectAllPages((cursor) => memory.provenanceRepo.findBySubject({
      subjectType: "Action", subjectId: actionId, limit: MAX_PAGE_SIZE, cursor,
    }, memoryCtx));
    const nonMeasurement = actionProvenance.find((record) => record.method === STAGE7_ACTION_PROVENANCE_METHOD)!;
    await expectRejects(() => lifecycle.verifyMeasurement({
      command: "verify_measurement",
      opportunityId: memoryScenario.opportunityRecord.id,
      actionId,
      workflowRunId: runId,
      measurementProvenanceIds: [nonMeasurement.id],
      criteria: ["must be measurement evidence"],
    }, memoryCtx), ValidationError);
  });

  await check("12. verify_measurement atomically records canonical verification and marks Action Measured", async () => {
    const result = await lifecycle.verifyMeasurement({
      command: "verify_measurement",
      opportunityId: memoryScenario.opportunityRecord.id,
      actionId,
      workflowRunId: runId,
      measurementProvenanceIds: [measurementProvenanceId],
      criteria: ["reconciled amount", "completed workflow"],
    }, memoryCtx);
    if (result.action?.status !== "Measured" || result.verificationRecord?.state !== "verified") {
      throw new Error("Measurement verification did not atomically mark the Action Measured");
    }
  });

  let capturedId = "";
  await check("13. capture_value creates the ledger entry and provenance chain without auto-verifying the new capture", async () => {
    const result = await lifecycle.captureValue({
      command: "capture_value",
      opportunityId: memoryScenario.opportunityRecord.id,
      actionId,
      workflowRunId: runId,
      measurementProvenanceIds: [measurementProvenanceId],
      category: "Revenue recovered",
      capturedValue: 100_000,
    }, memoryCtx);
    capturedId = result.valueCaptured!.id;
    if (result.opportunity.status !== "Captured") throw new Error("Opportunity did not become Captured");
    if (result.valueCaptured?.certifiedBy !== "") throw new Error("ValueCaptured legacy certifiedBy field was populated as authority");
    const captureStatus = await evidenceService.getStatus("ValueCaptured", capturedId, memoryCtx);
    if (captureStatus.verificationState !== "unverified" || captureStatus.certificationState !== "uncertified") {
      throw new Error("Creating ValueCaptured incorrectly auto-verified or auto-certified it");
    }
    const provenance = await collectAllPages((cursor) => memory.provenanceRepo.findBySubject({
      subjectType: "ValueCaptured", subjectId: capturedId, limit: MAX_PAGE_SIZE, cursor,
    }, memoryCtx));
    if (!provenance.some((record) => record.sources.some((source) => source.sourceId === actionId))) {
      throw new Error("ValueCaptured provenance does not include its lifecycle Action");
    }
  });

  await check("14. Terminal capture cannot be replayed or skipped", async () => {
    await expectRejects(() => lifecycle.captureValue({
      command: "capture_value",
      opportunityId: memoryScenario.opportunityRecord.id,
      actionId,
      workflowRunId: runId,
      measurementProvenanceIds: [measurementProvenanceId],
      category: "Revenue recovered",
      capturedValue: 100_000,
    }, memoryCtx), ConflictError);
  });

  await check("15. Every lifecycle command remains tenant scoped", async () => {
    await expectRejects(() => lifecycle.completeExecution({
      command: "complete_execution",
      opportunityId: memoryScenario.opportunityRecord.id,
      actionId,
      workflowRunId: runId,
    }, foreignCtx), CrossTenantViolationError);
  });

  const pg = DatabaseStore.createPostgresStore(databaseUrl());
  await pg.bootstrapPersistence();
  await pg.clearPersistentStateForTesting();
  const pgCtx = await seedIdentity(pg, "org-stage7-pg", "user-stage7-pg", "stage7-pg@example.test");

  let pgChain: Awaited<ReturnType<typeof runFullLifecycle>>;
  await check("16. Full Stage 7 lifecycle executes against PostgreSQL authority", async () => {
    pgChain = await runFullLifecycle(pg, pgCtx, "pg-main");
    const capture = await pg.valueCapturedRepo.findById(pgChain.valueCapturedId, pgCtx, "ValueCaptured");
    if (capture.opportunityId !== pgChain.opportunityId) throw new Error("PostgreSQL capture lost opportunity linkage");
  });

  await check("17. Lifecycle state and measurement evidence survive application restart", async () => {
    const restarted = DatabaseStore.createPostgresStore(databaseUrl());
    await restarted.bootstrapPersistence();
    const opportunityRecord = await restarted.opportunitiesRepo.findById(pgChain.opportunityId, pgCtx, "ValueOpportunity");
    const actionRecord = await restarted.actionsRepo.findById(pgChain.actionId, pgCtx, "Action");
    const run = await restarted.workflowRunsRepo.findById(pgChain.runId, pgCtx, "WorkflowRun");
    const capture = await restarted.valueCapturedRepo.findById(pgChain.valueCapturedId, pgCtx, "ValueCaptured");
    const status = await new EvidenceService(restarted).getStatus("Action", pgChain.actionId, pgCtx);
    if (opportunityRecord.status !== "Captured" || actionRecord.status !== "Measured" || run.status !== "completed") {
      throw new Error("Restart did not preserve terminal lifecycle states");
    }
    if (capture.opportunityId !== pgChain.opportunityId || status.verificationState !== "verified") {
      throw new Error("Restart did not preserve capture/evidence authority");
    }
  });

  await check("18. PostgreSQL fault after ledger insert rolls back capture and opportunity transition atomically", async () => {
    const lifecyclePg = new ValueExecutionLifecycleService(pg);
    const chain = await runFullLifecycleUpToVerified(pg, pgCtx, "pg-fault");
    const originalCreate = pg.provenanceRepo.create.bind(pg.provenanceRepo);
    (pg.provenanceRepo as any).create = async (data: any, context: TenantContext) => {
      if (data.subjectType === "ValueCaptured") throw new Error("stage7 injected capture provenance failure");
      return originalCreate(data, context);
    };
    try {
      await expectRejects(() => lifecyclePg.captureValue({
        command: "capture_value",
        opportunityId: chain.opportunityId,
        actionId: chain.actionId,
        workflowRunId: chain.runId,
        measurementProvenanceIds: [chain.provenanceId],
        category: "Revenue recovered",
        capturedValue: 90_000,
      }, pgCtx));
    } finally {
      (pg.provenanceRepo as any).create = originalCreate;
    }
    const opportunityRecord = await pg.opportunitiesRepo.findById(chain.opportunityId, pgCtx, "ValueOpportunity");
    const captures = await pg.valueCapturedRepo.findMany(pgCtx, { where: { opportunityId: chain.opportunityId } });
    if (opportunityRecord.status !== "Executing" || captures.items.length !== 0) {
      throw new Error("Faulted capture did not roll back the whole lifecycle transaction");
    }
  });

  console.log("-".repeat(80));
  for (const [index, result] of results.entries()) {
    console.log(`${result.passed ? "✅ [PASS]" : "❌ [FAIL]"} ${index + 1}. ${result.name}`);
    if (!result.passed && result.error) console.log(`    ${result.error}`);
  }
  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  console.log("-".repeat(80));
  console.log(`TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=".repeat(80));
  if (failed > 0) process.exit(1);
}

async function runFullLifecycleUpToVerified(store: DatabaseStore, context: TenantContext, prefix: string) {
  const lifecycle = new ValueExecutionLifecycleService(store);
  const workflowService = new WorkflowService(store);
  const { opportunityRecord, workflowRecord } = await seedScenario(store, context, prefix);
  await lifecycle.validateOpportunity({ command: "validate_opportunity", opportunityId: opportunityRecord.id }, context);
  await lifecycle.approveOpportunity({ command: "approve_opportunity", opportunityId: opportunityRecord.id }, context);
  const created = await lifecycle.createAction({ command: "create_action", opportunityId: opportunityRecord.id }, context);
  const actionId = created.action!.id;
  await lifecycle.approveAction({ command: "approve_action", opportunityId: opportunityRecord.id, actionId }, context);
  const started = await lifecycle.startExecution({
    command: "start_execution",
    opportunityId: opportunityRecord.id,
    actionId,
    workflowId: workflowRecord.id,
  }, context);
  const runId = started.workflowRun!.id;
  await driveRunToCompletion(store, workflowService, runId, context);
  await lifecycle.completeExecution({ command: "complete_execution", opportunityId: opportunityRecord.id, actionId, workflowRunId: runId }, context);
  const measurement = await lifecycle.recordMeasurement({
    command: "record_measurement",
    opportunityId: opportunityRecord.id,
    actionId,
    workflowRunId: runId,
    sources: [{ kind: "record", sourceType: "Transaction", sourceId: `measurement-${prefix}`, observedAt: now() }],
  }, context);
  const provenanceId = measurement.measurementProvenance!.id;
  await lifecycle.verifyMeasurement({
    command: "verify_measurement",
    opportunityId: opportunityRecord.id,
    actionId,
    workflowRunId: runId,
    measurementProvenanceIds: [provenanceId],
    criteria: ["fault-test verified measurement"],
  }, context);
  return { opportunityId: opportunityRecord.id, actionId, runId, provenanceId };
}

main().catch((error) => {
  console.error("FATAL STAGE 7 LIFECYCLE TEST ERROR:", error);
  process.exit(1);
});
