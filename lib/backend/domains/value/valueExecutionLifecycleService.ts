import { randomUUID } from "node:crypto";
import { DatabaseStore } from "../../database/store";
import type { IUnitOfWork } from "../../database/unitOfWork";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { collectAllPages } from "../../database/paginationTraversal";
import { MAX_PAGE_SIZE } from "../../database/querySpecification";
import type {
  ActionRecord,
  ValueCapturedRecord,
  ValueOpportunityRecord,
  WorkflowRunRecord,
} from "../../database/schema";
import { TenantContext, requirePermission } from "../../core/security";
import { ConflictError, ValidationError } from "../../core/errors";
import { Validator } from "../../core/validation";
import { EvidenceService } from "../evidence/evidenceService";
import {
  assertProvenanceRecordInvariant,
  assertVerificationRecordInvariant,
  type ProvenanceRecord,
  type ProvenanceSourceReference,
  type VerificationDecision,
  type VerificationRecord,
} from "../evidence/model";
import {
  STAGE7_ACTION_LINK_PREFIX,
  STAGE7_ACTION_PROVENANCE_METHOD,
  STAGE7_CAPTURE_PROVENANCE_METHOD,
  STAGE7_MEASUREMENT_PROVENANCE_METHOD,
  STAGE7_WORKFLOW_PROVENANCE_METHOD,
  VALUE_CAPTURE_CATEGORIES,
  assertActionLifecycleTransition,
  assertOpportunityLifecycleTransition,
  type ApproveLifecycleActionCommand,
  type ApproveOpportunityCommand,
  type CaptureValueCommand,
  type CompleteExecutionCommand,
  type CreateLifecycleActionCommand,
  type RecordMeasurementCommand,
  type RejectMeasurementCommand,
  type StartExecutionCommand,
  type ValidateOpportunityCommand,
  type ValueExecutionLifecycleCommand,
  type ValueExecutionLifecycleResult,
  type VerifyMeasurementCommand,
} from "./valueExecutionLifecycleModel";

const SYSTEM_PRODUCER_ID = "apex-stage7-value-execution";
const SYSTEM_PRODUCER_LABEL = "APEX ONE Stage 7 Value Execution Lifecycle";

export class ValueExecutionLifecycleService {
  private readonly evidenceService: EvidenceService;

  constructor(private readonly database: DatabaseStore = createApplicationInfrastructure().database) {
    this.evidenceService = new EvidenceService(database);
  }

  public async execute(
    command: ValueExecutionLifecycleCommand,
    ctx: TenantContext
  ): Promise<ValueExecutionLifecycleResult> {
    if (!command || typeof command !== "object" || typeof (command as { command?: unknown }).command !== "string") {
      throw new ValidationError("Stage 7 lifecycle command is required");
    }

    switch (command.command) {
      case "validate_opportunity": return this.validateOpportunity(command, ctx);
      case "approve_opportunity": return this.approveOpportunity(command, ctx);
      case "create_action": return this.createAction(command, ctx);
      case "approve_action": return this.approveAction(command, ctx);
      case "start_execution": return this.startExecution(command, ctx);
      case "complete_execution": return this.completeExecution(command, ctx);
      case "record_measurement": return this.recordMeasurement(command, ctx);
      case "verify_measurement": return this.verifyMeasurement(command, ctx);
      case "reject_measurement": return this.rejectMeasurement(command, ctx);
      case "capture_value": return this.captureValue(command, ctx);
      default:
        throw new ValidationError(`Unsupported Stage 7 lifecycle command '${String((command as any).command)}'`);
    }
  }

  public async validateOpportunity(
    command: ValidateOpportunityCommand,
    ctx: TenantContext
  ): Promise<ValueExecutionLifecycleResult> {
    requirePermission(ctx, "value:write");
    const opportunityId = Validator.requireId(command.opportunityId, "opportunityId");
    const note = Validator.optionalString(command.note, "note", { maxLength: 1_000 });

    return this.database.runInTransaction(ctx, async (uow) => {
      const opportunity = await uow.opportunities.findById(opportunityId, uow.context, "ValueOpportunity");
      const nextStatus = assertOpportunityLifecycleTransition("validate_opportunity", opportunity.status);
      const updated = await uow.opportunities.update(
        opportunity.id,
        { status: nextStatus },
        uow.context,
        "ValueOpportunity"
      );
      await this.recordLifecycleAudit(uow, "validate_opportunity", "ValueOpportunity", opportunity.id, {
        previousStatus: opportunity.status,
        newStatus: nextStatus,
        note,
      });
      return { command: "validate_opportunity", opportunity: updated };
    });
  }

