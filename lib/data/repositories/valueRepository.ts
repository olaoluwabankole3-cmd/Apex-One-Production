import {
  ValueOpportunity,
  LeakageEvent,
  CustomerValueMetric,
  CapacityMetric,
  ExecutionPlay,
  CapturedLedgerEntry,
  PipelineStatus,
} from "@/components/value-engine/ValueEngineContext";
import { apiClient } from "@/lib/apiClient";
import {
  ValueOpportunityRecord,
  ValueCapturedRecord,
  ActionRecord,
  CustomerRecord,
} from "@/lib/backend/database/schema";
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
    const records =
      await collectAllCollectionData<ValueOpportunityRecord>("/api/v1/value/opportunities");
    const statusMap: Record<string, PipelineStatus> = {
      Identified: "discovered",
      Validated: "validated",
      Approved: "in_execution",
      Executing: "in_execution",
      Captured: "captured",
    };

    return records.map((record) => ({
      id: record.id,
      title: record.title,
      category: record.category,
      description:
        record.evidence || record.expectedOutcome || "No evidence summary recorded.",
      sourceSystem: record.sourceEntityType || "Not specified",
      valueAmount: record.potentialValue,
      status: statusMap[record.status] || "discovered",
      confidence: record.confidence,
      // The current backend record has confidence but no separate probability field.
      probability: 0,
      businessReason:
        record.evidence || record.expectedOutcome || "No business rationale recorded.",
      recommendedAction: record.recommendedAction,
      responsibleDepartment: "Unassigned",
      expectedCaptureDate: "Not recorded",
      impactTier: record.strategicImportance,
    }));
  }

  async getLeakageEvents(_organizationId?: string): Promise<LeakageEvent[]> {
    const opportunities = await this.getOpportunities();
    return opportunities
      .filter((opportunity) =>
        ["Revenue recovery", "Contract optimization", "Process optimization"].includes(
          opportunity.category
        )
      )
      .map((record) => ({
        id: record.id,
        title: record.title,
        description: record.businessReason,
        category: record.category,
        leakAmount: record.valueAmount,
        occurrence: "Not recorded",
        riskScore: record.confidence,
        status:
          record.status === "captured"
            ? "plugged"
            : record.status === "in_execution"
              ? "monitoring"
              : "unplugged",
        systemAffected: record.sourceSystem,
        recommendedAction: record.recommendedAction,
      }));
  }

  async getCustomerValues(_organizationId?: string): Promise<CustomerValueMetric[]> {
    const records = await collectAllCollectionData<CustomerRecord>("/api/v1/customers");
    return records.map((customer) => {
      const isAtRisk = customer.status === "at-risk" || customer.healthScore < 70;
      return {
        id: customer.id,
        name: customer.name,
        tier: customer.tier,
        contractValue: customer.arr,
        // No separate potential-value source exists in the current customer contract.
        potentialValue: 0,
        expansionOpportunity: customer.opportunityNaira || 0,
        // Legacy field name retained; value is the authoritative customer health score.
        confidence: customer.healthScore,
        recommended: customer.recommendedAction || "No recommended action recorded.",
        churnRisk: (isAtRisk
          ? "High"
          : customer.healthScore < 85
            ? "Medium"
            : "Low") as "High" | "Medium" | "Low",
        lastAuditDate: new Date(customer.updatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      };
    });
  }

  async getCapacityMetrics(_organizationId?: string): Promise<CapacityMetric[]> {
    // BACKEND CAPABILITY REQUIRED: utilization telemetry service.
    return [];
  }

  async getPlays(_organizationId?: string): Promise<ExecutionPlay[]> {
    const records = await collectAllCollectionData<ActionRecord>("/api/v1/actions");
    return records.map((record) => ({
      id: record.id,
      title: record.recommendation,
      description:
        record.decisionDetail || record.insightSource || "No decision detail recorded.",
      targetId: record.id,
      type: "opportunity" as const,
      estimatedGain: record.expectedValue,
      status:
        record.status === "Completed" || record.status === "Measured"
          ? "completed"
          : record.status === "In Progress"
            ? "in_progress"
            : "available",
      stepsCompleted: 0,
      totalSteps: 0,
      logs: record.logs || [],
    }));
  }

  async getCapturedLedger(
    _organizationId?: string
  ): Promise<CapturedLedgerEntry[]> {
    const records =
      await collectAllCollectionData<ValueCapturedRecord>("/api/v1/value/captured");
    return records.map((record) => ({
      id: record.id,
      date: record.realizationDate,
      playTitle: record.opportunityTitle || "Captured value record",
      category: record.category,
      amountCaptured: record.capturedValue,
      impactMetrics: record.evidenceDescription,
    }));
  }

  async advanceAction(id: string): Promise<ActionRecord> {
    return apiClient.postData<ActionRecord>(`/api/v1/actions/${id}/advance`);
  }
}

export const valueRepository = new ApiValueRepository();
