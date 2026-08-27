import { ValueOpportunity, LeakageEvent, CustomerValueMetric, CapacityMetric, ExecutionPlay, CapturedLedgerEntry, PipelineStatus } from "@/components/value-engine/ValueEngineContext";
import { apiClient } from "@/lib/apiClient";
import { ValueOpportunityRecord, ValueCapturedRecord, ActionRecord, CustomerRecord } from "@/lib/backend/database/schema";

export interface ValueRepository {
  getOpportunities(organizationId?: string): Promise<ValueOpportunity[]>;
  getLeakageEvents(organizationId?: string): Promise<LeakageEvent[]>;
  getCustomerValues(organizationId?: string): Promise<CustomerValueMetric[]>;
  getCapacityMetrics(organizationId?: string): Promise<CapacityMetric[]>;
  getPlays(organizationId?: string): Promise<ExecutionPlay[]>;
  getCapturedLedger(organizationId?: string): Promise<CapturedLedgerEntry[]>;
  advanceAction(id: string): Promise<any>;
}

export class ApiValueRepository implements ValueRepository {
  async getOpportunities(_organizationId?: string): Promise<ValueOpportunity[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: ValueOpportunityRecord[] }>("/api/v1/value/opportunities");
      if (res && Array.isArray(res.data)) {
        const statusMap: Record<string, PipelineStatus> = {
          Identified: "discovered",
          Validated: "validated",
          Approved: "in_execution",
          Executing: "in_execution",
          Captured: "captured",
        };

        return res.data.map(o => ({
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
      return [];
    } catch (err) {
      console.error("Failed to fetch opportunities from API:", err);
      return [];
    }
  }

  async getLeakageEvents(_organizationId?: string): Promise<LeakageEvent[]> {
    try {
      const opps = await this.getOpportunities();
      return opps
        .filter(o => o.category === "Revenue recovery" || o.category === "Contract optimization" || o.category === "Process optimization")
        .map(l => ({
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
    } catch (err) {
      console.error("Failed to fetch leakage events:", err);
      return [];
    }
  }

  async getCustomerValues(_organizationId?: string): Promise<CustomerValueMetric[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: CustomerRecord[] }>("/api/v1/customers");
      if (res && Array.isArray(res.data)) {
        return res.data.map(c => {
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
      return [];
    } catch (err) {
      console.error("Failed to fetch customer value metrics:", err);
      return [];
    }
  }

  async getCapacityMetrics(_organizationId?: string): Promise<CapacityMetric[]> {
    // BACKEND CAPABILITY REQUIRED: People, Tech, and Capital utilization telemetry service
    return [];
  }

  async getPlays(_organizationId?: string): Promise<ExecutionPlay[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: ActionRecord[] }>("/api/v1/actions");
      if (res && Array.isArray(res.data)) {
        return res.data.map(p => ({
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
      return [];
    } catch (err) {
      console.error("Failed to fetch execution plays from API:", err);
      return [];
    }
  }

  async getCapturedLedger(_organizationId?: string): Promise<CapturedLedgerEntry[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: ValueCapturedRecord[] }>("/api/v1/value/captured");
      if (res && Array.isArray(res.data)) {
        return res.data.map(c => ({
          id: c.id,
          date: c.realizationDate,
          playTitle: c.opportunityTitle || "Captured Value Record",
          category: c.category,
          amountCaptured: c.capturedValue,
          impactMetrics: c.evidenceDescription,
          verifiedBy: c.certifiedBy,
        }));
      }
      return [];
    } catch (err) {
      console.error("Failed to fetch captured ledger from API:", err);
      return [];
    }
  }

  async advanceAction(id: string): Promise<any> {
    return apiClient.post(`/api/v1/actions/${id}/advance`);
  }
}

export const valueRepository = new ApiValueRepository();