  public async approveOpportunity(
    command: ApproveOpportunityCommand,
    ctx: TenantContext
  ): Promise<ValueExecutionLifecycleResult> {
    requirePermission(ctx, "value:approve");
    const opportunityId = Validator.requireId(command.opportunityId, "opportunityId");
    const note = Validator.optionalString(command.note, "note", { maxLength: 1_000 });

    return this.database.runInTransaction(ctx, async (uow) => {
      const opportunity = await uow.opportunities.findById(opportunityId, uow.context, "ValueOpportunity");
      const nextStatus = assertOpportunityLifecycleTransition("approve_opportunity", opportunity.status);
      const updated = await uow.opportunities.update(
        opportunity.id,
        { status: nextStatus },
        uow.context,
        "ValueOpportunity"
      );
      await this.recordLifecycleAudit(uow, "approve_opportunity", "ValueOpportunity", opportunity.id, {
        previousStatus: opportunity.status,
        newStatus: nextStatus,
        note,
      });
      return { command: "approve_opportunity", opportunity: updated };
    });
  }

  public async createAction(
    command: CreateLifecycleActionCommand,
    ctx: TenantContext
  ): Promise<ValueExecutionLifecycleResult> {
    requirePermission(ctx, "action:create");
    const opportunityId = Validator.requireId(command.opportunityId, "opportunityId");
    const owner = Validator.optionalString(command.owner, "owner", { maxLength: 160 });
    const deadline = Validator.optionalString(command.deadline, "deadline", { maxLength: 64 });
    const automationType = command.automationType === undefined
      ? "AI-assisted"
      : Validator.requireEnum(
          command.automationType,
          ["Manual", "AI-assisted", "Automated", "Awaiting approval"] as const,
          "automationType"
        );
    const requiresHumanApproval = command.requiresHumanApproval ?? true;
    if (typeof requiresHumanApproval !== "boolean") {
      throw new ValidationError("requiresHumanApproval must be a boolean");
    }

    return this.database.runInTransaction(ctx, async (uow) => {
      const opportunity = await uow.opportunities.findById(opportunityId, uow.context, "ValueOpportunity");
      if (opportunity.status !== "Approved") {
        throw new ConflictError(
          `Action creation requires ValueOpportunity status 'Approved', received '${opportunity.status}'`
        );
      }

      const linkKey = `${STAGE7_ACTION_LINK_PREFIX}${opportunity.id}`;
      const existing = await uow.actions.findOne(uow.context, { where: { insightSource: linkKey } });
      if (existing) {
        throw new ConflictError(`ValueOpportunity '${opportunity.id}' already has lifecycle Action '${existing.id}'`);
      }

      const now = new Date().toISOString();
      const actionId = `act-${randomUUID()}`;
      const actionData: Omit<ActionRecord, "organizationId"> = {
        id: actionId,
        recommendation: opportunity.recommendedAction,
        owner: owner ?? ctx.userEmail,
        deadline: deadline ?? new Date(Date.now() + 14 * 86_400_000).toISOString().split("T")[0],
        expectedValue: opportunity.potentialValue,
        status: "Ready",
        confidence: opportunity.confidence,
        automationType,
        requiresHumanApproval,
        insightSource: linkKey,
        decisionDetail: `Stage 7 lifecycle Action for ValueOpportunity ${opportunity.id}: ${opportunity.title}`,
        resultMetric: "Measured value evidence required before ValueCaptured ledger entry",
        logs: [`Lifecycle Action created from ValueOpportunity ${opportunity.id} by ${ctx.userEmail}`],
        createdAt: now,
        updatedAt: now,
      };

      const action = await uow.actions.create(actionData, uow.context);
      const provenance = await this.createProvenance(uow, {
        subjectType: "Action",
        subjectId: action.id,
        relation: "derived_from",
        sources: [{
          kind: "record",
          sourceType: "ValueOpportunity",
          sourceId: opportunity.id,
          observedAt: now,
        }],
        producerType: "system",
        producerId: SYSTEM_PRODUCER_ID,
        producerLabel: SYSTEM_PRODUCER_LABEL,
        method: STAGE7_ACTION_PROVENANCE_METHOD,
        confidence: opportunity.confidence,
        notes: "Canonical Stage 7 link from an approved value opportunity to its execution Action.",
      });

      await this.recordLifecycleAudit(uow, "create_action", "Action", action.id, {
        opportunityId: opportunity.id,
        provenanceId: provenance.id,
        status: action.status,
      });
      return { command: "create_action", opportunity, action };
    });
  }

