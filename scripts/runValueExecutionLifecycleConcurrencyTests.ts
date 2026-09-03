process.env.TEST_ENV = "true";

import { DatabaseStore } from "../lib/backend/database/store";
import type {
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
  ValueOpportunityRecord,
  WorkflowRecord,
} from "../lib/backend/database/schema";
import type { TenantContext } from "../lib/backend/core/errors";
import { ConflictError } from "../lib/backend/core/errors";
import { ValueExecutionLifecycleService } from "../lib/backend/domains/value/valueExecutionLifecycleService";
import { WorkflowService } from "../lib/backend/domains/workflows/workflowService";
import { STAGE7_ACTION_LINK_PREFIX } from "../lib/backend/domains/value/valueExecutionLifecycleModel";

interface CheckResult { name: string; passed: boolean; error?: string }
const results: CheckResult[] = [];

function now(): string { return new Date().toISOString(); }

function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required for Stage 7 concurrency tests");
  return value;
}

function context(organizationId: string): TenantContext {
  return {
    organizationId,
    userId: "user-stage7-race",
    userEmail: "stage7-race@example.test",
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
    requestId: `req-stage7-race-${Math.random().toString(36).slice(2)}`,
    timestamp: now(),
  };
}

function organization(id: string): OrganizationRecord {
  return {
    id,
    name: "Stage 7 Race Holdings",
    displayName: "Stage 7 Race",
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

function user(): UserRecord {
  return {
    id: "user-stage7-race",
    email: "stage7-race@example.test",
    name: "Stage 7 Race Tester",
    title: "CEO",
    status: "active",
    createdAt: now(),
  };
}

function membership(organizationId: string): OrganizationMembershipRecord {
  return {
    id: `membership-${organizationId}`,
    organizationId,
    userId: "user-stage7-race",
    role: "CEO",
    department: "Operations",
    joinedAt: now(),
  };
}

function opportunity(id: string): Omit<ValueOpportunityRecord, "organizationId"> {
  const timestamp = now();
  return {
    id,
    title: "Concurrent lifecycle recovery",
    category: "Revenue recovery",
    potentialValue: 210_000,
    confidence: 96,
    evidence: "Recorded race-test evidence",
    recommendedAction: "Execute the concurrent recovery workflow",
    expectedOutcome: "Recover measurable value",
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
    name: "Concurrent Stage 7 workflow",
    description: "Workflow used to prove cross-instance lifecycle serialization",
    subsidiary: "General Operations",
    status: "active",
    version: 1,
    nodes: [
      { id: `${id}-trigger`, type: "trigger", title: "Trigger", configuration: {} },
      { id: `${id}-execute`, type: "action", title: "Execute", configuration: {} },
    ],
    connections: [
      { id: `${id}-c1`, fromNodeId: `${id}-trigger`, toNodeId: `${id}-execute` },
    ],
    runsCount: 0,
    successRate: 100,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
  } catch (error: any) {
    results.push({ name, passed: false, error: error?.stack || String(error) });
  }
}

function assertOneWinner(settled: PromiseSettledResult<unknown>[], label: string): void {
  const fulfilled = settled.filter((result) => result.status === "fulfilled");
  const rejected = settled.filter((result) => result.status === "rejected") as PromiseRejectedResult[];
  if (fulfilled.length !== 1 || rejected.length !== 1) {
    throw new Error(`${label} race expected exactly one winner and one loser; got ${fulfilled.length} fulfilled / ${rejected.length} rejected`);
  }
  if (!(rejected[0].reason instanceof ConflictError)) {
    throw new Error(`${label} race loser must fail closed as ConflictError; received ${rejected[0].reason?.constructor?.name || String(rejected[0].reason)}`);
  }
}

async function driveRunToCompletion(
  store: DatabaseStore,
  workflowService: WorkflowService,
  runId: string,
  ctx: TenantContext
): Promise<void> {
  let run = await store.workflowRunsRepo.findById(runId, ctx, "WorkflowRun");
  while (run.status === "running") {
    const executing = run.steps.find((step) => step.status === "executing");
    if (!executing) throw new Error("Running workflow has no executing step");
    run = await workflowService.advanceWorkflowStep(
      { runId, stepId: executing.stepId, decision: "completed", output: { raceTest: true } },
      ctx
    );
  }
  if (run.status !== "completed") throw new Error(`Workflow ended in unexpected status '${run.status}'`);
}

async function main() {
  console.log("=".repeat(80));
  console.log("APEX ONE — STAGE 7 CROSS-INSTANCE LIFECYCLE CONCURRENCY");
  console.log("=".repeat(80));

  const url = databaseUrl();
  const storeA = DatabaseStore.createPostgresStore(url);
  const storeB = DatabaseStore.createPostgresStore(url);
  await storeA.bootstrapPersistence();
  await storeB.bootstrapPersistence();
  await storeA.clearPersistentStateForTesting();

  const organizationId = "org-stage7-race";
  const ctxA = context(organizationId);
  const ctxB = { ...context(organizationId), requestId: "req-stage7-race-b" };
  await storeA.createOrganizationRecord(organization(organizationId));
  await storeA.createUserRecord(user());
  await storeA.createMembershipRecord(membership(organizationId));

  const opportunityId = "opp-stage7-race";
  const workflowId = "wf-stage7-race";
  await storeA.opportunitiesRepo.create(opportunity(opportunityId), ctxA);
  await storeA.workflowsRepo.create(workflow(workflowId), ctxA);

  const lifecycleA = new ValueExecutionLifecycleService(storeA);
  const lifecycleB = new ValueExecutionLifecycleService(storeB);
  const workflowService = new WorkflowService(storeA);

  await lifecycleA.validateOpportunity({ command: "validate_opportunity", opportunityId }, ctxA);
  await lifecycleA.approveOpportunity({ command: "approve_opportunity", opportunityId }, ctxA);

  let actionId = "";
  await check("1. SERIALIZABLE cross-instance create_action permits exactly one lifecycle Action", async () => {
    const settled = await Promise.allSettled([
      lifecycleA.createAction({ command: "create_action", opportunityId }, ctxA),
      lifecycleB.createAction({ command: "create_action", opportunityId }, ctxB),
    ]);
    assertOneWinner(settled, "create_action");

    const page = await storeA.actionsRepo.findMany(ctxA, {
      where: { insightSource: `${STAGE7_ACTION_LINK_PREFIX}${opportunityId}` },
      limit: 10,
    });
    if (page.items.length !== 1) {
      throw new Error(`Expected exactly one durable lifecycle Action, found ${page.items.length}`);
    }
    actionId = page.items[0].id;
  });

  let runId = "";
  let measurementProvenanceId = "";
  await check("2. The single winning Action can complete the explicit execution/measurement chain", async () => {
    await lifecycleA.approveAction({ command: "approve_action", opportunityId, actionId }, ctxA);
    const started = await lifecycleA.startExecution({
      command: "start_execution",
      opportunityId,
      actionId,
      workflowId,
    }, ctxA);
    runId = started.workflowRun!.id;
    await driveRunToCompletion(storeA, workflowService, runId, ctxA);
    await lifecycleA.completeExecution({
      command: "complete_execution",
      opportunityId,
      actionId,
      workflowRunId: runId,
    }, ctxA);
    const measurement = await lifecycleA.recordMeasurement({
      command: "record_measurement",
      opportunityId,
      actionId,
      workflowRunId: runId,
      sources: [{
        kind: "record",
        sourceType: "Transaction",
        sourceId: "txn-stage7-race-measurement",
        observedAt: now(),
      }],
    }, ctxA);
    measurementProvenanceId = measurement.measurementProvenance!.id;
    await lifecycleA.verifyMeasurement({
      command: "verify_measurement",
      opportunityId,
      actionId,
      workflowRunId: runId,
      measurementProvenanceIds: [measurementProvenanceId],
      criteria: ["cross-instance measurement basis reconciled"],
    }, ctxA);
    const action = await storeA.actionsRepo.findById(actionId, ctxA, "Action");
    if (action.status !== "Measured") throw new Error("Winning Action did not reach Measured");
  });

  await check("3. SERIALIZABLE cross-instance capture_value permits exactly one ledger capture", async () => {
    const settled = await Promise.allSettled([
      lifecycleA.captureValue({
        command: "capture_value",
        opportunityId,
        actionId,
        workflowRunId: runId,
        measurementProvenanceIds: [measurementProvenanceId],
        category: "Revenue recovered",
        capturedValue: 180_000,
      }, ctxA),
      lifecycleB.captureValue({
        command: "capture_value",
        opportunityId,
        actionId,
        workflowRunId: runId,
        measurementProvenanceIds: [measurementProvenanceId],
        category: "Revenue recovered",
        capturedValue: 180_000,
      }, ctxB),
    ]);
    assertOneWinner(settled, "capture_value");

    const captures = await storeA.valueCapturedRepo.findMany(ctxA, {
      where: { opportunityId },
      limit: 10,
    });
    if (captures.items.length !== 1) {
      throw new Error(`Expected exactly one durable ValueCaptured record, found ${captures.items.length}`);
    }
    const finalOpportunity = await storeA.opportunitiesRepo.findById(opportunityId, ctxA, "ValueOpportunity");
    if (finalOpportunity.status !== "Captured") {
      throw new Error(`Opportunity did not finish Captured; received '${finalOpportunity.status}'`);
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

main().catch((error) => {
  console.error("FATAL STAGE 7 CONCURRENCY TEST ERROR:", error);
  process.exit(1);
});
