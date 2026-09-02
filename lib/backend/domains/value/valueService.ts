/**
 * APEX ONE — Value Intelligence Domain Service & Evidence Engine
 *
 * Computes live, source-backed value metrics from tenant data entities.
 * Strictly adheres to: Source -> Calculation -> Result -> Provenance -> Decision State.
 * Record presence, confidence, verification, and certification are distinct concepts.
 */

import { DatabaseStore } from "../../database/store";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { ValueOpportunityRecord, ValueCapturedRecord } from "../../database/schema";
import { PaginatedResult, MAX_PAGE_SIZE } from "../../database/querySpecification";
import { collectAllPages } from "../../database/paginationTraversal";
import { TenantContext, requirePermission } from "../../core/security";
import { EvidenceService } from "../evidence/evidenceService";

export interface ValueEvidenceChain {
  metricId: string;
  label: string;
  value: number;
  calculationMethod: string;
  sourceRecords: { type: string; id: string; name?: string; amount?: number }[];
  evidence: string;
  confidence: number;
  timestamp: string;
}

export interface ValueSummaryDto {
  potentialValueIdentified: ValueEvidenceChain;
  revenueLeakageTotal: ValueEvidenceChain;
  unusedCapacityValue: ValueEvidenceChain;
  recordedValueCaptured: ValueEvidenceChain;
  verifiedValueCaptured: ValueEvidenceChain;
  certifiedValueCaptured: ValueEvidenceChain;
  realizationEfficiencyRate: number;
  vectors: { label: string; value: number; count: number; color?: string }[];
  journeyPipeline: {
    identified: number;
    validated: number;
    approved: number;
    executing: number;
    captured: number;
  };
  tenantBaselineSummary: {
    activeCustomersCount: number;
    totalArr: number;
    activeContractsValue: number;
    recordedTransactionsRevenue: number;
    recordedTransactionsCost: number;
  };
}

export interface ScenarioSimulationResult {
  baselineRevenue: number;
  baselineCosts: number;
  projectedRevenue: number;
  projectedCosts: number;
  projectedGain: number;
  currency: string;
  currencySymbol: string;
  calculationEvidence: string;
  confidence: number;
  parametersEvaluated: {
    pricingDeltaPct: number;
    retentionRatePct: number;
    headcountPct: number;
    automationPct: number;
    salesConversionPct: number;
    profile?: string;
  };
}

export interface ValueOpportunityListOptions {
  category?: string;
  status?: string;
  limit?: number;
  cursor?: string | null;
}

export interface ValueCapturedListOptions {
  limit?: number;
  cursor?: string | null;
}

export class ValueService {
  private readonly evidenceService: EvidenceService;

  constructor(private readonly database: DatabaseStore = createApplicationInfrastructure().database) {
    this.evidenceService = new EvidenceService(database);
  }