  public async approveAction(
    command: ApproveLifecycleActionCommand,
    ctx: TenantContext
  ): Promise<ValueExecutionLifecycleResult> {
    requirePermission(ctx, "action:approve");
    const opportunityId = Validator.requireId(command.opportunityId, "opportunityId");
    const actionId = Validator.requireId(command.actionId, "actionId");

    return this.database.runInTransaction(ctx, async (uow) => {
      const opportunity = await uow.opportunities.findById(opportunityId, uow.context, "ValueOpportunity");
      if (opportunity.status !== "Approved") {
        throw new ConflictError(`Action approval requires linked ValueOpportunity status 'Approved'`);
      }
      const action = await uow.actions.findById(actionId, uow.context, "Action");
      await this.assertActionLinkedToOpportunity(action.id, opportunity.id, uow.context);
      const nextStatus = assertActionLifecycleTransition("approve_action", action.status);
      const logs = [...action.logs, `Lifecycle Action approved by ${uow.context.userEmail}`];
      const updated = await uow.actions.update(
        action.id,
        { status: nextStatus, approvedBy: uow.context.userEmail, logs },
        uow.context,
        "Action"
      );
      await this.recordLifecycleAudit(uow, "approve_action", "Action", action.id, {
        opportunityId: opportunity.id,
        previousStatus: action.status,
        newStatus: nextStatus,
      });
      return { command: "approve_action", opportunity, action: updated };
    });
  }

  public async startExecution(
    command: StartExecutionCommand,
    ctx: TenantContext
  ): Promise<ValueExecutionLifecycleResult> {
    requirePermission(ctx, "action:execute");
    requirePermission(ctx, "workflow:execute");
    const opportunityId = Validator.requireId(command.opportunityId, "opportunityId");
    const actionId = Validator.requireId(command.actionId, "actionId");
    const workflowId = Validator.requireId(command.workflowId, "workflowId");

    return this.database.runInTransaction(ctx, async (uow) => {
      const opportunity = await uow.opportunities.findById(opportunityId, uow.context, "ValueOpportunity");
      const action = await uow.actions.findById(actionId, uow.context, "Action");
      const workflow = await uow.workflows.findById(workflowId, uow.context, "Workflow");
      await this.assertActionLinkedToOpportunity(action.id, opportunity.id, uow.context);

      const opportunityNext = assertOpportunityLifecycleTransition("start_execution", opportunity.status);
      const actionNext = assertActionLifecycleTransition("start_execution", action.status);
      if (workflow.status !== "active") {
        throw new ConflictError(`Cannot start Stage 7 execution with workflow status '${workflow.status}'`);
      }
      if (workflow.nodes.length === 0) {
        throw new ConflictError("Cannot start Stage 7 execution with an empty workflow");
      }

      const runId = `run-value-${action.id}`;
      const startedAt = new Date().toISOString();
      const triggerIsFirst = workflow.nodes[0]?.type === "trigger";
      const firstExecutableIndex = triggerIsFirst ? 1 : 0;
      const steps = workflow.nodes.map((node, index) => ({
        stepId: `step-${index + 1}-${node.id}`,
        nodeId: node.id,
        nodeTitle: node.title,
        status: index < firstExecutableIndex
          ? ("completed" as const)
          : index === firstExecutableIndex
            ? ("executing" as const)
            : ("pending" as const),
        startedAt,
        completedAt: index < firstExecutableIndex ? startedAt : undefined,
      }));
      const immediatelyCompleted = steps.every((step) => step.status === "completed");
      const runData: Omit<WorkflowRunRecord, "organizationId"> = {
        id: runId,
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        triggeredBy: uow.context.userEmail,
        triggerType: "manual",
        status: immediatelyCompleted ? "completed" : "running",
        steps,
        contextData: {
          lifecycle: "value_execution",
          opportunityId: opportunity.id,
          actionId: action.id,
        },
        startedAt,
        completedAt: immediatelyCompleted ? startedAt : undefined,
      };

      const run = await uow.workflowRuns.create(runData, uow.context);
      await uow.workflows.update(
        workflow.id,
        { runsCount: workflow.runsCount + 1 },
        uow.context,
        "Workflow"
      );
      const updatedAction = await uow.actions.update(
        action.id,
        {
          status: actionNext,
          logs: [...action.logs, `Lifecycle execution started with WorkflowRun ${run.id}`],
        },
        uow.context,
        "Action"
      );
      const updatedOpportunity = await uow.opportunities.update(
        opportunity.id,
        { status: opportunityNext },
        uow.context,
        "ValueOpportunity"
      );
      const provenance = await this.createProvenance(uow, {
        subjectType: "WorkflowRun",
        subjectId: run.id,
        relation: "derived_from",
        sources: [
          { kind: "record", sourceType: "Action", sourceId: action.id, observedAt: startedAt },
          { kind: "record", sourceType: "ValueOpportunity", sourceId: opportunity.id, observedAt: startedAt },
        ],
        producerType: "system",
        producerId: SYSTEM_PRODUCER_ID,
        producerLabel: SYSTEM_PRODUCER_LABEL,
        method: STAGE7_WORKFLOW_PROVENANCE_METHOD,
        notes: `Workflow ${workflow.id} version ${workflow.version} executing lifecycle Action ${action.id}.`,
      });

      await this.recordLifecycleAudit(uow, "start_execution", "WorkflowRun", run.id, {
        opportunityId: opportunity.id,
        actionId: action.id,
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        provenanceId: provenance.id,
      });
      return {
        command: "start_execution",
        opportunity: updatedOpportunity,
        action: updatedAction,
        workflowRun: run,
      };
    });
  }

