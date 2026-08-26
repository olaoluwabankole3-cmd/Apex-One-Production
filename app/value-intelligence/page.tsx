"use client";

import { useState } from "react";
import { isDemoMode } from "@/lib/demo";
import ValueIntelligenceEmptyState from "@/components/value-engine/ValueIntelligenceEmptyState";
import { useValueEngine } from "@/components/value-engine/ValueEngineContext";
import ValueHeader from "@/components/value-engine/ValueHeader";
import GlassCard from "@/components/ui/GlassCard";
import ValueDetailDrawer from "@/components/value-engine/ValueDetailDrawer";
import {
  Trophy,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Zap,
  Briefcase,
  Users,
  Target,
  FileCheck,
  TrendingUp,
  Cpu,
  CheckCircle,
  Clock,
  PieChart,
  ShieldCheck,
  Percent,
  Layers,
  Activity
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

interface IntelligenceSignal {
  finding: string;
  evidence: string;
  confidence: number;
  estimatedValue: string;
  recommendedAction: string;
  businessArea: string;
  status: string;
}

export default function ValueIntelligenceOverview() {
  const { 
    opportunities, 
    leakageEvents, 
    customerValues, 
    capacityMetrics, 
    totalIdentified, 
    totalCaptured, 
    runAiScan 
  } = useValueEngine();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Helper for Naira currency display
  const formatNaira = (val: number) => {
    if (val >= 1000000000) {
      return `₦${(val / 1000000000).toFixed(1)}B`;
    }
    if (val >= 1000000) {
      return `₦${(val / 1000000).toFixed(1)}M`;
    }
    return `₦${val.toLocaleString()}`;
  };

  const potentialValueIdentified = totalIdentified;

  const valueBreakdowns = [
    { 
      label: "Revenue Opportunities", 
      value: opportunities.reduce((s, o) => s + o.valueAmount, 0), 
      color: "text-[#c9a961]" 
    },
    { 
      label: "Revenue Leakage", 
      value: leakageEvents.reduce((s, l) => s + l.leakAmount, 0), 
      color: "text-red-400" 
    },
    { 
      label: "Customer Value", 
      value: customerValues.reduce((s, c) => s + c.potentialValue, 0), 
      color: "text-emerald-400" 
    },
    { 
      label: "Capacity Allocation", 
      value: capacityMetrics.reduce((s, c) => s + c.wasteValue, 0), 
      color: "text-purple-400" 
    },
    { 
      label: "Working Capital", 
      value: Math.round(opportunities.reduce((s, o) => s + o.valueAmount, 0) * 0.28), 
      color: "text-blue-400" 
    },
    { 
      label: "Operational Efficiency", 
      value: Math.round(leakageEvents.reduce((s, l) => s + l.leakAmount, 0) * 0.37), 
      color: "text-orange-400" 
    }
  ];

  // Visual Health Indicators
  const healthIndicators = [
    { label: "Revenue Health", score: 91, status: "STABLE", color: "text-emerald", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Customer Health", score: 84, status: "MITIGATING", color: "text-amber", bg: "bg-amber-500/10 border-amber-500/20" },
    { label: "Operational Health", score: 98, status: "OPTIMIZED", color: "text-emerald", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Capacity Health", score: 88, status: "RESTRICTED", color: "text-amber", bg: "bg-amber-500/10 border-amber-500/20" },
    { label: "Execution Health", score: 92, status: "HIGH RESP.", color: "text-emerald", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Risk Health", score: 3.1, status: "LOW EXPOSURE", color: "text-emerald", bg: "bg-emerald-500/10 border-emerald-500/20", isRatio: true }
  ];

  // Dynamically synthesized signals from backend opportunities & leakage
  const topSignals: IntelligenceSignal[] = [
    ...opportunities.slice(0, 2).map((o) => ({
      finding: o.title,
      evidence: o.description,
      confidence: o.confidence,
      estimatedValue: formatNaira(o.valueAmount),
      recommendedAction: o.recommendedAction,
      businessArea: o.category,
      status: o.status === "validated" ? "Validated" : "Board Review Pending"
    })),
    ...leakageEvents.slice(0, 1).map((l) => ({
      finding: l.title,
      evidence: l.description,
      confidence: l.riskScore,
      estimatedValue: formatNaira(l.leakAmount),
      recommendedAction: l.recommendedAction,
      businessArea: l.category,
      status: "Playbook Active"
    }))
  ];

  // Value Journey Progression Nodes computed from context data
  const validatedSum = opportunities
    .filter((o) => o.status === "validated" || o.status === "in_execution" || o.status === "captured")
    .reduce((sum, o) => sum + o.valueAmount, 0);
  const inExecSum = opportunities
    .filter((o) => o.status === "in_execution" || o.status === "captured")
    .reduce((sum, o) => sum + o.valueAmount, 0);

  const journeySteps = [
    { label: "IDENTIFIED", value: totalIdentified, color: "text-gold border-gold/30 bg-gold/5" },
    { label: "VALIDATED", value: validatedSum || Math.round(totalIdentified * 0.68), color: "text-amber border-amber/30 bg-amber/5" },
    { label: "IN EXECUTION", value: inExecSum || Math.round(totalIdentified * 0.40), color: "text-blue-400 border-blue-400/30 bg-blue-400/5" },
    { label: "CAPTURED", value: totalCaptured, color: "text-emerald border-emerald/30 bg-emerald/5" }
  ];

  const handleOpenDetail = (signal: IntelligenceSignal) => {
    // Map signal properties to drawer details structure
    setSelectedItem({
      title: signal.finding,
      value: signal.estimatedValue,
      confidence: signal.confidence,
      businessArea: signal.businessArea,
      whyIdentified: `The AI Engine detected critical structural deviations matching our standard ${signal.businessArea} rule definitions.`,
      evidence: signal.evidence,
      recommendedAction: signal.recommendedAction,
      expectedOutcome: "Full capture of identified capital with validated ledger trails.",
      executionStatus: signal.status,
      financialImpact: `+${signal.estimatedValue} Annualized Yield`,
      auditTrail: [
        "Synthesized by APEX ONE Cognitive Engine",
        "Compliance checks verified trace parameters against CBN standards"
      ]
    });
    setDrawerOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12 relative" id="command-center-workspace">
      
      {/* Visual background element */}
      <div className="absolute top-[-40px] left-[15%] w-[450px] h-[450px] bg-gold/[0.03] blur-[100px] rounded-full pointer-events-none z-0" />

      <ValueHeader
        category="ENTERPRISE INTELLIGENCE COMMAND CENTER"
        title="ENTERPRISE INTELLIGENCE COMMAND CENTER"
        subtitle="Unified intelligence across customers, operations, revenue, capacity and organizational value."
      />

      {!isDemoMode() ? (
        <ValueIntelligenceEmptyState
          title="Enterprise intelligence awaiting data"
          description="Connect financial and operational data streams to populate the intelligence engine."
          badge="Intelligence System Offline"
        />
      ) : (
        <>
          {/* CORE IDEA: HERO POSITION PANEL */}
          <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-6 md:p-8 shadow-3xl overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-gold/15 text-gold border border-gold/15">
                <Target size={11} />
              </span>
              <span className="text-[10px] font-mono text-gold uppercase tracking-[0.2em] font-bold">Consolidated System Position</span>
            </div>

            <h1 className="font-display text-[46px] md:text-[62px] font-extrabold text-ivory tracking-tight leading-none font-mono">
              {formatNaira(potentialValueIdentified)}
            </h1>
            <p className="mt-2 text-[12.5px] uppercase font-mono tracking-wider text-gold/80 font-bold">Potential Value Identified</p>
            <p className="mt-3 text-[13px] text-ivory/50 max-w-xl leading-relaxed">
              APEX ONE monitors continuous transactional, capacity, and SLA contract streams to track, validate, and secure leaking capital and expansion margins.
            </p>
          </div>

          {/* Broken down into specified vectors */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            {valueBreakdowns.map((item, idx) => (
              <div key={idx} className="bg-white/[0.01] border border-white/[0.04] p-3.5 rounded-xl min-w-[150px]">
                <span className="text-[9.5px] font-mono text-ivory/35 uppercase tracking-wider block">{item.label}</span>
                <span className={`text-[15px] font-bold font-mono block mt-1.5 ${item.color}`}>
                  {formatNaira(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* VALUE PIPELINE JOURNEY (IDENTIFIED -> VALIDATED -> EXECUTION -> CAPTURED) */}
      <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
          <span className="text-[11px] font-mono font-bold text-ivory/40 uppercase tracking-wider">APEX COGNITIVE VALUE PIPELINE</span>
          <span className="text-[10.5px] font-mono text-gold/80">Active Realization Rate: 100% Traceable</span>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch justify-between gap-3 relative">
          {journeySteps.map((step, idx) => (
            <div key={idx} className="flex-1 flex items-center gap-2">
              <div className={`flex-1 p-3.5 rounded-xl border ${step.color} flex flex-col justify-between`}>
                <span className="text-[10px] font-mono opacity-60 tracking-wider font-bold uppercase">{step.label}</span>
                <span className="text-[18px] font-mono font-bold mt-1.5">{formatNaira(step.value)}</span>
              </div>
              {idx < journeySteps.length - 1 && (
                <ArrowRight size={13} className="text-white/20 hidden sm:block shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* WHY THIS MATTERS (AI EXPLANATION) & ORGANIZATIONAL HEALTH */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        
        {/* WHY THIS MATTERS - Natural-Language Executive Explanation */}
        <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-white/[0.04] pb-2.5">
              <Cpu size={14} className="text-gold animate-pulse" />
              <h3 className="text-[13px] font-bold text-ivory uppercase tracking-wider font-mono">WHY THIS MATTERS (Executive Analysis)</h3>
            </div>
            <div className="mt-3.5 p-4 bg-gold/[0.01] border border-gold/15 rounded-xl text-[13.5px] text-ivory/85 leading-relaxed space-y-3">
              <p>
                APEX ONE has synthesized the live operational topology. While total identified value sits at <strong className="text-gold font-mono">₦184.7M</strong>, core risk exposure has dropped significantly quarter-over-quarter to <strong className="text-gold font-mono">3.1</strong>, led by successful clearing sweep integrations in Treasury Management.
              </p>
              <p>
                Active revenue leakage pockets are currently isolated in unbilled professional deliverables (<strong className="text-gold font-mono">₦18.7M</strong>) and expired support retainer agreements (<strong className="text-gold font-mono">₦31.8M</strong>). Enabling automatic ticket locking protocols on expired SLAs offers immediate, risk-free cash realization with 94% confidence.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-ivory/30 pt-3 border-t border-white/[0.03]">
            <span>Cognitive Parser: v2.4</span>
            <span>Target Confidence Score: 90%+ Approved</span>
          </div>
        </div>

        {/* ORGANIZATIONAL HEALTH INDICATORS */}
        <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
          <div className="border-b border-white/[0.04] pb-2.5 flex items-center gap-2">
            <Activity size={14} className="text-gold" />
            <h3 className="text-[13px] font-bold text-ivory uppercase tracking-wider font-mono">ORGANIZATIONAL HEALTH</h3>
          </div>

          <div className="space-y-3.5">
            {healthIndicators.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-[12.5px]">
                <span className="text-ivory/70 font-medium">{item.label}</span>
                <div className="flex items-center gap-2.5">
                  <span className={clsx("px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border uppercase", item.bg, item.color)}>
                    {item.status}
                  </span>
                  <span className="font-mono font-bold text-ivory min-w-[36px] text-right">
                    {item.score}{item.isRatio ? "" : "%"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* TOP SIGNALS PANEL */}
      <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-6 shadow-glass space-y-5">
        <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-gold" />
            <h3 className="text-[14px] font-bold text-ivory uppercase tracking-wider">HIGHEST-VALUE ACTIVE SIGNALS</h3>
          </div>
          <span className="text-[10.5px] font-mono text-ivory/35">Aggregated hourly from system telemetry</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {topSignals.map((signal, idx) => (
            <div
              key={idx}
              onClick={() => handleOpenDetail(signal)}
              className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.005] hover:bg-white/[0.02] hover:border-gold/25 transition-all cursor-pointer flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="px-2 py-0.5 bg-white/[0.04] border border-white/[0.08] rounded text-[9.5px] font-mono text-gold/80 uppercase font-bold">
                    {signal.businessArea}
                  </span>
                  <span className="text-[10px] font-mono text-emerald uppercase font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 rounded-full">
                    {signal.confidence}% Conf.
                  </span>
                </div>
                <h4 className="text-[13.5px] font-bold text-ivory tracking-tight">{signal.finding}</h4>
                <p className="text-[11.5px] text-ivory/50 leading-relaxed line-clamp-3">
                  {signal.evidence}
                </p>
              </div>

              <div className="pt-3 border-t border-white/[0.03] space-y-2">
                <div className="flex justify-between items-center text-[12px]">
                  <span className="text-ivory/45">Estimated Value:</span>
                  <span className="font-mono font-bold text-gold">{signal.estimatedValue}</span>
                </div>
                <div className="text-[11px] bg-white/[0.02] p-2 rounded border border-white/[0.04] text-ivory/60 italic leading-snug line-clamp-2">
                  <strong>Action:</strong> {signal.recommendedAction}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DETAIL DRAWER GATEWAY */}
      {selectedItem && (
        <ValueDetailDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={selectedItem.title}
          value={selectedItem.value}
          confidence={selectedItem.confidence}
          businessArea={selectedItem.businessArea}
          whyIdentified={selectedItem.whyIdentified}
          evidence={selectedItem.evidence}
          recommendedAction={selectedItem.recommendedAction}
          expectedOutcome={selectedItem.expectedOutcome}
          executionStatus={selectedItem.executionStatus}
          financialImpact={selectedItem.financialImpact}
          auditTrail={selectedItem.auditTrail}
        />
      )}

        </>
      )}

    </div>
  );
}
