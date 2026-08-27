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

export class ApiOperationsRepository implements OperationsRepository {
  async getSubsidiaryOps(_organizationId?: string): Promise<SubsidiaryOps[]> {
    return [
      { subsidiary: "Strategic Accounts", openIncidents: 0, slaCompliance: 99.8, reconciliationStatus: "complete", avgResolutionHours: 1.2, automationCoverage: 88, trend: [98, 99, 99, 99.8] },
      { subsidiary: "Enterprise Operations", openIncidents: 1, slaCompliance: 97.4, reconciliationStatus: "complete", avgResolutionHours: 2.4, automationCoverage: 74, trend: [96, 97, 97, 97.4] },
      { subsidiary: "Commercial Operations", openIncidents: 1, slaCompliance: 96.2, reconciliationStatus: "pending", avgResolutionHours: 3.1, automationCoverage: 81, trend: [95, 95, 96, 96.2] },
      { subsidiary: "Customer Operations", openIncidents: 0, slaCompliance: 99.1, reconciliationStatus: "complete", avgResolutionHours: 0.8, automationCoverage: 92, trend: [98, 98, 99, 99.1] },
    ];
  }

  async getIncidents(_organizationId?: string): Promise<Incident[]> {
    return [
      {
        id: "inc-1",
        subsidiary: "Enterprise Operations",
        title: "AML Document Parsing Queue Latency Warning",
        severity: "medium",
        status: "investigating",
        opened: "Aug 18, 2026",
        owner: "Marcus Webb"
      },
      {
        id: "inc-2",
        subsidiary: "Commercial Operations",
        title: "Credit Overdraft Threshold Spike Flagged",
        severity: "high",
        status: "investigating",
        opened: "Aug 17, 2026",
        owner: "Elena Cho"
      }
    ];
  }

  async getIncidentDetails(_organizationId?: string): Promise<IncidentDetail[]> {
    return [
      {
        id: "inc-1",
        title: "AML Document Parsing Queue Latency Warning",
        subsidiary: "Enterprise Operations",
        severity: "medium",
        status: "investigating",
        whatHappened: "Document ingestion processing queue elevated above 45s threshold during morning transaction batch.",
        whyItHappened: "Concurrent batch upload from 3 enterprise subsidiaries.",
        systemsInvolved: ["Document Intelligence Engine", "Extraction Worker"],
        whoIsAffected: "Enterprise compliance onboarding team",
        financialImpactNaira: 3.2,
        recommendedAction: "Scale extraction worker concurrency.",
      }
    ];
  }

  async getBottlenecks(_organizationId?: string): Promise<Bottleneck[]> {
    return [
      {
        id: "bot-1",
        department: "Enterprise Operations",
        process: "Manual KYC Re-Verification Desk",
        delayDays: 3,
        cases: 14,
        costImpactNaira: 3.2,
        recommendedAction: "Activate AI-Assisted KYC Screening Playbook",
        status: "optimizing",
      },
      {
        id: "bot-2",
        department: "Commercial Operations",
        process: "Contract Amendment Legal Validation",
        delayDays: 5,
        cases: 8,
        costImpactNaira: 6.8,
        recommendedAction: "Enable Document Intelligence Auto-Extraction",
        status: "stuck",
      }
    ];
  }

  async getCapacityMetrics(_organizationId?: string): Promise<CapacityMetric[]> {
    return [
      { id: "cap-1", category: "People", available: 100, used: 68, unused: 32, overloaded: 0 },
      { id: "cap-2", category: "Technology", available: 100, used: 54, unused: 46, overloaded: 0 },
      { id: "cap-3", category: "Operations", available: 100, used: 74, unused: 26, overloaded: 0 },
    ];
  }

  async getAutomationOpportunities(_organizationId?: string): Promise<AutomationOpportunity[]> {
    return [];
  }

  async getSlaTrend(_organizationId?: string): Promise<SlaPoint[]> {
    return [
      { month: "Jan", compliance: 99.2, target: 99.0 },
      { month: "Feb", compliance: 99.0, target: 99.0 },
      { month: "Mar", compliance: 98.4, target: 99.0 },
      { month: "Apr", compliance: 99.5, target: 99.0 },
      { month: "May", compliance: 98.8, target: 99.0 },
      { month: "Jun", compliance: 99.1, target: 99.0 },
      { month: "Jul", compliance: 99.4, target: 99.0 },
    ];
  }

  async getSubsidiaryPerformance(_organizationId?: string): Promise<SubsidiaryPerformance[]> {
    return [];
  }
}

export const operationsRepository = new ApiOperationsRepository();

