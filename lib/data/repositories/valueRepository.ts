import { ValueOpportunity, LeakageEvent, CustomerValueMetric, CapacityMetric, ExecutionPlay, CapturedLedgerEntry, PipelineStatus } from "@/components/value-engine/ValueEngineContext";
import { apiClient } from "@/lib/apiClient";
import { ValueOpportunityRecord, ValueCapturedRecord, ActionRecord, CustomerRecord } from "@/lib/backend/database/schema";
import { collectAllCollectionData } from "./httpCollection";

export interface ValueRepository {
  getOpportunities(organizationId?: string): Promise<ValueOpportunity[]>;
  getLeakageEvents(organizationId?: string): Promise<LeakageEvent[]>;
  getCustomerValues(organizationId?: string): Promise<CustomerValueMetric[]>;
  getCapacityMetrics(organizationId?: string): Promise<CapacityMetric[]>;
  getPlays(organizationId?: string): Promise<ExecutionPlay[]>;
  getCapturedLedger(organizationId?: string): Promise<CapturedLedgerEntry[]>;
  advanceAction(id: string): Promise<ActionRecord>;
}

export class ApiValueRepository implements ValueRepository {
  async getOpportunities(_organizationId?: string): Promise<ValueOpportunity[]> {
    const records = await collectAllCollectionData<ValueOpportunityRecord>("/api/v1/value/opportunities");
    const statusMap: Record<string, PipelineStatus> = {
      Identified: "discovered",
      Validated: "validated",
      Approved: "in_execution",
      Executing: "in_execution",
      Captured: "captured",
    };

    return records.map((o) => ({
      id: o.id,
      title: o.title,
      category: o.category,
      description: o.evidence || o.expectedOutcome || "AI identified potential value optimization.",
      sourceSystem: o.sourceEntityType || "System Telemetry",
      valueAmount: o.potentialValue,
      status: statusMap[o.status] || "discovered",
      confidence: o.confidence,
      probability: o.confidence,
      businessReason: o.evidence || o.expectedOutcome || "Strategic optimization opportunity.",
      recommendedAction: o.recommendedAction,
      responsibleDepartment: o.sourceEntityType ? `${o.sourceEntityType} Operations` : "Strategic Operations",
      expectedCaptureDate: "2026-Q3",
      impactTier: (o.strategicImportance || "High") as "High" | "Medium" | "Low",
    }));
  }

  async getLeakageEvents(_organizationId?: string): Promise<LeakageEvent[]> {
    const opportunities = await this.getOpportunities();
    return opportunities
      .filter((o) => o.category === "Revenue recovery" || o.category === "Contract optimization" || o.category === "Process optimization")
      .map((l) => ({
        id: l.id,
        title: l.title,
        description: l.businessReason,
        category: l.category,
        leakAmount: l.valueAmount,
        occurrence: "Recurring Monthly",
        riskScore: l.confidence,
        status: (l.status === "captured" ? "plugged" : l.status === "in_execution" ? "monitoring" : "unplugged") as "unplugged" | "monitoring" | "plugged",
        systemAffected: l.sourceSystem,
        recommendedAction: l.recommendedAction,
      }));
  }

  async getCustomerValues(_organizationId?: string): Promise<CustomerValueMetric[]> {
    const records = await collectAllCollectionData<CustomerRecord>("/api/v1/customers");
    return records.map((c) => {
      const isAtRisk = c.status === "at-risk" || c.healthScore < 70;
      const currentRev = c.arr;

      return {
        id: c.id,
        name: c.name,
        tier: c.tier,
        contractValue: currentRev,
        potentialValue: currentRev,
        expansionOpportunity: 0,
        confidence: c.healthScore,
        recommended: isAtRisk
          ? "Review account churn signals and SLA compliance."
          : "Account operating within normal health parameters.",
        churnRisk: (isAtRisk ? "High" : c.healthScore < 85 ? "Medium" : "Low") as "High" | "Medium" | "Low",
        lastAuditDate: new Date(c.updatedAt || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      };
    });
  }

  async getCapacityMetrics(_organizationId?: string): Promise<CapacityMetric[]> {
    // BACKEND CAPABILITY REQUIRED: People, Tech, and Capital utilization telemetry service.
    return [];
  }

  async getPlays(_organizationId?: string): Promise<ExecutionPlay[]> {
    const records = await collectAllCollectionData<ActionRecord>("/api/v1/actions");
    return records.map((p) => ({
      id: p.id,
      title: p.recommendation,
      description: p.decisionDetail || p.insightSource || "Action item",
      targetId: p.id,
      type: "opportunity" as const,
      estimatedGain: p.expectedValue,
      status: p.status === "Completed" || p.status === "Measured" ? "completed" : p.status === "In Progress" ? "in_progress" : "available",
      stepsCompleted: p.status === "Completed" || p.status === "Measured" ? 3 : p.status === "In Progress" ? 1 : 0,
      totalSteps: 3,
      logs: p.logs || [`Action initialized: ${p.recommendation}`],
    }));
  }

  async getCapturedLedger(_organizationId?: string): Promise<CapturedLedgerEntry[]> {
    const records = await collectAllCollectionData<ValueCapturedRecord>("/api/v1/value/captured");
    return records.map((c) => ({
      id: c.id,
      date: c.realizationDate,
      playTitle: c.opportunityTitle || "Captured Value Record",
      category: c.category,
      amountCaptured: c.capturedValue,
      impactMetrics: c.evidenceDescription,
      recordedBy: c.recordedBy,
    }));
  }

  async advanceAction(id: string): Promise<ActionRecord> {
    return apiClient.postData<ActionRecord>(`/api/v1/actions/${id}/advance`);
  }
}

export const valueRepository = new ApiValueRepository();
