import { WorkflowDef, IntegrationItem } from "@/lib/types";
import { CustomWorkflowDef } from "@/lib/data/demo";
import { apiClient } from "@/lib/apiClient";
import { WorkflowRecord } from "@/lib/backend/database/schema";

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
    successRate: (w as any).successRate || 94.5,
    runsPerWeek: (w as any).runsPerWeek || 42,
    lastRun: (w as any).lastRun || "3 hours ago",
    nodes: (w as any).nodes || defaultNodes,
    connections: (w as any).connections || defaultConnections,
    contextAwareDetails: {
      trigger: { label: "Trigger: Telemetry Event", details: `${w.name} active event monitor.`, active: false, done: false },
      context: { label: "Context: Health & Governance", details: "Active contract verification in effect.", active: false, done: false },
      aiReasoning: { label: "AI Cognitive Analysis", details: "Evaluating risk indices...", active: false, done: false, content: `Continuous cognitive pipeline active for ${w.name}.` },
      decision: { label: "Strategic AI Recommendation", details: "Routing optimal path...", active: false, done: false, content: "Deploy targeted automated remediation." },
      action: { label: "Action: Executive Sign-Off", details: "Awaiting approval...", active: false, done: false, content: "Execute play with verified lead.", approvalRequired: true },
      outcome: { label: "Outcome: Enterprise Sync Completed", details: "Updated ledgers...", active: false, done: false, content: "Pipeline executed successfully and logged to institutional memory." }
    },
    history: [
      { id: `run-${w.id}-1`, status: "success", timestamp: "Aug 18, 2026, 11:20", duration: "1.6s", triggeredBy: "System Automation", outcomeText: "Completed successfully with full audit trail.", logs: ["Trigger received", "Risk model evaluated", "Action executed", "Audit committed"] },
      { id: `run-${w.id}-2`, status: "success", timestamp: "Aug 16, 2026, 09:45", duration: "2.1s", triggeredBy: "Elena Cho", outcomeText: "Manual trigger executed with verified sign-off.", logs: ["Manual trigger initiated", "Evaluated params", "Dispatched notice"] }
    ]
  };
}

export class ApiWorkflowRepository implements WorkflowRepository {
  async getWorkflows(organizationId?: string): Promise<WorkflowDef[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: WorkflowRecord[] }>("/api/v1/workflows");
      if (res && Array.isArray(res.data)) {
        return res.data.map(mapRecordToCustomWorkflow);
      }
      return [];
    } catch (err) {
      console.error("Failed to fetch workflows from API:", err);
      return [];
    }
  }

  async getCustomWorkflows(organizationId?: string): Promise<CustomWorkflowDef[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: WorkflowRecord[] }>("/api/v1/workflows");
      if (res && Array.isArray(res.data)) {
        return res.data.map(mapRecordToCustomWorkflow);
      }
      return [];
    } catch (err) {
      console.error("Failed to fetch custom workflows from API:", err);
      return [];
    }
  }

  async getWorkflow(id: string): Promise<CustomWorkflowDef | undefined> {
    try {
      const res = await apiClient.get<{ success: boolean; data: WorkflowRecord }>(`/api/v1/workflows/${id}`);
      if (res && res.data) {
        return mapRecordToCustomWorkflow(res.data);
      }
      return undefined;
    } catch (err) {
      console.error(`Failed to fetch workflow ${id} from API:`, err);
      const list = await this.getCustomWorkflows();
      return list.find(w => w.id === id);
    }
  }

  async runWorkflow(id: string): Promise<{ success: boolean; runId: string; logs: string[] }> {
    const res = await apiClient.post<{ success: boolean; data: { runId: string; logs: string[] } }>(`/api/v1/workflows/${id}/run`);
    return {
      success: !!res?.success,
      runId: res?.data?.runId || `run-${Date.now()}`,
      logs: res?.data?.logs || ["Workflow executed successfully."],
    };
  }

  async getIntegrations(_organizationId?: string): Promise<IntegrationItem[]> {
    return [];
  }

  async createWorkflow(data: Partial<WorkflowRecord>): Promise<WorkflowDef> {
    const res = await apiClient.post<{ success: boolean; data: WorkflowRecord }>("/api/v1/workflows", data);
    return mapRecordToCustomWorkflow(res.data);
  }

  async updateWorkflow(id: string, data: Partial<WorkflowRecord>): Promise<WorkflowDef> {
    const res = await apiClient.put<{ success: boolean; data: WorkflowRecord }>(`/api/v1/workflows/${id}`, data);
    return mapRecordToCustomWorkflow(res.data);
  }
}

export const workflowRepository = new ApiWorkflowRepository();