  public async completeExecution(
    command: CompleteExecutionCommand,
    ctx: TenantContext
  ): Promise<ValueExecutionLifecycleResult> {
    requirePermission(ctx, "action:execute");
    const opportunityId = Validator.requireId(command.opportunityId, "opportunityId");
    const actionId = Validator.requireId(command.actionId, "actionId");
    const workflowRunId = Validator.requireId(command.workflowRunId, "workflowRunId");

    return this.database.runInTransaction(ctx, async (uow) => {
      const opportunity = await uow.opportunities.findById(opportunityId, uow.context, "ValueOpportunity");
      if (opportunity.status !== "Executing") {
        throw new ConflictError(`Execution completion requires ValueOpportunity status 'Executing'`);
      }
      const action = await uow.actions.findById(actionId, uow.context, "Action");
      await this.assertActionLinkedToOpportunity(action.id, opportunity.id, uow.context);
      const run = await uow.workflowRuns.findById(workflowRunId, uow.context, "WorkflowRun");
      await this.assertWorkflowRunLinked(run, opportunity.id, action.id, uow.context);
      if (run.status !== "completed") {
        throw new ConflictError(`Action cannot complete while WorkflowRun status is '${run.status}'`);
      }

      const nextStatus = assertActionLifecycleTransition("complete_execution", action.status);
      const updatedAction = await uow.actions.update(
        action.id,
        {
          status: nextStatus,
          logs: [...action.logs, `WorkflowRun ${run.id} completed; Action execution completed`],
        },
        uow.context,
        "Action"
      );
      await this.recordLifecycleAudit(uow, "complete_execution", "Action", action.id, {
        opportunityId: opportunity.id,
        workflowRunId: run.id,
        previousStatus: action.status,
        newStatus: nextStatus,
      });
      return { command: "complete_execution", opportunity, action: updatedAction, workflowRun: run };
    });
  }

  public async recordMeasurement(
    command: RecordMeasurementCommand,
    ctx: TenantContext
  ): Promise<ValueExecutionLifecycleResult> {
    requirePermission(ctx, "value:write");
    const opportunityId = Validator.requireId(command.opportunityId, "opportunityId");
    const actionId = Validator.requireId(command.actionId, "actionId");
    const workflowRunId = Validator.requireId(command.workflowRunId, "workflowRunId");
    const sources = this.requireMeasurementSources(command.sources);
    const method = Validator.optionalString(command.method, "method", { maxLength: 500 }) ?? STAGE7_MEASUREMENT_PROVENANCE_METHOD;
    const confidence = command.confidence === undefined
      ? undefined
      : Validator.requireNumber(command.confidence, "confidence", { min: 0, max: 100 });
    const notes = Validator.optionalString(command.notes, "notes", { maxLength: 2_000 });

    return this.database.runInTransaction(ctx, async (uow) => {
      const opportunity = await uow.opportunities.findById(opportunityId, uow.context, "ValueOpportunity");
      if (opportunity.status !== "Executing") {
        throw new ConflictError("Measurement recording requires ValueOpportunity status 'Executing'");
      }
      const action = await uow.actions.findById(actionId, uow.context, "Action");
      if (action.status !== "Completed") {
        throw new ConflictError(`Measurement recording requires Action status 'Completed', received '${action.status}'`);
      }
      await this.assertActionLinkedToOpportunity(action.id, opportunity.id, uow.context);
      const run = await uow.workflowRuns.findById(workflowRunId, uow.context, "WorkflowRun");
      await this.assertWorkflowRunLinked(run, opportunity.id, action.id, uow.context);
      if (run.status !== "completed") {
        throw new ConflictError("Measurement recording requires a completed WorkflowRun");
      }

      const provenance = await this.createProvenance(uow, {
        subjectType: "Action",
        subjectId: action.id,
        relation: "supports",
        sources,
        producerType: "human",
        producerId: uow.context.userId,
        producerLabel: uow.context.userEmail,
        method: STAGE7_MEASUREMENT_PROVENANCE_METHOD,
        confidence,
        notes: notes ?? `Measurement recorded using '${method}'. Record presence is not a verification or certification decision.`,
      });
      const updatedAction = await uow.actions.update(
        action.id,
        { logs: [...action.logs, `Measurement evidence recorded as ${provenance.id}; verification remains separate`] },
        uow.context,
        "Action"
      );
      await this.recordLifecycleAudit(uow, "record_measurement", "Action", action.id, {
        opportunityId: opportunity.id,
        workflowRunId: run.id,
        measurementProvenanceId: provenance.id,
        sourceCount: sources.length,
      });
      return {
        command: "record_measurement",
        opportunity,
        action: updatedAction,
        workflowRun: run,
        measurementProvenance: provenance,
      };
    });
  }

