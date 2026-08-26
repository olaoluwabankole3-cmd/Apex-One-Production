import { ValueOpportunity, LeakageEvent, CustomerValueMetric, CapacityMetric, ExecutionPlay, CapturedLedgerEntry } from "@/components/value-engine/ValueEngineContext";
import {
  demoValueOpportunities,
  demoLeakageSources,
  demoCustomerValueMetrics,
  demoCapacityCategories,
  demoExecutionPlays,
  demoCapturedValueEvents
} from "@/lib/data/demo";

export interface ValueRepository {
  getOpportunities(organizationId?: string): Promise<ValueOpportunity[]>;
  getLeakageEvents(organizationId?: string): Promise<LeakageEvent[]>;
  getCustomerValues(organizationId?: string): Promise<CustomerValueMetric[]>;
  getCapacityMetrics(organizationId?: string): Promise<CapacityMetric[]>;
  getPlays(organizationId?: string): Promise<ExecutionPlay[]>;
  getCapturedLedger(organizationId?: string): Promise<CapturedLedgerEntry[]>;
}

export class MockValueRepository implements ValueRepository {
  async getOpportunities(_organizationId?: string): Promise<ValueOpportunity[]> {
    return demoValueOpportunities.map(o => ({
      id: o.id,
      title: o.title,
      category: o.category,
      description: o.description,
      sourceSystem: o.sourceSystem,
      valueAmount: o.valueAmount,
      status: o.status,
      confidence: o.confidence,
      probability: o.probability,
      businessReason: o.businessReason,
      recommendedAction: o.recommendedAction,
      responsibleDepartment: o.responsibleDepartment,
      expectedCaptureDate: o.expectedCaptureDate,
      impactTier: o.impactTier,
    }));
  }

  async getLeakageEvents(_organizationId?: string): Promise<LeakageEvent[]> {
    return demoLeakageSources.map(l => ({
      id: l.id,
      title: l.title,
      description: l.rootCause,
      category: l.category,
      leakAmount: l.estimatedValue,
      occurrence: "Recurring Monthly",
      riskScore: l.confidence,
      status: l.status,
      systemAffected: l.systemAffected,
      recommendedAction: l.recoveryAction,
    }));
  }

  async getCustomerValues(_organizationId?: string): Promise<CustomerValueMetric[]> {
    return demoCustomerValueMetrics.map(c => ({
      id: c.id,
      name: c.name,
      tier: c.tier,
      contractValue: c.currentRevenue,
      potentialValue: c.potentialValue,
      expansionOpportunity: c.expansionPotential,
      confidence: c.retentionProbability,
      recommended: c.aiRecommendationText,
      churnRisk: c.riskIndex > 7 ? "High" : c.riskIndex > 3 ? "Medium" : "Low",
      lastAuditDate: "2026-08-15",
    }));
  }

  async getCapacityMetrics(_organizationId?: string): Promise<CapacityMetric[]> {
    return demoCapacityCategories.map(cap => ({
      name: cap.name,
      allocated: 100,
      utilized: cap.utilized,
      wasteValue: cap.wasteValue,
      department: cap.name,
      unusedHours: cap.unused * 10,
      potentialBillableHours: (cap.unused * 10) * 0.8,
    }));
  }

  async getPlays(_organizationId?: string): Promise<ExecutionPlay[]> {
    return demoExecutionPlays.map(p => ({
      id: p.id,
      title: p.recommendation,
      description: p.insightSource,
      targetId: p.id,
      type: "opportunity",
      estimatedGain: p.expectedValue,
      status: p.status === "Completed" ? "completed" : p.status === "In Progress" ? "in_progress" : "available",
      stepsCompleted: p.status === "Completed" ? 3 : p.status === "In Progress" ? 1 : 0,
      totalSteps: 3,
      logs: p.logs,
    }));
  }

  async getCapturedLedger(_organizationId?: string): Promise<CapturedLedgerEntry[]> {
    return demoCapturedValueEvents.map(c => ({
      id: c.id,
      date: c.realizationDate,
      playTitle: c.opportunity,
      category: c.category,
      amountCaptured: c.capturedValue,
      impactMetrics: c.evidenceDescription,
      verifiedBy: c.verifiedBy,
    }));
  }
}

export const valueRepository = new MockValueRepository();
