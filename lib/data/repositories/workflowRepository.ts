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
  const defaultNodes = [
    { id: "n1", type: "trigger" as const, label: "Trigger: Usage/SLA Threshold", subtitle: "Automated trigger baseline", x: 40, y: 50 },
    { id: "n2", type: "context" as const, label: "Multi-Signal Context Evaluator", subtitle: "Correlate contract & health indicators", x: 280, y: 50 },
    { id: "n3", type: "ai_analyze" as const, label: "AI Analyze Account Health", subtitle: "Evaluate risk indicators", x: 520, y: 50 },
    { id: "n4", type: "ai_predict" as const, label: "AI Predict Exposure", subtitle: "Compute mitigation pathways", x: 760, y: 50 },
    { id: "n5", type: "ai_recommend" as const, label: "AI Recommend Strategy", subtitle: "Generate action proposal", x: 760, y: 180 },
    { id: "n6", type: "action" as const, label: "Human Approval Gate", subtitle: "Director sign-off required", x: 520, y: 180 },
    { id: "n7", type: "ai_generate" as const, label: "AI Generate Audit Briefing", subtitle: "Formulate strategic brief", x: 280, y: 180 },
    { id: "n8", type: "integration" as const, label: "Enterprise Ledger Sync", subtitle: "Execute database commit", x: 40, y: 180 }
  ];

  const defaultConnections = [
    { id: "c1", from: "n1", to: "n2" },
    { id: "c2", from: "n2", to: "n3" },
    { id: "c3", from: "n3", to: "n4" },
    { id: "c4", from: "n4", to: "n5" },
    { id: "c5", from: "n5", to: "n6" },
    { id: "c6", from: "n6", to: "n7" },
    { id: "c7", from: "n7", to: "n8" }
  ];

  return {
    id: w.id,
    name: w.name,
    description: w.description,
    subsidiary: (w.subsidiary as any) || "Strategic Accounts",
    businessUnit: (w.subsidiary as any) || "Strategic Accounts",
    status: w.status === "active" ? "active" : "draft",
    successRate: (w as any).successRate || 100,
    runsPerWeek: (w as any).runsPerWeek || 0,
    lastRun: (w as any).lastRun || "Never",
    nodes: (w as any).nodes || defaultNodes,
    connections: (w as any).connections || defaultConnections,
    contextAwareDetails: {
      trigger: { label: "Trigger: Telemetry Event", details: `${w.name} trigger definition.`, active: false, done: false },
      context: { label: "Context: Health & Governance", details: "Active verification rules in effect.", active: false, done: false },
      aiReasoning: { label: "AI Cognitive Analysis", details: "Evaluating risk indicators...", active: false, done: false, content: `Continuous cognitive pipeline active for ${w.name}.` },
      decision: { label: "Strategic AI Recommendation", details: "Evaluating pathway...", active: false, done: false, content: "Deploy automated remediation." },
      action: { label: "Action: Sign-Off Gate", details: "Awaiting execution trigger...", active: false, done: false, content: "Execute with verified parameters.", approvalRequired: true },
      outcome: { label: "Outcome: Ledger Synchronization", details: "Commit status...", active: false, done: false, content: "Logged to organizational memory." }
    },
    history: []
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
