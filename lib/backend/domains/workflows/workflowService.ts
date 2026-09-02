/**
 * APEX ONE — Workflow Domain Service
 *
 * Manages workflow graph definitions, validation, versioning, and execution engine runs.
 * Workflow-run step advancement is explicit and ordered: only the executing step may advance.
 */

import { DatabaseStore } from "../../database/store";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { WorkflowRecord, WorkflowRunRecord, WorkflowRunStepRecord } from "../../database/schema";
import { PaginatedResult } from "../../database/querySpecification";
import { TenantContext, requirePermission, ValidationError } from "../../core/security";
import { ConflictError } from "../../core/errors";
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
  constructor(private readonly database: DatabaseStore = createApplicationInfrastructure().database) {}

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

  public async getWorkflowById(id: string, ctx: TenantContext): Promise<WorkflowRecord> {
    requirePermission(ctx, "workflow:read");
    return this.database.workflowsRepo.findById(id, ctx, "Workflow");
  }

  public async createWorkflow(dto: CreateWorkflowDto, ctx: TenantContext): Promise<WorkflowRecord> {
    requirePermission(ctx, "workflow:write");
    if (!dto.name || dto.name.trim().length === 0) throw new ValidationError("Workflow name is required");
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
      if (dto.nodes || dto.connections) WorkflowValidator.validateWorkflowGraph(nextNodes, nextConnections);

      const updated = await uow.workflows.update(
        id,
        { ...dto, version: existing.version + 1 },
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

  public async triggerWorkflowRun(dto: TriggerWorkflowRunDto, ctx: TenantContext): Promise<WorkflowRunRecord> {
    requirePermission(ctx, "workflow:execute");

    return this.database.runInTransaction(ctx, async (uow) => {
      const wf = await uow.workflows.findById(dto.workflowId, uow.context, "Workflow");
      if (wf.status !== "active") throw new ValidationError(`Cannot execute workflow in status '${wf.status}'`);
      if (wf.nodes.length === 0) throw new ValidationError("Cannot execute a workflow with no nodes");

      const startedAt = new Date().toISOString();
      const firstExecutableIndex = wf.nodes[0]?.type === "trigger" ? 1 : 0;
      const steps: WorkflowRunStepRecord[] = wf.nodes.map((node, index) => ({
        stepId: `step-${index + 1}-${node.id}`,
        nodeId: node.id,
        nodeTitle: node.title,
        status:
          index < firstExecutableIndex
            ? "completed"
            : index === firstExecutableIndex
              ? "executing"
              : "pending",
        startedAt,
        completedAt: index < firstExecutableIndex ? startedAt : undefined,
      }));
      const immediatelyCompleted = steps.every((step) => step.status === "completed");

      const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const runRecord: WorkflowRunRecord = {
        id: runId,
        organizationId: uow.context.organizationId,
        workflowId: wf.id,
        workflowVersion: wf.version,
        triggeredBy: uow.context.userEmail,
        triggerType: dto.triggerType || "manual",
        status: immediatelyCompleted ? "completed" : "running",
        steps,
        contextData: dto.contextData || {},
        startedAt,
        completedAt: immediatelyCompleted ? startedAt : undefined,
      };

      await uow.workflows.update(wf.id, { runsCount: wf.runsCount + 1 }, uow.context, "Workflow");
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
        timestamp: startedAt,
      });
      return createdRun;
    });
  }

  public async advanceWorkflowStep(dto: AdvanceWorkflowStepDto, ctx: TenantContext): Promise<WorkflowRunRecord> {
    requirePermission(ctx, "workflow:execute");

    return this.database.runInTransaction(ctx, async (uow) => {
      const run = await uow.workflowRuns.findById(dto.runId, uow.context, "WorkflowRun");
      if (run.status !== "running" && run.status !== "waiting_approval") {
        throw new ConflictError(`WorkflowRun '${run.id}' cannot advance from terminal status '${run.status}'`);
      }

      const targetIndex = run.steps.findIndex((step) => step.stepId === dto.stepId);
      if (targetIndex < 0) throw new ValidationError(`Workflow step '${dto.stepId}' was not found`);
      const target = run.steps[targetIndex];
      if (target.status !== "executing") {
        throw new ConflictError(
          `Workflow step '${target.stepId}' cannot advance from status '${target.status}'; only the executing step may advance`
        );
      }

      const completedAt = new Date().toISOString();
      const updatedSteps = run.steps.map((step) => ({ ...step }));
      if (dto.decision === "rejected") {
        updatedSteps[targetIndex] = {
          ...target,
          status: "failed",
          output: dto.output || { decision: dto.decision, comments: dto.comments },
          completedAt,
        };
      } else {
        updatedSteps[targetIndex] = {
          ...target,
          status: "completed",
          output: dto.output || { decision: dto.decision || "completed", comments: dto.comments },
          completedAt,
        };
        const nextPendingIndex = updatedSteps.findIndex(
          (step, index) => index > targetIndex && step.status === "pending"
        );
        if (nextPendingIndex >= 0) {
          updatedSteps[nextPendingIndex] = {
            ...updatedSteps[nextPendingIndex],
            status: "executing",
            startedAt: completedAt,
          };
        }
      }

      const hasFailed = updatedSteps.some((step) => step.status === "failed");
      const isAllCompleted = updatedSteps.every((step) => step.status === "completed");
      const nextStatus = hasFailed ? "failed" : isAllCompleted ? "completed" : "running";
      const promotedStep = updatedSteps.find((step, index) => index > targetIndex && step.status === "executing");

      const updated = await uow.workflowRuns.update(
        run.id,
        {
          steps: updatedSteps,
          status: nextStatus,
          completedAt: nextStatus === "completed" || nextStatus === "failed" ? completedAt : undefined,
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
        metadata: {
          stepId: dto.stepId,
          decision: dto.decision || "completed",
          nextStatus,
          promotedStepId: promotedStep?.stepId,
        },
        timestamp: completedAt,
      });
      return updated;
    });
  }

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
