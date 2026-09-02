/**
 * APEX ONE — Workflow Domain Service
 *
 * Manages workflow graph definitions, validation, versioning, and execution engine runs.
 */

import { db, DatabaseStore } from "../../database/store";
import { WorkflowRecord, WorkflowRunRecord, WorkflowRunStepRecord } from "../../database/schema";
import { PaginatedResult } from "../../database/querySpecification";
import { TenantContext, requirePermission, ValidationError } from "../../core/security";
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  TriggerWorkflowRunDto,
  AdvanceWorkflowStepDto,
} from "./workflowTypes";
import { WorkflowValidator } from "./workflowValidator";

export interface WorkflowListOptions {
  status?: string;
  limit?: number;
  cursor?: string | null;
}

export interface WorkflowRunListOptions {
  limit?: number;
  cursor?: string | null;
}

export class WorkflowService {
  constructor(private readonly database: DatabaseStore = db) {}

  /**
   * List workflows for the tenant while preserving cursor metadata.
   */
  public async getWorkflows(
    ctx: TenantContext,
    filter?: WorkflowListOptions
  ): Promise<PaginatedResult<WorkflowRecord>> {
    requirePermission(ctx, "workflow:read");

    return this.database.workflowsRepo.findMany(ctx, {
      where: {
        status:
          filter?.status && filter.status !== "all"
            ? (filter.status as any)
            : undefined,
      },
      limit: filter?.limit,
      cursor: filter?.cursor,
    });
  }

  /**
   * Fetch single workflow by ID within tenant context.
   */
  public async getWorkflowById(id: string, ctx: TenantContext): Promise<WorkflowRecord> {
    requirePermission(ctx, "workflow:read");
    return this.database.workflowsRepo.findById(id, ctx, "Workflow");
  }

