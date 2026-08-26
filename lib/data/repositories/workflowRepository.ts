import { WorkflowDef, IntegrationItem } from "@/lib/types";
import { demoWorkflows, CustomWorkflowDef } from "@/lib/data/demo";

export interface WorkflowRepository {
  getWorkflows(organizationId?: string): Promise<WorkflowDef[]>;
  getCustomWorkflows(organizationId?: string): Promise<CustomWorkflowDef[]>;
  getWorkflow(id: string): Promise<CustomWorkflowDef | undefined>;
  getIntegrations(organizationId?: string): Promise<IntegrationItem[]>;
}

export class MockWorkflowRepository implements WorkflowRepository {
  async getWorkflows(_organizationId?: string): Promise<WorkflowDef[]> {
    return demoWorkflows.map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      subsidiary: w.businessUnit,
      status: w.status,
      successRate: w.successRate,
      runsPerWeek: w.runsPerWeek,
      lastRun: w.lastRun,
      nodes: w.nodes,
      connections: w.connections
    }));
  }

  async getCustomWorkflows(_organizationId?: string): Promise<CustomWorkflowDef[]> {
    return demoWorkflows;
  }

  async getWorkflow(id: string): Promise<CustomWorkflowDef | undefined> {
    return demoWorkflows.find(w => w.id === id);
  }

  async getIntegrations(_organizationId?: string): Promise<IntegrationItem[]> {
    return [];
  }
}

export const workflowRepository = new MockWorkflowRepository();