  public async verifyMeasurement(
    command: VerifyMeasurementCommand,
    ctx: TenantContext
  ): Promise<ValueExecutionLifecycleResult> {
    requirePermission(ctx, "value:approve");
    const opportunityId = Validator.requireId(command.opportunityId, "opportunityId");
    const actionId = Validator.requireId(command.actionId, "actionId");
    const workflowRunId = Validator.requireId(command.workflowRunId, "workflowRunId");
    const provenanceIds = this.requireIdArray(command.measurementProvenanceIds, "measurementProvenanceIds");
    const criteria = this.requireStringArray(command.criteria, "criteria");
    const reason = Validator.optionalString(command.reason, "reason", { maxLength: 2_000 });

    return this.database.runInTransaction(ctx, async (uow) => {
      const opportunity = await uow.opportunities.findById(opportunityId, uow.context, "ValueOpportunity");
      if (opportunity.status !== "Executing") {
        throw new ConflictError("Measurement verification requires ValueOpportunity status 'Executing'");
      }
      const action = await uow.actions.findById(actionId, uow.context, "Action");
      await this.assertActionLinkedToOpportunity(action.id, opportunity.id, uow.context);
      const run = await uow.workflowRuns.findById(workflowRunId, uow.context, "WorkflowRun");
      await this.assertWorkflowRunLinked(run, opportunity.id, action.id, uow.context);
      if (run.status !== "completed") {
        throw new ConflictError("Measurement verification requires a completed WorkflowRun");
      }
      const nextStatus = assertActionLifecycleTransition("verify_measurement", action.status);
      await this.assertMeasurementProvenance(action.id, provenanceIds, uow.context);
      const verification = await this.createMeasurementVerification(
        uow,
        action.id,
        "verified",
        provenanceIds,
        criteria,
        reason
      );
      const updatedAction = await uow.actions.update(
        action.id,
        {
          status: nextStatus,
          logs: [...action.logs, `Measurement verified by canonical record ${verification.id}; Action marked Measured`],
        },
        uow.context,
        "Action"
      );
      await this.recordLifecycleAudit(uow, "verify_measurement", "Action", action.id, {
        opportunityId: opportunity.id,
        workflowRunId: run.id,
        verificationRecordId: verification.id,
        measurementProvenanceIds: provenanceIds,
        newStatus: nextStatus,
      });
      return {
        command: "verify_measurement",
        opportunity,
        action: updatedAction,
        workflowRun: run,
        verificationRecord: verification,
      };
    });
  }

  public async rejectMeasurement(
    command: RejectMeasurementCommand,
    ctx: TenantContext
  ): Promise<ValueExecutionLifecycleResult> {
    requirePermission(ctx, "value:approve");
    const opportunityId = Validator.requireId(command.opportunityId, "opportunityId");
    const actionId = Validator.requireId(command.actionId, "actionId");
    const workflowRunId = Validator.requireId(command.workflowRunId, "workflowRunId");
    const provenanceIds = this.requireIdArray(command.measurementProvenanceIds, "measurementProvenanceIds");
    const criteria = this.requireStringArray(command.criteria, "criteria");
    const reason = Validator.requireString(command.reason, "reason", { maxLength: 2_000 });

    return this.database.runInTransaction(ctx, async (uow) => {
      const opportunity = await uow.opportunities.findById(opportunityId, uow.context, "ValueOpportunity");
      if (opportunity.status !== "Executing") {
        throw new ConflictError("Measurement rejection requires ValueOpportunity status 'Executing'");
      }
      const action = await uow.actions.findById(actionId, uow.context, "Action");
      if (action.status !== "Completed") {
        throw new ConflictError("Only a completed, not-yet-measured Action can have measurement rejected");
      }
      await this.assertActionLinkedToOpportunity(action.id, opportunity.id, uow.context);
      const run = await uow.workflowRuns.findById(workflowRunId, uow.context, "WorkflowRun");
      await this.assertWorkflowRunLinked(run, opportunity.id, action.id, uow.context);
      await this.assertMeasurementProvenance(action.id, provenanceIds, uow.context);
      const verification = await this.createMeasurementVerification(
        uow,
        action.id,
        "rejected",
        provenanceIds,
        criteria,
        reason
      );
      const updatedAction = await uow.actions.update(
        action.id,
        { logs: [...action.logs, `Measurement rejected by canonical verification record ${verification.id}`] },
        uow.context,
        "Action"
      );
      await this.recordLifecycleAudit(uow, "reject_measurement", "Action", action.id, {
        opportunityId: opportunity.id,
        workflowRunId: run.id,
        verificationRecordId: verification.id,
        measurementProvenanceIds: provenanceIds,
      });
      return {
        command: "reject_measurement",
        opportunity,
        action: updatedAction,
        workflowRun: run,
        verificationRecord: verification,
      };
    });
  }