  /**
   * Create a new workflow with DAG validation.
   */
  public async createWorkflow(dto: CreateWorkflowDto, ctx: TenantContext): Promise<WorkflowRecord> {
    requirePermission(ctx, "workflow:write");

    if (!dto.name || dto.name.trim().length === 0) {
      throw new ValidationError("Workflow name is required");
    }

    WorkflowValidator.validateWorkflowGraph(dto.nodes, dto.connections);

    const id = `wf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const newWf: WorkflowRecord = {
      id,
      organizationId: ctx.organizationId,
      name: dto.name.trim(),
      description: dto.description || "",
      subsidiary: dto.subsidiary || "General Operations",
      status: dto.status || "active",
      version: 1,
      nodes: dto.nodes,
      connections: dto.connections,
      runsCount: 0,
      successRate: 100,
      createdAt: now,
      updatedAt: now,
    };

    return this.database.runInTransaction(ctx, async (uow) => {
      const created = await uow.workflows.create(newWf, uow.context);

      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "workflow:create",
        resource: "Workflow",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { workflowName: dto.name, nodeCount: dto.nodes.length },
        timestamp: now,
      });

      return created;
    });
  }

  /**
   * Update workflow with graph validation.
   */
  public async updateWorkflow(
    id: string,
    dto: UpdateWorkflowDto,
    ctx: TenantContext
  ): Promise<WorkflowRecord> {
    requirePermission(ctx, "workflow:write");

    return this.database.runInTransaction(ctx, async (uow) => {
      const existing = await uow.workflows.findById(id, uow.context, "Workflow");

      const nextNodes = dto.nodes || existing.nodes;
      const nextConnections = dto.connections || existing.connections;

      if (dto.nodes || dto.connections) {
        WorkflowValidator.validateWorkflowGraph(nextNodes, nextConnections);
      }

      const updated = await uow.workflows.update(
        id,
        {
          ...dto,
          version: existing.version + 1,
        },
        uow.context,
        "Workflow"
      );

      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "workflow:update",
        resource: "Workflow",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { version: existing.version + 1 },
        timestamp: new Date().toISOString(),
      });

      return updated;
    });
  }

  /**
   * Trigger a new workflow execution run.
   */
  public async triggerWorkflowRun(dto: TriggerWorkflowRunDto, ctx: TenantContext): Promise<WorkflowRunRecord> {
    requirePermission(ctx, "workflow:execute");

    return this.database.runInTransaction(ctx, async (uow) => {
      const wf = await uow.workflows.findById(dto.workflowId, uow.context, "Workflow");
      if (wf.status !== "active") {
        throw new ValidationError(`Cannot execute workflow in status '${wf.status}'`);
      }

      const steps: WorkflowRunStepRecord[] = wf.nodes.map((node, index) => ({
        stepId: `step-${index + 1}-${node.id}`,
        nodeId: node.id,
        nodeTitle: node.title,
        status: index === 0 ? "completed" : index === 1 ? "executing" : "pending",
        startedAt: new Date().toISOString(),
        completedAt: index === 0 ? new Date().toISOString() : undefined,
      }));

      const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const runRecord: WorkflowRunRecord = {
        id: runId,
        organizationId: uow.context.organizationId,
        workflowId: wf.id,
        workflowVersion: wf.version,
        triggeredBy: uow.context.userEmail,
        triggerType: dto.triggerType || "manual",
        status: "running",
        steps,
        contextData: dto.contextData || {},
        startedAt: new Date().toISOString(),
      };

      await uow.workflows.update(
        wf.id,
        { runsCount: wf.runsCount + 1 },
        uow.context,
        "Workflow"
      );

      const createdRun = await uow.workflowRuns.create(runRecord, uow.context);

      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "workflow:trigger_run",
        resource: "WorkflowRun",
        resourceId: runId,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { workflowId: wf.id, runId },
        timestamp: new Date().toISOString(),
      });

      return createdRun;
    });
  }

  /**
   * Advance a workflow run step (e.g., human approval or async integration callback).
   */
  public async advanceWorkflowStep(dto: AdvanceWorkflowStepDto, ctx: TenantContext): Promise<WorkflowRunRecord> {
    requirePermission(ctx, "workflow:execute");

    return this.database.runInTransaction(ctx, async (uow) => {
      const run = await uow.workflowRuns.findById(dto.runId, uow.context, "WorkflowRun");

      const updatedSteps = run.steps.map((step) => {
        if (step.stepId === dto.stepId) {
          return {
            ...step,
            status: dto.decision === "rejected" ? ("failed" as const) : ("completed" as const),
            output: dto.output || { decision: dto.decision, comments: dto.comments },
            completedAt: new Date().toISOString(),
          };
        }
        return step;
      });

      const isAllCompleted = updatedSteps.every((s) => s.status === "completed");
      const hasFailed = updatedSteps.some((s) => s.status === "failed");
      const nextStatus = hasFailed ? "failed" : isAllCompleted ? "completed" : "running";

      const updated = await uow.workflowRuns.update(
        run.id,
        {
          steps: updatedSteps,
          status: nextStatus,
          completedAt:
            nextStatus === "completed" || nextStatus === "failed"
              ? new Date().toISOString()
              : undefined,
        },
        uow.context,
        "WorkflowRun"
      );

      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "workflow:advance_step",
        resource: "WorkflowRun",
        resourceId: run.id,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { stepId: dto.stepId, decision: dto.decision, nextStatus },
        timestamp: new Date().toISOString(),
      });

      return updated;
    });
  }

  /**
   * Get workflow runs through the same canonical cursor contract.
   */
  public async getWorkflowRuns(
    workflowId: string,
    ctx: TenantContext,
    options?: WorkflowRunListOptions
  ): Promise<PaginatedResult<WorkflowRunRecord>> {
    requirePermission(ctx, "workflow:read");
    return this.database.workflowRunsRepo.findMany(ctx, {
      where: { workflowId },
      limit: options?.limit,
      cursor: options?.cursor,
    });
  }
}

export const workflowService = new WorkflowService();
