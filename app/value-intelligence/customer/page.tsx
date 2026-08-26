"use client";

import { useState, useMemo } from "react";
import ValueHeader from "@/components/value-engine/ValueHeader";
import GlassCard from "@/components/ui/GlassCard";
import ValueIntelligenceEmptyState from "@/components/value-engine/ValueIntelligenceEmptyState";
import { isDemoMode } from "@/lib/demo";
import {
  Users,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Cpu,
  Layers,
  Activity,
  Heart,
  Calendar,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Clock,
  ArrowRight
} from "lucide-react";
import clsx from "clsx";

interface CustomerProfile {
  id: string;
  name: string;
  category: "High Value / High Potential" | "High Value / Low Risk" | "Low Value / High Potential" | "At Risk" | "Dormant";
  currentRevenue: number;
  potentialValue: number;
  expansionPotential: number;
  renewalValue: number;
  lifetimeValue: number;
  unusedOpportunitiesValue: number;
  purchaseFrequency: string;
  contractHistory: string;
  interactionsCount: number;
  openSupportTickets: number;
  sentimentScore: number; // 0 to 1
  renewalDaysRemaining: number;
  retentionProbability: number; // %
  riskIndex: number; // %
  usageGrowthPercentage: number;
  aiRecommendationText: string;
}

