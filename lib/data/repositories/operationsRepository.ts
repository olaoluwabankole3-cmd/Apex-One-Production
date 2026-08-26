import { SubsidiaryOps, Incident, AutomationOpportunity, SlaPoint, SubsidiaryPerformance } from "@/lib/types";
import { demoBottlenecks, demoCapacityMetrics, demoIncidents, Bottleneck, CapacityMetric, IncidentDetail } from "@/lib/data/demo";

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

export class MockOperationsRepository implements OperationsRepository {
  async getSubsidiaryOps(_organizationId?: string): Promise<SubsidiaryOps[]> {
    return [];
  }

  async getIncidents(_organizationId?: string): Promise<Incident[]> {
    return demoIncidents.map(i => ({
      id: i.id,
      subsidiary: i.subsidiary,
      title: i.title,
      severity: i.severity,
      status: i.status,
      opened: "Aug 18, 2026",
      owner: "Operations Response Desk"
    }));
  }

  async getIncidentDetails(_organizationId?: string): Promise<IncidentDetail[]> {
    return demoIncidents;
  }

  async getBottlenecks(_organizationId?: string): Promise<Bottleneck[]> {
    return demoBottlenecks;
  }

  async getCapacityMetrics(_organizationId?: string): Promise<CapacityMetric[]> {
    return demoCapacityMetrics;
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

export const operationsRepository = new MockOperationsRepository();
