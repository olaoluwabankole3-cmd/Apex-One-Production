/**
 * APEX ONE — Execution Engine & Actions Domain Service
 *
 * First-class action entities, human-approval gating, execution state transitions, and audit logs.
 */

import { db, DatabaseStore } from "../../database/store";
import { ActionRecord } from "../../database/schema";
import { PaginatedResult } from "../../database/querySpecification";
import { TenantContext, requirePermission } from "../../core/security";
import { Validator } from "../../core/validation";

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
  constructor(private readonly database: DatabaseStore = db) {}

  /**
   * List execution actions for the tenant through the canonical cursor contract.
   */
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

  /**
   * Fetch a single action, checking tenant ownership via repository.
   */
  public async getActionById(id: string, ctx: TenantContext): Promise<ActionRecord> {
    requirePermission(ctx, "value:read");
    Validator.requireId(id, "actionId");
    return this.database.actionsRepo.findById(id, ctx, "Action");
  }

  /**
   * Create an execution action.
   */
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

  /**
   * Approve or execute an action through its lifecycle: Ready -> Approved -> In Progress -> Completed -> Measured.
   */
  public async advanceAction(id: string, ctx: TenantContext): Promise<ActionRecord> {
    Validator.requireId(id, "actionId");

    return this.database.runInTransaction(ctx, async (uow) => {
      const action = await uow.actions.findById(id, uow.context, "Action");

      const pipelineOrder: ActionRecord["status"][] = ["Ready", "Approved", "In Progress", "Completed", "Measured"];
      const currentIndex = pipelineOrder.indexOf(action.status);
      if (currentIndex >= pipelineOrder.length - 1) {
        return action;
      }

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

      if (nextStatus === "Approved") {
        requirePermission(uow.context, "action:approve");
      } else if (nextStatus === "In Progress" || nextStatus === "Completed") {
        requirePermission(uow.context, "action:execute");
      } else if (nextStatus === "Measured") {
        requirePermission(uow.context, "value:approve");
      }

      const updatedLogs = [...action.logs];
      let approvedBy = action.approvedBy;

      if (nextStatus === "Approved") {
        updatedLogs.push(`Approved by ${uow.context.userEmail} (${uow.context.userRole})`);
        approvedBy = uow.context.userEmail;
      } else if (nextStatus === "In Progress") {
        updatedLogs.push("Execution engine initiated automated workflows");
      } else if (nextStatus === "Completed") {
        updatedLogs.push("Execution tasks verified and completed successfully");
      } else if (nextStatus === "Measured") {
        updatedLogs.push("Certified yield logged in organizational ledger");
      }

      const updated = await uow.actions.update(
        id,
        {
          status: nextStatus,
          logs: updatedLogs,
          approvedBy,
        },
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
}

export const actionService = new ActionService();