  public async captureValue(
    command: CaptureValueCommand,
    ctx: TenantContext
  ): Promise<ValueExecutionLifecycleResult> {
    requirePermission(ctx, "value:approve");
    const opportunityId = Validator.requireId(command.opportunityId, "opportunityId");
    const actionId = Validator.requireId(command.actionId, "actionId");
    const workflowRunId = Validator.requireId(command.workflowRunId, "workflowRunId");
    const provenanceIds = this.requireIdArray(command.measurementProvenanceIds, "measurementProvenanceIds");
    const category = Validator.requireEnum(command.category, VALUE_CAPTURE_CATEGORIES, "category");
    const capturedValue = Validator.requireNumber(command.capturedValue, "capturedValue", { min: 0.01 });
    const evidenceDescription = Validator.optionalString(command.evidenceDescription, "evidenceDescription", { maxLength: 2_000 });
    const realizationDate = command.realizationDate ?? new Date().toISOString().split("T")[0];
    if (!Number.isFinite(Date.parse(realizationDate))) {
      throw new ValidationError("realizationDate must be a valid ISO-8601 date or timestamp");
    }

    return this.database.runInTransaction(ctx, async (uow) => {
      const opportunity = await uow.opportunities.findById(opportunityId, uow.context, "ValueOpportunity");
      const opportunityNext = assertOpportunityLifecycleTransition("capture_value", opportunity.status);
      const action = await uow.actions.findById(actionId, uow.context, "Action");
      if (action.status !== "Measured") {
        throw new ConflictError(`Value capture requires Action status 'Measured', received '${action.status}'`);
      }
      await this.assertActionLinkedToOpportunity(action.id, opportunity.id, uow.context);
      const run = await uow.workflowRuns.findById(workflowRunId, uow.context, "WorkflowRun");
      await this.assertWorkflowRunLinked(run, opportunity.id, action.id, uow.context);
      if (run.status !== "completed") {
        throw new ConflictError("Value capture requires a completed WorkflowRun");
      }
      await this.assertMeasurementProvenance(action.id, provenanceIds, uow.context);

      const evidenceStatus = await this.evidenceService.getStatus("Action", action.id, uow.context);
      if (evidenceStatus.verificationState !== "verified" || !evidenceStatus.latestVerification) {
        throw new ConflictError("Value capture requires current canonical verified measurement evidence for the Action");
      }
      const verificationIds = new Set(evidenceStatus.latestVerification.provenanceIds);
      if (!provenanceIds.every((id) => verificationIds.has(id))) {
        throw new ConflictError("Current Action verification does not cover every supplied measurement provenance record");
      }

      const existing = await uow.valueCaptured.findOne(uow.context, { where: { opportunityId: opportunity.id } });
      if (existing) {
        throw new ConflictError(`ValueOpportunity '${opportunity.id}' already has ValueCaptured record '${existing.id}'`);
      }

      const createdAt = new Date().toISOString();
      const captureData: Omit<ValueCapturedRecord, "organizationId"> = {
        id: `vc-${randomUUID()}`,
        opportunityId: opportunity.id,
        opportunityTitle: opportunity.title,
        category,
        capturedValue,
        evidenceType: "Stage 7 measured execution evidence",
        evidenceDescription: evidenceDescription ?? "ValueCaptured ledger entry created from a completed workflow and canonically verified Action measurement. The new ValueCaptured record itself remains independently unverified and uncertified until Stage 6 evidence decisions are recorded for it.",
        realizationDate,
        certifiedBy: "",
        auditTrail: [
          `opportunity:${opportunity.id}`,
          `action:${action.id}`,
          `workflowRun:${run.id}`,
          `verification:${evidenceStatus.latestVerification.id}`,
          ...provenanceIds.map((id) => `measurementProvenance:${id}`),
        ],
        createdAt,
      };
      const valueCaptured = await uow.valueCaptured.create(captureData, uow.context);
      const captureProvenance = await this.createProvenance(uow, {
        subjectType: "ValueCaptured",
        subjectId: valueCaptured.id,
        relation: "derived_from",
        sources: [
          { kind: "record", sourceType: "ValueOpportunity", sourceId: opportunity.id, observedAt: createdAt },
          { kind: "record", sourceType: "Action", sourceId: action.id, observedAt: createdAt },
          { kind: "record", sourceType: "WorkflowRun", sourceId: run.id, observedAt: createdAt },
          ...provenanceIds.map((id) => ({
            kind: "record" as const,
            sourceType: "Provenance",
            sourceId: id,
            observedAt: createdAt,
          })),
        ],
        producerType: "system",
        producerId: SYSTEM_PRODUCER_ID,
        producerLabel: SYSTEM_PRODUCER_LABEL,
        method: STAGE7_CAPTURE_PROVENANCE_METHOD,
        notes: "Ledger capture derived from the explicit Stage 7 execution chain. This provenance does not verify or certify ValueCaptured.",
      });
      const updatedOpportunity = await uow.opportunities.update(
        opportunity.id,
        { status: opportunityNext },
        uow.context,
        "ValueOpportunity"
      );
      await this.recordLifecycleAudit(uow, "capture_value", "ValueCaptured", valueCaptured.id, {
        opportunityId: opportunity.id,
        actionId: action.id,
        workflowRunId: run.id,
        measurementVerificationId: evidenceStatus.latestVerification.id,
        measurementProvenanceIds: provenanceIds,
        captureProvenanceId: captureProvenance.id,
        capturedValue,
        category,
      });
      return {
        command: "capture_value",
        opportunity: updatedOpportunity,
        action,
        workflowRun: run,
        verificationRecord: evidenceStatus.latestVerification,
        valueCaptured,
      };
    });
  }

