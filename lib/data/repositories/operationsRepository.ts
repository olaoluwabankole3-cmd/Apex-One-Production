import { SubsidiaryOps, Incident, AutomationOpportunity, SlaPoint, SubsidiaryPerformance } from "@/lib/types";
import { Bottleneck, CapacityMetric, IncidentDetail } from "@/lib/data/demo";

export interface OperationsRepository {
  getSubsidiaryOps(organizationId?: string): Promise<SubsidiaryOps[]>;
  getIncidents(organizationId?: string): Promise<Incident[]>;
  getIncidentDetails(organizationId?: string): Promise<IncidentDetail[]>;
  getBottlenecks(organizationId?: string): Promise<Bottleneck[]>;
  getCapacityMetrics(organizationId?: string): Promise<CapacityMetric[]>;
  getAutomationOpportunities(organizationId?: string): Promise<AutomationOpportunity[]>;
  getSlaTrend(organizationId?: string): Promise<SlaPoint[]>;
  getSubsidiaryPerformance(organizationId?: string): Promise<SubsidiaryPerformance[]>;
}

// BACKEND CAPABILITY REQUIRED: Operations incidents, capacity metrics, bottleneck detection, and SLA telemetry service.
// Currently no operations telemetry endpoint exists in the backend architecture.
export class ApiOperationsRepository implements OperationsRepository {
  async getSubsidiaryOps(_organizationId?: string): Promise<SubsidiaryOps[]> {
    return [];
  }

  async getIncidents(_organizationId?: string): Promise<Incident[]> {
    return [];
  }

  async getIncidentDetails(_organizationId?: string): Promise<IncidentDetail[]> {
    return [];
  }

  async getBottlenecks(_organizationId?: string): Promise<Bottleneck[]> {
    return [];
  }

  async getCapacityMetrics(_organizationId?: string): Promise<CapacityMetric[]> {
    return [];
  }

  async getAutomationOpportunities(_organizationId?: string): Promise<AutomationOpportunity[]> {
    return [];
  }

  async getSlaTrend(_organizationId?: string): Promise<SlaPoint[]> {
    return [];
  }

  async getSubsidiaryPerformance(_organizationId?: string): Promise<SubsidiaryPerformance[]> {
    return [];
  }
}

export const operationsRepository = new ApiOperationsRepository();

