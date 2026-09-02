/**
 * APEX ONE — Execution Engine & Actions Domain Service
 *
 * First-class action entities, human-approval gating, execution state transitions, and audit logs.
 * Stage 7 lifecycle-linked Actions are intentionally excluded from the legacy generic advance path.
 */

import { DatabaseStore } from "../../database/store";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { ActionRecord } from "../../database/schema";
import { PaginatedResult, MAX_PAGE_SIZE } from "../../database/querySpecification";
import { collectAllPages } from "../../database/paginationTraversal";
import { TenantContext, requirePermission } from "../../core/security";
import { ConflictError } from "../../core/errors";
import { Validator } from "../../core/validation";
import { STAGE7_ACTION_PROVENANCE_METHOD } from "../value/valueExecutionLifecycleModel";

export interface CreateActionDto {
  recommendation: string;
  owner?: string;
  deadline?: string;
  expectedValue?: number;
  confidence?: number;
  automationType?: "Manual" | "AI-assisted" | "Automated" | "Awaiting approval";
  requiresHumanApproval?: boolean;
  insightSource?: string;
  decisionDetail?: string;
  resultMetric?: string;
}

export interface ActionListOptions {
  status?: string;
  limit?: number;
  cursor?: string | null;
}

export class ActionService {
  constructor(private readonly database: DatabaseStore = createApplicationInfrastructure().database) {}

  public async getActions(
    ctx: TenantContext,
    options?: ActionListOptions
  ): Promise<PaginatedResult<ActionRecord>> {
    requirePermission(ctx, "value:read");
    return this.database.actionsRepo.findMany(ctx, {
      where: {
        status:
          options?.status && options.status !== "all"
            ? (options.status as any)
            : undefined,
      },
      limit: options?.limit,
      cursor: options?.cursor,
    });
  }

  public async getActionById(id: string, ctx: TenantContext): Promise<ActionRecord> {
    requirePermission(ctx, "value:read");
    Validator.requireId(id, "actionId");
    return this.database.actionsRepo.findById(id, ctx, "Action");
  }

  public async createAction(dto: CreateActionDto, ctx: TenantContext): Promise<ActionRecord> {
    requirePermission(ctx, "action:create");

    const validatedRec = Validator.requireString(dto.recommendation, "recommendation", { minLength: 5, maxLength: 200 });
    const validatedExpectedValue = Validator.optionalNumber(dto.expectedValue, "expectedValue", { min: 0 }) || 0;
    const validatedConfidence = Validator.optionalNumber(dto.confidence, "confidence", { min: 0, max: 100 }) ?? 90;
    const validatedType = Validator.optionalEnum(
      dto.automationType,
      ["Manual", "AI-assisted", "Automated", "Awaiting approval"] as const,
      "automationType"
    ) || "AI-assisted";

    const id = `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const recordData: Omit<ActionRecord, "organizationId"> = {
      id,
      recommendation: validatedRec,
      owner: dto.owner?.trim() || ctx.userEmail,
      deadline: dto.deadline || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      expectedValue: validatedExpectedValue,
      status: "Ready",
      confidence: validatedConfidence,
      automationType: validatedType,
      requiresHumanApproval: dto.requiresHumanApproval ?? true,
      insightSource: dto.insightSource?.trim() || "Autonomous telemetry trigger",
      decisionDetail: dto.decisionDetail?.trim() || "System identified operational improvement",
      resultMetric: dto.resultMetric?.trim() || "Value captured in financial ledger",
      logs: [`Action created by ${ctx.userEmail} (${ctx.userRole})`],
      createdAt: now,
      updatedAt: now,
    };

    return this.database.runInTransaction(ctx, async (uow) => {
      const action = await uow.actions.create(recordData, uow.context);

      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "action:create",
        resource: "Action",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { recommendation: action.recommendation },
        timestamp: now,
      });

      return action;
    });
  }

  public async advanceAction(id: string, ctx: TenantContext): Promise<ActionRecord> {
    Validator.requireId(id, "actionId");

    return this.database.runInTransaction(ctx, async (uow) => {
      const action = await uow.actions.findById(id, uow.context, "Action");
      await this.assertNotLifecycleLinkedAction(action.id, uow.context);

      const pipelineOrder: ActionRecord["status"][] = ["Ready", "Approved", "In Progress", "Completed", "Measured"];
      const currentIndex = pipelineOrder.indexOf(action.status);
      if (currentIndex >= pipelineOrder.length - 1) return action;

      const nextStatus = pipelineOrder[currentIndex + 1];
      Validator.validateStateTransition(
        action.status,
        nextStatus,
        {
          Ready: ["Approved"],
          Approved: ["In Progress"],
          "In Progress": ["Completed"],
          Completed: ["Measured"],
          Measured: [],
        },
        "Action"
      );

      if (nextStatus === "Approved") requirePermission(uow.context, "action:approve");
      else if (nextStatus === "In Progress" || nextStatus === "Completed") requirePermission(uow.context, "action:execute");
      else if (nextStatus === "Measured") requirePermission(uow.context, "value:approve");

      const updatedLogs = [...action.logs];
      let approvedBy = action.approvedBy;

      if (nextStatus === "Approved") {
        updatedLogs.push(`Approved by ${uow.context.userEmail} (${uow.context.userRole})`);
        approvedBy = uow.context.userEmail;
      } else if (nextStatus === "In Progress") {
        updatedLogs.push("Execution engine initiated action processing");
      } else if (nextStatus === "Completed") {
        updatedLogs.push("Execution tasks completed successfully");
      } else if (nextStatus === "Measured") {
        updatedLogs.push("Legacy measurement status recorded; verification and certification remain separate evidence decisions");
      }

      const updated = await uow.actions.update(
        id,
        { status: nextStatus, logs: updatedLogs, approvedBy },
        uow.context,
        "Action"
      );

      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: `action:advance_${nextStatus.toLowerCase().replace(" ", "_")}`,
        resource: "Action",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { newStatus: nextStatus, recommendation: action.recommendation },
        timestamp: new Date().toISOString(),
      });

      return updated;
    });
  }

  private async assertNotLifecycleLinkedAction(id: string, ctx: TenantContext): Promise<void> {
    const provenance = await collectAllPages((cursor) =>
      this.database.provenanceRepo.findBySubject(
        { subjectType: "Action", subjectId: id, limit: MAX_PAGE_SIZE, cursor },
        ctx
      )
    );
    if (provenance.some((record) => record.method === STAGE7_ACTION_PROVENANCE_METHOD)) {
      throw new ConflictError(
        `Action '${id}' belongs to the Stage 7 value-execution lifecycle and must use explicit lifecycle commands`
      );
    }
  }
}

export const actionService = new ActionService();