  private async assertActionLinkedToOpportunity(
    actionId: string,
    opportunityId: string,
    ctx: TenantContext
  ): Promise<void> {
    const provenance = await collectAllPages((cursor) =>
      this.database.provenanceRepo.findBySubject(
        { subjectType: "Action", subjectId: actionId, limit: MAX_PAGE_SIZE, cursor },
        ctx
      )
    );
    const linked = provenance.some((record) =>
      record.method === STAGE7_ACTION_PROVENANCE_METHOD &&
      record.sources.some((source) =>
        source.kind === "record" &&
        source.sourceType === "ValueOpportunity" &&
        source.sourceId === opportunityId
      )
    );
    if (!linked) {
      throw new ConflictError(`Action '${actionId}' is not canonically linked to ValueOpportunity '${opportunityId}'`);
    }
  }

  private async assertWorkflowRunLinked(
    run: WorkflowRunRecord,
    opportunityId: string,
    actionId: string,
    ctx: TenantContext
  ): Promise<void> {
    if (
      run.contextData.lifecycle !== "value_execution" ||
      run.contextData.opportunityId !== opportunityId ||
      run.contextData.actionId !== actionId
    ) {
      throw new ConflictError(`WorkflowRun '${run.id}' does not belong to the supplied Stage 7 lifecycle chain`);
    }
    const provenance = await collectAllPages((cursor) =>
      this.database.provenanceRepo.findBySubject(
        { subjectType: "WorkflowRun", subjectId: run.id, limit: MAX_PAGE_SIZE, cursor },
        ctx
      )
    );
    const linked = provenance.some((record) =>
      record.method === STAGE7_WORKFLOW_PROVENANCE_METHOD &&
      record.sources.some((source) => source.sourceType === "Action" && source.sourceId === actionId) &&
      record.sources.some((source) => source.sourceType === "ValueOpportunity" && source.sourceId === opportunityId)
    );
    if (!linked) {
      throw new ConflictError(`WorkflowRun '${run.id}' lacks canonical Stage 7 execution provenance`);
    }
  }

  private async assertMeasurementProvenance(
    actionId: string,
    provenanceIds: string[],
    ctx: TenantContext
  ): Promise<ProvenanceRecord[]> {
    const records: ProvenanceRecord[] = [];
    for (const id of provenanceIds) {
      const record = await this.database.provenanceRepo.findById(id, ctx, "Provenance");
      if (
        record.subjectType !== "Action" ||
        record.subjectId !== actionId ||
        record.relation !== "supports" ||
        record.method !== STAGE7_MEASUREMENT_PROVENANCE_METHOD
      ) {
        throw new ValidationError(`Provenance '${id}' is not Stage 7 measurement evidence for Action '${actionId}'`);
      }
      records.push(record);
    }
    return records;
  }

