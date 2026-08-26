/**
 * APEX ONE — Workflow Domain Service
 * 
 * Manages workflow graph definitions, validation, versioning, and execution engine runs.
 */

import { db } from "../../database/store";
import { WorkflowRecord, WorkflowRunRecord, WorkflowRunStepRecord } from "../../database/schema";
import { TenantContext, requirePermission, ValidationError, NotFoundError } from "../../core/security";
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  TriggerWorkflowRunDto,
  AdvanceWorkflowStepDto,
} from "./workflowTypes";
import { WorkflowValidator } from "./workflowValidator";

export class WorkflowService {
  /**
   * List all workflows for the tenant.
   */
  public async getWorkflows(ctx: TenantContext, filter?: { status?: string }): Promise<WorkflowRecord[]> {
    requirePermission(ctx, "workflow:read");

    return db.workflowsRepo.findMany(ctx, (w) => {
      if (filter?.status && filter.status !== "all" && w.status !== filter.status) {
        return false;
      }
      return true;
    });
  }

  /**
   * Fetch single workflow by ID within tenant context.
   */
  public async getWorkflowById(id: string, ctx: TenantContext): Promise<WorkflowRecord> {
    requirePermission(ctx, "workflow:read");
    return db.workflowsRepo.findById(id, ctx, "Workflow");
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return db.workflowsRepo.create(newWf, ctx);
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

    const existing = await db.workflowsRepo.findById(id, ctx, "Workflow");

    const nextNodes = dto.nodes || existing.nodes;
    const nextConnections = dto.connections || existing.connections;

    if (dto.nodes || dto.connections) {
      WorkflowValidator.validateWorkflowGraph(nextNodes, nextConnections);
    }

    return db.workflowsRepo.update(
      id,
      {
        ...dto,
        version: existing.version + 1,
      },
      ctx,
      "Workflow"
    );
  }

  /**
   * Trigger a new workflow execution run.
   */
  public async triggerWorkflowRun(dto: TriggerWorkflowRunDto, ctx: TenantContext): Promise<WorkflowRunRecord> {
    requirePermission(ctx, "workflow:execute");

    const wf = await db.workflowsRepo.findById(dto.workflowId, ctx, "Workflow");
    if (wf.status !== "active") {
      throw new ValidationError(`Cannot execute workflow in status '${wf.status}'`);
    }

    // Build execution step queue starting from triggers
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
      organizationId: ctx.organizationId,
      workflowId: wf.id,
      workflowVersion: wf.version,
      triggeredBy: ctx.userEmail,
      triggerType: dto.triggerType || "manual",
      status: "running",
      steps,
      contextData: dto.contextData || {},
      startedAt: new Date().toISOString(),
    };

    // Increment runs count
    await db.workflowsRepo.update(
      wf.id,
      {
        runsCount: wf.runsCount + 1,
      },
      ctx,
      "Workflow"
    );

    return db.workflowRunsRepo.create(runRecord, ctx);
  }

  /**
   * Advance a workflow run step (e.g., human approval or async integration callback).
   */
  public async advanceWorkflowStep(dto: AdvanceWorkflowStepDto, ctx: TenantContext): Promise<WorkflowRunRecord> {
    requirePermission(ctx, "workflow:execute");

    const run = await db.workflowRunsRepo.findById(dto.runId, ctx, "WorkflowRun");

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

    return db.workflowRunsRepo.update(
      run.id,
      {
        steps: updatedSteps,
        status: nextStatus,
        completedAt: nextStatus === "completed" || nextStatus === "failed" ? new Date().toISOString() : undefined,
      },
      ctx,
      "WorkflowRun"
    );
  }

  /**
   * Get all runs for a workflow.
   */
  public async getWorkflowRuns(workflowId: string, ctx: TenantContext): Promise<WorkflowRunRecord[]> {
    requirePermission(ctx, "workflow:read");
    return db.workflowRunsRepo.findByWorkflow(workflowId, ctx);
  }
}

export const workflowService = new WorkflowService();