  public async getSummary(ctx: TenantContext): Promise<ValueSummaryDto> {
    requirePermission(ctx, "value:read");
    const now = new Date().toISOString();

    const [opps, captured, customers, contracts, signals, txnTotals] = await Promise.all([
      collectAllPages<ValueOpportunityRecord>((cursor) =>
        this.database.opportunitiesRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })
      ),
      collectAllPages<ValueCapturedRecord>((cursor) =>
        this.database.valueCapturedRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })
      ),
      collectAllPages((cursor) =>
        this.database.customersRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })
      ),
      collectAllPages((cursor) =>
        this.database.contractsRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })
      ),
      collectAllPages((cursor) =>
        this.database.signalsRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })
      ),
      this.database.transactionsRepo.calculateFinancialTotals(ctx),
    ]);

    const capturedWithEvidence = await Promise.all(
      captured.map(async (record) => ({
        record,
        state: await this.evidenceService.getStatus("ValueCaptured", record.id, ctx),
      }))
    );
    const canonicallyVerifiedCaptured = capturedWithEvidence
      .filter(({ state }) => state.verificationState === "verified")
      .map(({ record }) => record);
    const currentlyCertifiedCaptured = capturedWithEvidence
      .filter(({ state }) => state.certificationState === "certified")
      .map(({ record }) => record);

    const totalArr = customers.reduce((sum, c) => sum + (c.arr || 0), 0);
    const activeContractsValue = contracts
      .filter((c) => c.status === "active" || c.status === "expiring_soon")
      .reduce((sum, c) => sum + (c.contractValue || 0), 0);
    const recordedRevenue = txnTotals.totalRevenue ?? 0;
    const recordedCosts = txnTotals.totalCosts ?? 0;

    const activeOpps = opps.filter((o) => o.status !== "Captured");
    const potentialValueTotal = activeOpps.reduce((sum, o) => sum + o.potentialValue, 0);
    const potentialValueIdentified: ValueEvidenceChain = {
      metricId: "potential_value_identified",
      label: "Potential Value Identified",
      value: potentialValueTotal,
      calculationMethod: "SUM(ValueOpportunity.potentialValue WHERE status != 'Captured')",
      sourceRecords: activeOpps.map((o) => ({
        type: "ValueOpportunity",
        id: o.id,
        name: o.title,
        amount: o.potentialValue,
      })),
      evidence:
        activeOpps.length > 0
          ? `Aggregated ${activeOpps.length} recorded value discovery opportunities across monitored operational vectors.`
          : "No active value discovery opportunities are currently recorded for this organization.",
      confidence:
        activeOpps.length > 0
          ? Math.round(activeOpps.reduce((s, o) => s + o.confidence, 0) / activeOpps.length)
          : 100,
      timestamp: now,
    };

    const revenueSignals = signals.filter((s) => s.category === "revenue" && s.status === "active");
    const unindexedContracts = contracts.filter((c) => !c.volatilityIndexationClause && c.status === "active");
    const signalLeakage = revenueSignals.reduce((sum, s) => sum + s.estimatedFinancialImpact, 0);
    const contractLeakageRisk = unindexedContracts.reduce(
      (sum, c) => sum + Math.round(c.contractValue * 0.12),
      0
    );
    const totalLeakage = signalLeakage + contractLeakageRisk;

    const leakageSources = [
      ...revenueSignals.map((s) => ({
        type: "Signal",
        id: s.id,
        name: s.title,
        amount: s.estimatedFinancialImpact,
      })),
      ...unindexedContracts.map((c) => ({
        type: "Contract",
        id: c.id,
        name: `Unindexed Risk: ${c.title}`,
        amount: Math.round(c.contractValue * 0.12),
      })),
    ];

    const revenueLeakageTotal: ValueEvidenceChain = {
      metricId: "revenue_leakage_total",
      label: "Revenue Leakage Total",
      value: totalLeakage,
      calculationMethod:
        "SUM(Signal.estimatedImpact WHERE category='revenue') + SUM(Contract.value * 0.12 WHERE !volatilityIndexationClause)",
      sourceRecords: leakageSources,
      evidence:
        leakageSources.length > 0
          ? `Derived from ${revenueSignals.length} active telemetry revenue signals and ${unindexedContracts.length} unindexed contract exposure records.`
          : "Zero active revenue leakage source records were found across telemetry feeds.",
      confidence: leakageSources.length > 0 ? 91 : 100,
      timestamp: now,
    };

    const capacitySignals = signals.filter((s) => s.category === "capacity" && s.status === "active");
    const totalCapacityWaste = capacitySignals.reduce((sum, s) => sum + s.estimatedFinancialImpact, 0);
    const unusedCapacityValue: ValueEvidenceChain = {
      metricId: "unused_capacity_value",
      label: "Unused Capacity Waste",
      value: totalCapacityWaste,
      calculationMethod: "SUM(Signal.estimatedImpact WHERE category='capacity' AND status='active')",
      sourceRecords: capacitySignals.map((s) => ({
        type: "Signal",
        id: s.id,
        name: s.title,
        amount: s.estimatedFinancialImpact,
      })),
      evidence:
        capacitySignals.length > 0
          ? `Computed from ${capacitySignals.length} active infrastructure and operational underutilization source records.`
          : "No capacity underutilization source records were detected.",
      confidence: capacitySignals.length > 0 ? 88 : 100,
      timestamp: now,
    };

    const totalRecordedCaptured = captured.reduce((sum, c) => sum + c.capturedValue, 0);
    const totalVerifiedCaptured = canonicallyVerifiedCaptured.reduce((sum, c) => sum + c.capturedValue, 0);
    const totalCertifiedCaptured = currentlyCertifiedCaptured.reduce((sum, c) => sum + c.capturedValue, 0);

    const recordedValueCaptured: ValueEvidenceChain = {
      metricId: "recorded_value_captured",
      label: "Recorded Value Captured",
      value: totalRecordedCaptured,
      calculationMethod: "SUM(ValueCaptured.capturedValue)",
      sourceRecords: captured.map((c) => ({
        type: "ValueCaptured",
        id: c.id,
        name: c.opportunityTitle,
        amount: c.capturedValue,
      })),
      evidence:
        captured.length > 0
          ? `Aggregated ${captured.length} recorded value-capture ledger entries. Record presence alone does not imply verification or certification.`
          : "No value-capture ledger entries are currently recorded for this organization.",
      confidence: 100,
      timestamp: now,
    };

    const verifiedValueCaptured: ValueEvidenceChain = {
      metricId: "verified_value_captured",
      label: "Verified Value Captured",
      value: totalVerifiedCaptured,
      calculationMethod: "SUM(ValueCaptured.capturedValue WHERE canonical verificationState = 'verified')",
      sourceRecords: canonicallyVerifiedCaptured.map((c) => ({
        type: "ValueCaptured",
        id: c.id,
        name: c.opportunityTitle,
        amount: c.capturedValue,
      })),
      evidence:
        canonicallyVerifiedCaptured.length > 0
          ? `${canonicallyVerifiedCaptured.length} of ${captured.length} recorded value captures currently have a canonical verified decision backed by provenance.`
          : "No recorded value captures currently have canonical verified state.",
      confidence: 100,
      timestamp: now,
    };

    const certifiedValueCaptured: ValueEvidenceChain = {
      metricId: "certified_value_captured",
      label: "Certified Value Captured",
      value: totalCertifiedCaptured,
      calculationMethod: "SUM(ValueCaptured.capturedValue WHERE canonical certificationState = 'certified')",
      sourceRecords: currentlyCertifiedCaptured.map((c) => ({
        type: "ValueCaptured",
        id: c.id,
        name: c.opportunityTitle,
        amount: c.capturedValue,
      })),
      evidence:
        currentlyCertifiedCaptured.length > 0
          ? `${currentlyCertifiedCaptured.length} of ${captured.length} recorded value captures currently have canonical certification based on the current verified decision.`
          : "No recorded value captures currently have active canonical certification.",
      confidence: 100,
      timestamp: now,
    };

    const categories = [
      { key: "Revenue recovery", label: "Revenue Recovery", color: "text-gold" },
      { key: "Customer expansion", label: "Customer Expansion", color: "text-emerald" },
      { key: "Contract optimization", label: "Contract Optimization", color: "text-red-400" },
      { key: "Process optimization", label: "Process & Capacity", color: "text-purple-400" },
      { key: "Dormant customers", label: "Dormant Re-activation", color: "text-blue-400" },
      { key: "Capacity utilization", label: "Capacity Allocation", color: "text-amber-400" },
    ];

    const vectors = categories
      .map((cat) => {
        const catOpps = opps.filter((o) => o.category === cat.key);
        const val = catOpps.reduce((sum, o) => sum + o.potentialValue, 0);
        return { label: cat.label, value: val, count: catOpps.length, color: cat.color };
      })
      .filter((v) => v.value > 0 || opps.length === 0);

    const finalVectors =
      vectors.length > 0
        ? vectors
        : [
            { label: "Revenue Recovery", value: 0, count: 0, color: "text-gold" },
            { label: "Customer Expansion", value: 0, count: 0, color: "text-emerald" },
            { label: "Contract Optimization", value: 0, count: 0, color: "text-red-400" },
            { label: "Process & Capacity", value: 0, count: 0, color: "text-purple-400" },
          ];

    const journeyPipeline = {
      identified: opps.filter((o) => o.status === "Identified").reduce((s, o) => s + o.potentialValue, 0),
      validated: opps.filter((o) => o.status === "Validated").reduce((s, o) => s + o.potentialValue, 0),
      approved: opps.filter((o) => o.status === "Approved").reduce((s, o) => s + o.potentialValue, 0),
      executing: opps.filter((o) => o.status === "Executing").reduce((s, o) => s + o.potentialValue, 0),
      captured: totalRecordedCaptured,
    };

    const totalPipelineValue =
      journeyPipeline.identified +
      journeyPipeline.validated +
      journeyPipeline.approved +
      journeyPipeline.executing +
      totalRecordedCaptured;

    const realizationEfficiencyRate =
      totalPipelineValue > 0 ? Math.round((totalRecordedCaptured / totalPipelineValue) * 100 * 10) / 10 : 0;

    return {
      potentialValueIdentified,
      revenueLeakageTotal,
      unusedCapacityValue,
      recordedValueCaptured,
      verifiedValueCaptured,
      certifiedValueCaptured,
      realizationEfficiencyRate,
      vectors: finalVectors,
      journeyPipeline,
      tenantBaselineSummary: {
        activeCustomersCount: customers.length,
        totalArr,
        activeContractsValue,
        recordedTransactionsRevenue: recordedRevenue,
        recordedTransactionsCost: recordedCosts,
      },
    };
  }

  public async getOpportunities(
    ctx: TenantContext,
    filters?: ValueOpportunityListOptions
  ): Promise<PaginatedResult<ValueOpportunityRecord>> {
    requirePermission(ctx, "value:read");
    return this.database.opportunitiesRepo.findMany(ctx, {
      where: {
        category:
          filters?.category && filters.category !== "all"
            ? (filters.category as any)
            : undefined,
        status:
          filters?.status && filters.status !== "all"
            ? (filters.status as any)
            : undefined,
      },
      limit: filters?.limit,
      cursor: filters?.cursor,
    });
  }

  public async getOpportunityById(id: string, ctx: TenantContext): Promise<ValueOpportunityRecord> {
    requirePermission(ctx, "value:read");
    return this.database.opportunitiesRepo.findById(id, ctx, "ValueOpportunity");
  }

  public async getCapturedLedger(
    ctx: TenantContext,
    options?: ValueCapturedListOptions
  ): Promise<PaginatedResult<ValueCapturedRecord>> {
    requirePermission(ctx, "value:read");
    return this.database.valueCapturedRepo.findMany(ctx, {
      limit: options?.limit,
      cursor: options?.cursor,
    });
  }

  public async simulateScenario(
    params: {
      pricingDeltaPct: number;
      retentionRatePct: number;
      headcountPct: number;
      automationPct: number;
      salesConversionPct: number;
      profile?: "Conservative" | "Expected" | "Aggressive";
    },
    ctx: TenantContext
  ): Promise<ScenarioSimulationResult> {
    requirePermission(ctx, "value:read");

    const [customers, contracts, txnTotals] = await Promise.all([
      collectAllPages((cursor) =>
        this.database.customersRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })
      ),
      collectAllPages((cursor) =>
        this.database.contractsRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })
      ),
      this.database.transactionsRepo.calculateFinancialTotals(ctx),
    ]);

    const org = await this.database.findOrganizationById(ctx.organizationId);
    const currency = org?.currency || txnTotals.currency || "NGN";
    const currencySymbol = org?.currencySymbol || (currency === "USD" ? "$" : "₦");

    const arrSum = customers.reduce((sum, c) => sum + (c.arr || 0), 0);
    const contractSum = contracts.reduce((sum, c) => sum + (c.contractValue || 0), 0);
    const clearedRevenue = txnTotals.totalRevenue ?? 0;
    const clearedCosts = txnTotals.totalCosts ?? 0;

    const baseRevenue = arrSum > 0 ? arrSum : contractSum > 0 ? contractSum : clearedRevenue;
    const baseCosts = clearedCosts > 0 ? clearedCosts : Math.round(baseRevenue * 0.65);

    if (baseRevenue === 0) {
      return {
        baselineRevenue: 0,
        baselineCosts: 0,
        projectedRevenue: 0,
        projectedCosts: 0,
        projectedGain: 0,
        currency,
        currencySymbol,
        calculationEvidence: "Organization baseline is currently 0. Add customers or contracts to compute live financial simulations.",
        confidence: 100,
        parametersEvaluated: params,
      };
    }

    const mult = params.profile === "Aggressive" ? 1.15 : params.profile === "Conservative" ? 0.85 : 1.0;
    const pricingFactor = 1 + params.pricingDeltaPct / 100;
    const retentionFactor = params.retentionRatePct / 100;
    const conversionFactor = 1 + params.salesConversionPct / 200;

    const calculatedRevenue = Math.round(baseRevenue * pricingFactor * retentionFactor * conversionFactor * mult);
    const calculatedCosts = Math.round(baseCosts * (params.headcountPct / 100) * (1 - params.automationPct / 400));
    const projectedGain = calculatedRevenue - calculatedCosts - (baseRevenue - baseCosts);

    const evidence = `Computed simulation using tenant dynamic baseline of ${customers.length} customer accounts (ARR: ${currencySymbol}${baseRevenue.toLocaleString()}) and operating baseline (Costs: ${currencySymbol}${baseCosts.toLocaleString()}). This is a modeled scenario, not a verification or certification decision.`;

    return {
      baselineRevenue: baseRevenue,
      baselineCosts: baseCosts,
      projectedRevenue: calculatedRevenue,
      projectedCosts: calculatedCosts,
      projectedGain,
      currency,
      currencySymbol,
      calculationEvidence: evidence,
      confidence: 92,
      parametersEvaluated: params,
    };
  }
}

export const valueService = new ValueService();