  private async createMeasurementVerification(
    uow: IUnitOfWork,
    actionId: string,
    decision: VerificationDecision,
    provenanceIds: string[],
    criteria: string[],
    reason?: string
  ): Promise<VerificationRecord> {
    const status = await this.evidenceService.getStatus("Action", actionId, uow.context);
    if (decision === "verified" && status.verificationState === "verified" && status.latestVerification) {
      const current = new Set(status.latestVerification.provenanceIds);
      if (provenanceIds.every((id) => current.has(id))) return status.latestVerification;
      throw new ConflictError("Action is already verified by a different evidence basis; invalidate it before replacing the basis");
    }

    const recordData: Omit<VerificationRecord, "organizationId"> = {
      id: `verify-${randomUUID()}`,
      subjectType: "Action",
      subjectId: actionId,
      state: decision,
      provenanceIds,
      verifierType: "human",
      verifierId: uow.context.userId,
      verifierLabel: uow.context.userEmail,
      criteria,
      reason,
      createdAt: this.nextDecisionTimestamp(status.latestVerification?.createdAt),
    };
    assertVerificationRecordInvariant(recordData, status.verificationState);
    const record = await this.database.verificationsRepo.create(recordData, uow.context);
    await uow.recordAuditLog({
      organizationId: uow.context.organizationId,
      actorId: uow.context.userId,
      actorEmail: uow.context.userEmail,
      action: "evidence:verification_recorded",
      resource: "Action",
      resourceId: actionId,
      requestId: uow.context.requestId,
      status: "success",
      metadata: {
        verificationId: record.id,
        state: record.state,
        provenanceIds: record.provenanceIds,
        lifecycle: "value_execution",
      },
      timestamp: record.createdAt,
    });
    return record;
  }

  private async createProvenance(
    uow: IUnitOfWork,
    data: Omit<ProvenanceRecord, "id" | "organizationId" | "createdAt">
  ): Promise<ProvenanceRecord> {
    const recordData: Omit<ProvenanceRecord, "organizationId"> = {
      id: `prov-${randomUUID()}`,
      ...data,
      createdAt: new Date().toISOString(),
    };
    assertProvenanceRecordInvariant(recordData);
    const record = await this.database.provenanceRepo.create(recordData, uow.context);
    await uow.recordAuditLog({
      organizationId: uow.context.organizationId,
      actorId: uow.context.userId,
      actorEmail: uow.context.userEmail,
      action: "evidence:provenance_recorded",
      resource: record.subjectType,
      resourceId: record.subjectId,
      requestId: uow.context.requestId,
      status: "success",
      metadata: {
        provenanceId: record.id,
        relation: record.relation,
        producerType: record.producerType,
        method: record.method,
        lifecycle: "value_execution",
      },
      timestamp: record.createdAt,
    });
    return record;
  }

  private async recordLifecycleAudit(
    uow: IUnitOfWork,
    command: ValueExecutionLifecycleCommand["command"],
    resource: string,
    resourceId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await uow.recordAuditLog({
      organizationId: uow.context.organizationId,
      actorId: uow.context.userId,
      actorEmail: uow.context.userEmail,
      action: `value_execution:${command}`,
      resource,
      resourceId,
      requestId: uow.context.requestId,
      status: "success",
      metadata: { lifecycle: "value_execution", ...metadata },
      timestamp: new Date().toISOString(),
    });
  }

  private nextDecisionTimestamp(latestCreatedAt?: string): string {
    const wallClock = Date.now();
    const previous = latestCreatedAt ? Date.parse(latestCreatedAt) : Number.NaN;
    const timestamp = Number.isFinite(previous) ? Math.max(wallClock, previous + 1) : wallClock;
    return new Date(timestamp).toISOString();
  }

  private requireMeasurementSources(value: unknown): ProvenanceSourceReference[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new ValidationError("Measurement sources must contain at least one provenance source reference");
    }
    return value as ProvenanceSourceReference[];
  }

  private requireIdArray(value: unknown, field: string): string[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new ValidationError(`${field} must contain at least one id`);
    }
    const normalized = value.map((item, index) => Validator.requireId(item, `${field}[${index}]`));
    return [...new Set(normalized)];
  }

  private requireStringArray(value: unknown, field: string): string[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new ValidationError(`${field} must contain at least one non-empty string`);
    }
    return value.map((item, index) => Validator.requireString(item, `${field}[${index}]`, { maxLength: 1_000 }));
  }
}

export const valueExecutionLifecycleService = new ValueExecutionLifecycleService();
