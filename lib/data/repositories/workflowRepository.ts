import { WorkflowDef, IntegrationItem } from "@/lib/types";
import { CustomWorkflowDef } from "@/lib/data/demo";
import { apiClient } from "@/lib/apiClient";
import { WorkflowRecord, WorkflowRunRecord } from "@/lib/backend/database/schema";
import { collectAllCollectionData, isApiNotFound } from "./httpCollection";

export interface WorkflowRepository {
  getWorkflows(organizationId?: string): Promise<WorkflowDef[]>;
  getCustomWorkflows(organizationId?: string): Promise<CustomWorkflowDef[]>;
  getWorkflow(id: string): Promise<CustomWorkflowDef | undefined>;
  getIntegrations(organizationId?: string): Promise<IntegrationItem[]>;
  runWorkflow(id: string): Promise<{ success: boolean; runId: string; logs: string[] }>;
  createWorkflow(data: Partial<WorkflowRecord>): Promise<WorkflowDef>;
  updateWorkflow(id: string, data: Partial<WorkflowRecord>): Promise<WorkflowDef>;
}

function mapRecordToCustomWorkflow(w: WorkflowRecord): CustomWorkflowDef {
  const nodes = Array.isArray((w as any).nodes) ? (w as any).nodes : [];
  const connections = Array.isArray((w as any).connections) ? (w as any).connections : [];

  return {
    id: w.id,
    name: w.name,
    description: w.description,
    subsidiary: (w.subsidiary as any) || "",
    businessUnit: (w.subsidiary as any) || "",
    status: w.status === "active" ? "active" : "draft",
    successRate:
      typeof (w as any).successRate === "number" ? (w as any).successRate : 0,
    runsPerWeek:
      typeof (w as any).runsPerWeek === "number" ? (w as any).runsPerWeek : 0,
    lastRun: typeof (w as any).lastRun === "string" ? (w as any).lastRun : "Not recorded",
    nodes,
    connections,
    // Legacy presentation shape retained without inventing reasoning or outcomes.
    contextAwareDetails: {
      trigger: { label: "Trigger", details: "No trigger execution detail recorded.", active: false, done: false },
      context: { label: "Context", details: "No context execution detail recorded.", active: false, done: false },
      aiReasoning: { label: "AI analysis", details: "No AI execution detail recorded.", active: false, done: false, content: "" },
      decision: { label: "Decision", details: "No decision execution detail recorded.", active: false, done: false, content: "" },
      action: { label: "Action", details: "No action execution detail recorded.", active: false, done: false, content: "", approvalRequired: false },
      outcome: { label: "Outcome", details: "No outcome execution detail recorded.", active: false, done: false, content: "" },
    },
    history: [],
  };
}

export class ApiWorkflowRepository implements WorkflowRepository {
  async getWorkflows(_organizationId?: string): Promise<WorkflowDef[]> {
    const records = await collectAllCollectionData<WorkflowRecord>("/api/v1/workflows");
    return records.map(mapRecordToCustomWorkflow);
  }

  async getCustomWorkflows(_organizationId?: string): Promise<CustomWorkflowDef[]> {
    const records = await collectAllCollectionData<WorkflowRecord>("/api/v1/workflows");
    return records.map(mapRecordToCustomWorkflow);
  }

  async getWorkflow(id: string): Promise<CustomWorkflowDef | undefined> {
    try {
      const record = await apiClient.getData<WorkflowRecord>(`/api/v1/workflows/${id}`);
      return mapRecordToCustomWorkflow(record);
    } catch (error: unknown) {
      if (isApiNotFound(error)) return undefined;
      throw error;
    }
  }

  async runWorkflow(id: string): Promise<{ success: boolean; runId: string; logs: string[] }> {
    const run = await apiClient.postData<WorkflowRunRecord>(`/api/v1/workflows/${id}/run`, {});
    return {
      success: true,
      runId: run.id,
      logs: run.steps.map((step) => `${step.nodeTitle}: ${step.status}`),
    };
  }

  async getIntegrations(_organizationId?: string): Promise<IntegrationItem[]> {
    return [];
  }

  async createWorkflow(data: Partial<WorkflowRecord>): Promise<WorkflowDef> {
    const record = await apiClient.postData<WorkflowRecord>("/api/v1/workflows", data);
    return mapRecordToCustomWorkflow(record);
  }

  async updateWorkflow(id: string, data: Partial<WorkflowRecord>): Promise<WorkflowDef> {
    const record = await apiClient.putData<WorkflowRecord>(`/api/v1/workflows/${id}`, data);
    return mapRecordToCustomWorkflow(record);
  }
}

export const workflowRepository = new ApiWorkflowRepository();