export default function CustomerValueIntelligencePage() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("cust-dangote");
  const [activeMatrixFilter, setActiveMatrixFilter] = useState<string>("all");

  const customers: CustomerProfile[] = useMemo(() => {
    if (!isDemoMode()) return [];
    return [
    {
      id: "cust-dangote",
      name: "Dangote Industrial Consortium",
      category: "High Value / High Potential",
      currentRevenue: 45000000,
      potentialValue: 68500000,
      expansionPotential: 23500000,
      renewalValue: 45000000,
      lifetimeValue: 310500000,
      unusedOpportunitiesValue: 23500000,
      purchaseFrequency: "Every 12 days",
      contractHistory: "Active Multi-Year SLA with Volatility Multipliers",
      interactionsCount: 18,
      openSupportTickets: 1,
      sentimentScore: 0.94,
      renewalDaysRemaining: 45,
      retentionProbability: 97,
      riskIndex: 1.2,
      usageGrowthPercentage: 41,
      aiRecommendationText: "Expansion opportunity detected. Customer usage has increased 41% while contracted capacity has remained unchanged."
    },
    {
      id: "cust-access",
      name: "Access Digital Holdings",
      category: "High Value / Low Risk",
      currentRevenue: 60000000,
      potentialValue: 75000000,
      expansionPotential: 15000000,
      renewalValue: 60000000,
      lifetimeValue: 420000000,
      unusedOpportunitiesValue: 15000000,
      purchaseFrequency: "Every 15 days",
      contractHistory: "SLA Tier 5, Standard Renewal Clause Enabled",
      interactionsCount: 12,
      openSupportTickets: 0,
      sentimentScore: 0.88,
      renewalDaysRemaining: 30,
      retentionProbability: 94,
      riskIndex: 2.5,
      usageGrowthPercentage: 18,
      aiRecommendationText: "SLA capacity contract realignment due. Client settlement volume has expanded by 18% month-over-month."
    },
    {
      id: "cust-oando",
      name: "Oando Energy Networks",
      category: "At Risk",
      currentRevenue: 28000000,
      potentialValue: 38000000,
      expansionPotential: 10000000,
      renewalValue: 28000000,
      lifetimeValue: 180000000,
      unusedOpportunitiesValue: 10000000,
      purchaseFrequency: "Every 30 days",
      contractHistory: "Standard Advisory Retainer, Competitor Squeeze Flagged",
      interactionsCount: 6,
      openSupportTickets: 3,
      sentimentScore: 0.52,
      renewalDaysRemaining: 120,
      retentionProbability: 62,
      riskIndex: 38.0,
      usageGrowthPercentage: -5,
      aiRecommendationText: "Risk mitigation required. Sentiment has declined to 0.52 due to unresolved support tickets. competitors are pitching alternative platforms."
    },
    {
      id: "cust-dormant",
      name: "Dormant Enterprise Account Group",
      category: "Dormant",
      currentRevenue: 0,
      potentialValue: 42300000,
      expansionPotential: 42300000,
      renewalValue: 0,
      lifetimeValue: 120000000,
      unusedOpportunitiesValue: 42300000,
      purchaseFrequency: "Inactive for 137 days",
      contractHistory: "Expired SLA framework agreements",
      interactionsCount: 0,
      openSupportTickets: 0,
      sentimentScore: 0.50,
      renewalDaysRemaining: 0,
      retentionProbability: 25,
      riskIndex: 90.0,
      usageGrowthPercentage: -100,
      aiRecommendationText: "Reactivation campaign active. Targeted outbound suite ready to dispatch to recover active purchasing cycles."
    },
    {
      id: "cust-acme",
      name: "Acme Corporate Systems",
      category: "Low Value / High Potential",
      currentRevenue: 12400000,
      potentialValue: 27800000,
      expansionPotential: 15400000,
      renewalValue: 12400000,
      lifetimeValue: 78000000,
      unusedOpportunitiesValue: 15400000,
      purchaseFrequency: "Every 45 days",
      contractHistory: "Legacy compliance advisory tier flat pricing",
      interactionsCount: 9,
      openSupportTickets: 2,
      sentimentScore: 0.81,
      renewalDaysRemaining: 80,
      retentionProbability: 88,
      riskIndex: 12.0,
      usageGrowthPercentage: 29,
      aiRecommendationText: "Bundled pricing package ready. Compliance queries have expanded by 29% relative to active flat-tier limits."
    }
  ]; }, []);

  // Selected profile memo
  const activeProfile = useMemo(() => {
    if (customers.length === 0) {
      return {
        id: "",
        name: "",
        category: "Dormant" as const,
        currentRevenue: 0,
        potentialValue: 0,
        expansionPotential: 0,
        renewalValue: 0,
        lifetimeValue: 0,
        unusedOpportunitiesValue: 0,
        purchaseFrequency: "",
        contractHistory: "",
        interactionsCount: 0,
        openSupportTickets: 0,
        sentimentScore: 0,
        renewalDaysRemaining: 0,
        retentionProbability: 0,
        riskIndex: 0,
        usageGrowthPercentage: 0,
        aiRecommendationText: ""
      };
    }
    return customers.find(c => c.id === selectedCustomerId) || customers[0];
  }, [selectedCustomerId, customers]);

  // Metric sums
  const aggregateMetrics = useMemo(() => {
    if (customers.length === 0) {
      return {
        potentialValueSum: 0,
        currentRevenueSum: 0,
        expansionSum: 0,
        renewalSum: 0,
        riskSum: 0,
        ltvSum: 0,
        opportunitiesSum: 0
      };
    }
    return {
      potentialValueSum: 94600000, // ₦94.6M
      currentRevenueSum: 145400000,
      expansionSum: 43800000,
      renewalSum: 32100000,
      riskSum: 11500000,
      ltvSum: 410500000,
      opportunitiesSum: 21300000
    };
  }, [customers]);

  // Matrix categories
  const matrixBuckets = [
    { name: "High Value / High Potential", count: customers.filter(c => c.category === "High Value / High Potential").length, color: "text-[#c9a961] bg-[#c9a961]/10 border-[#c9a961]/25" },
    { name: "High Value / Low Risk", count: customers.filter(c => c.category === "High Value / Low Risk").length, color: "text-emerald bg-emerald-500/10 border-emerald-500/20" },
    { name: "Low Value / High Potential", count: customers.filter(c => c.category === "Low Value / High Potential").length, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
    { name: "At Risk", count: customers.filter(c => c.category === "At Risk").length, color: "text-red-400 bg-red-400/10 border-red-500/25 animate-pulse" },
    { name: "Dormant", count: customers.filter(c => c.category === "Dormant").length, color: "text-ivory/50 bg-white/5 border-white/10" }
  ];

  const formatNaira = (val: number) => {
    if (val >= 1000000000) {
      return `₦${(val / 1000000000).toFixed(1)}B`;
    }
    if (val >= 1000000) {
      return `₦${(val / 1000000).toFixed(1)}M`;
    }
    return `₦${val.toLocaleString()}`;
  };

  const filteredCustomers = useMemo(() => {
    if (activeMatrixFilter === "all") return customers;
    return customers.filter(c => c.category === activeMatrixFilter);
  }, [customers, activeMatrixFilter]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12 select-none relative" id="customer-value-workspace">
      
      {/* Background glow shadow */}
      <div className="absolute top-[-40px] right-[15%] w-[450px] h-[450px] bg-gold/[0.02] blur-[120px] rounded-full pointer-events-none z-0" />

      <ValueHeader
        category="CUSTOMER VALUE INTELLIGENCE"
        title="CUSTOMER VALUE INTELLIGENCE"
        subtitle="Calibrate customer relationship bounds using active transactional telemetry and capacity tracking."
      />

      {!isDemoMode() ? (
        <ValueIntelligenceEmptyState
          title="Customer value analysis awaiting customer and revenue data"
          description="Connect customer transactions, CRM contracts, and telemetry streams to calibrate value optimization."
          badge="Customer Engine Offline"
        />
      ) : (
        <>
          {/* CUSTOMER VALUE CORE QUESTION */}
          <div className="rounded-xl border border-gold/15 bg-gold/[0.01] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2.5">
          <Cpu className="text-gold" size={16} />
          <div>
            <p className="text-[12px] font-mono font-bold text-gold uppercase tracking-wider">CORE RELATIONSHIP INQUIRY</p>
            <p className="text-[13px] font-semibold text-ivory mt-0.5">&ldquo;What is the customer worth today, what could they be worth tomorrow, and what is preventing that value from being realized?&rdquo;</p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-emerald/90 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded">
          Active AI Analysis Engaged
        </div>
      </div>

      {/* CUSTOMER POTENTIAL VALUE HERO */}
      <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-6 md:p-8 shadow-3xl overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10">
          <div>
            <span className="inline-flex rounded px-2.5 py-0.5 bg-gold/10 border border-gold/20 text-[9.5px] font-mono text-gold uppercase tracking-wider font-bold mb-3">
              Potential Customer Value
            </span>
            <h1 className="font-display text-[46px] md:text-[60px] font-extrabold text-ivory tracking-tight leading-none font-mono">
              {formatNaira(aggregateMetrics.potentialValueSum)}
            </h1>
            <p className="mt-3.5 text-[13px] text-ivory/50 max-w-xl leading-relaxed">
              APEX ONE monitors the continuous relationship pipeline, comparing flat current subscription agreements against actual service delivery and peak usage capacities.
            </p>
          </div>

          {/* Breakdown parameters specified exactly */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            {[
              { label: "Current Revenue", val: aggregateMetrics.currentRevenueSum },
              { label: "Expansion Potential", val: aggregateMetrics.expansionSum },
              { label: "Renewal Value", val: aggregateMetrics.renewalSum },
              { label: "Risk Exposure", val: aggregateMetrics.riskSum, isRisk: true },
              { label: "Lifetime Value (LTV)", val: aggregateMetrics.ltvSum },
              { label: "Unused Opportunities", val: aggregateMetrics.opportunitiesSum }
            ].map((item, idx) => (
              <div key={idx} className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl min-w-[150px]">
                <span className="text-[9.5px] font-mono text-ivory/35 uppercase tracking-wider block">{item.label}</span>
                <span className={clsx(
                  "text-[14px] font-bold font-mono block mt-1",
                  item.isRisk ? "text-red-400" : "text-gold"
                )}>
                  {formatNaira(item.val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CUSTOMER VALUE MATRIX CONTROLS */}
      <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
          <span className="text-[11px] font-mono font-bold text-ivory/40 uppercase tracking-wider font-bold">CUSTOMER VALUE RELATIONSHIP MATRIX</span>
          <span className="text-[10px] font-mono text-gold/80">Select Matrix Block to Filter Profile Pools</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            onClick={() => setActiveMatrixFilter("all")}
            className={clsx(
              "p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-between h-[80px]",
              activeMatrixFilter === "all"
                ? "border-gold/30 bg-gold/10 text-gold"
                : "border-white/[0.05] bg-white/[0.005] text-ivory/50 hover:bg-white/[0.015]"
            )}
          >
            <span className="text-[10px] font-mono uppercase font-bold">ALL CUSTOMERS</span>
            <span className="text-[18px] font-mono font-bold block mt-1">{customers.length}</span>
          </button>
          
          {matrixBuckets.map((bucket, idx) => (
            <button
              key={idx}
              onClick={() => setActiveMatrixFilter(bucket.name)}
              className={clsx(
                "p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-between h-[80px]",
                activeMatrixFilter === bucket.name
                  ? "border-gold/30 bg-gold/10 text-gold"
                  : "border-white/[0.05] bg-white/[0.005] text-ivory/50 hover:bg-white/[0.015]"
              )}
            >
              <span className="text-[10px] font-mono uppercase font-bold leading-tight">{bucket.name}</span>
              <span className="text-[18px] font-mono font-bold block mt-1">{bucket.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TWO-COLUMN PROFILE DISPLAY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* LEFT COLUMN: CUSTOMER LISTING POOL */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-mono font-bold text-ivory/40 uppercase tracking-wider">Filtered Customer Pools</span>
            <span className="text-[10px] font-mono text-ivory/30">{filteredCustomers.length} profiles sorted</span>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomerId(customer.id)}
                className={clsx(
                  "p-4 rounded-xl border transition-all text-left cursor-pointer flex justify-between items-center",
                  selectedCustomerId === customer.id
                    ? "border-gold/40 bg-gold/10 shadow-gold-glow-soft"
                    : "border-white/[0.04] bg-white/[0.005] hover:bg-white/[0.015]"
                )}
              >
                <div>
                  <h4 className={clsx(
                    "text-[14px] font-bold leading-tight transition-colors",
                    selectedCustomerId === customer.id ? "text-gold" : "text-ivory"
                  )}>
                    {customer.name}
                  </h4>
                  <span className="text-[10px] font-mono text-ivory/35 uppercase mt-1 block">
                    {customer.category}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[13.5px] font-bold font-mono text-ivory block">{formatNaira(customer.potentialValue)}</span>
                  <span className="text-[9.5px] font-mono text-emerald/80 font-bold block mt-0.5">+{customer.usageGrowthPercentage}% Usage</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE CUSTOMER VALUE PROFILE (AI CUSTOMER INTELLIGENCE DISPLAY) */}
        <div className="lg:col-span-7 rounded-2xl border border-white/[0.07] bg-charcoal/40 p-6 shadow-glass space-y-6 text-left">
          
          <div className="border-b border-white/[0.04] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-mono text-gold uppercase tracking-wider font-bold">ACTIVE RELATIONSHIP INTELLIGENCE</p>
              <h3 className="font-display text-[20px] font-bold text-ivory tracking-tight mt-1">{activeProfile.name}</h3>
            </div>
            <span className="rounded-full bg-gold/10 border border-gold/20 px-3 py-1 text-[10px] font-mono text-gold uppercase tracking-wider font-bold shrink-0">
              {activeProfile.category}
            </span>
          </div>

          {/* DYNAMIC COGNITIVE RELATIONSHIP DETAILS (RENEWAL, EXPANSION, RISK, INTERACTION, SENTIMENT, CONTRACTS) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            
            <div className="p-3 rounded-xl border border-white/[0.03] bg-white/[0.005]">
              <span className="text-[9.5px] font-mono text-ivory/30 uppercase block">Historical Revenue</span>
              <p className="text-[13.5px] font-bold font-mono text-ivory mt-1">{formatNaira(activeProfile.currentRevenue)}</p>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.03] bg-white/[0.005]">
              <span className="text-[9.5px] font-mono text-ivory/30 uppercase block">Purchase Frequency</span>
              <p className="text-[12px] font-mono font-bold text-gold mt-1.5">{activeProfile.purchaseFrequency}</p>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.03] bg-white/[0.005] sm:col-span-1">
              <span className="text-[9.5px] font-mono text-ivory/30 uppercase block">interactions logged</span>
              <p className="text-[13.5px] font-mono font-bold text-ivory mt-1">{activeProfile.interactionsCount} Touchpoints</p>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.03] bg-white/[0.005]">
              <span className="text-[9.5px] font-mono text-ivory/30 uppercase block">Open Support Tickets</span>
              <p className="text-[13.5px] font-mono font-bold text-ivory mt-1">{activeProfile.openSupportTickets} tickets</p>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.03] bg-white/[0.005]">
              <span className="text-[9.5px] font-mono text-ivory/30 uppercase block">Customer Sentiment</span>
              <p className="text-[13.5px] font-mono font-bold text-emerald mt-1">{activeProfile.sentimentScore} / 1.0</p>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.03] bg-white/[0.005]">
              <span className="text-[9.5px] font-mono text-ivory/30 uppercase block">Contract renewal</span>
              <p className="text-[12.5px] font-mono font-bold text-ivory mt-1">In {activeProfile.renewalDaysRemaining} Days</p>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.03] bg-white/[0.005]">
              <span className="text-[9.5px] font-mono text-ivory/30 uppercase block">Retention Probability</span>
              <p className="text-[13.5px] font-mono font-bold text-emerald mt-1">{activeProfile.retentionProbability}%</p>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.03] bg-white/[0.005]">
              <span className="text-[9.5px] font-mono text-ivory/30 uppercase block">Expansion Potential</span>
              <p className="text-[13.5px] font-mono font-bold text-gold mt-1">{formatNaira(activeProfile.expansionPotential)}</p>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.03] bg-white/[0.005]">
              <span className="text-[9.5px] font-mono text-ivory/30 uppercase block">Risk Index</span>
              <p className="text-[13.5px] font-mono font-bold text-red-400 mt-1">{activeProfile.riskIndex}% Index</p>
            </div>

          </div>

          {/* ACTIVE CONTRACT METADATA SUMMARY */}
          <div className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.005] space-y-1">
            <span className="text-[9px] font-mono text-ivory/30 uppercase tracking-wider block">CONTRACT HISTORY RECORD</span>
            <p className="text-[12px] text-ivory/70 font-mono font-semibold">{activeProfile.contractHistory}</p>
          </div>

          {/* DEDICATED SPEC AI RECOMMENDATION ALERTS SUMMARY (Usage increased 41%, etc.) */}
          {activeProfile && (
            <div className="rounded-xl border border-gold/20 bg-gold/[0.01] p-4.5 space-y-3.5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gold/10 rounded-full h-16 w-16 blur-2xl pointer-events-none" />
              
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-gold" />
                <span className="text-[11px] font-mono font-bold text-gold uppercase tracking-wider">AI VALUE RECOMMENDATION ALERT</span>
              </div>

              <p className="text-[13px] text-ivory/80 leading-relaxed italic">
                &ldquo;{activeProfile.aiRecommendationText}&rdquo;
              </p>

              <div className="pt-3 border-t border-white/[0.03] flex justify-between items-center text-[12px]">
                <span className="text-ivory/45 font-mono">Potential Expansion Realization Yield:</span>
                <span className="font-mono font-extrabold text-[#c9a961] bg-gold/10 border border-gold/20 px-2.5 py-0.5 rounded text-[13px]">
                  {formatNaira(activeProfile.expansionPotential)}
                </span>
              </div>
            </div>
          )}

        </div>

      </div>
      </>
      )}

    </div>
  );
}
