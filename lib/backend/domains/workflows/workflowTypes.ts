/**
 * APEX ONE — Workflow Domain Types & DTOs
 */

import {
  WorkflowNode,
  WorkflowConnection,
  WorkflowStatus,
  WorkflowRecord,
  WorkflowRunRecord,
  WorkflowRunStatus,
} from "../../database/schema";

export interface CreateWorkflowDto {
  name: string;
  description: string;
  subsidiary: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  status?: WorkflowStatus;
}

export interface UpdateWorkflowDto {
  name?: string;
  description?: string;
  subsidiary?: string;
  nodes?: WorkflowNode[];
  connections?: WorkflowConnection[];
  status?: WorkflowStatus;
}

export interface TriggerWorkflowRunDto {
  workflowId: string;
  triggerType?: "manual" | "event" | "schedule" | "signal";
  contextData?: Record<string, unknown>;
}

export interface AdvanceWorkflowStepDto {
  runId: string;
  stepId: string;
  decision?: "approved" | "rejected" | "completed";
  output?: Record<string, unknown>;
  comments?: string;
}
