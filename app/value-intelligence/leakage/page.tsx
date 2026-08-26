"use client";

import { useState, useMemo } from "react";
import { isDemoMode } from "@/lib/demo";
import ValueIntelligenceEmptyState from "@/components/value-engine/ValueIntelligenceEmptyState";
import ValueHeader from "@/components/value-engine/ValueHeader";
import GlassCard from "@/components/ui/GlassCard";
import {
  ShieldAlert,
  ArrowRight,
  Zap,
  Activity,
  Info,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Play,
  HeartCrack
} from "lucide-react";
import clsx from "clsx";

interface DiagnosticLeakageSource {
  id: string;
  title: string;
  category: "Missed renewals" | "Billing errors" | "Underutilized contracts" | "SLA-related credits" | "Failed collections" | "Unbilled services" | "Pricing inconsistencies";
  estimatedValue: number;
  rootCause: string;
  evidence: string;
  confidence: number;
  recoveryAction: string;
  expectedOutcome: string;
  recovered: boolean;
  isRecovering: boolean;
}

export default function RevenueProtectionPage() {
  const [leakageSources, setLeakageSources] = useState<DiagnosticLeakageSource[]>([
    {
      id: "leak-1",
      title: "Missed Support SLA Renewal",
      category: "Missed renewals",
      estimatedValue: 31800000, // ₦31.8M
      rootCause: "15 enterprise customers are past their contracted support period but support desk queues continue resolving tickets, bypassing billing blocks.",
      evidence: "15 enterprise customers are approaching renewal while unresolved SLA issues remain open.",
      confidence: 84,
      recoveryAction: "Enforce automated ticket queue locking immediately upon underlying SLA agreement expiration.",
      expectedOutcome: "Immediate recovery of unbilled support retainer agreements and expedited renewals.",
      recovered: false,
      isRecovering: false
    },
    {
      id: "leak-2",
      title: "Unbilled Completed Professional deliverables",
      category: "Unbilled services",
      estimatedValue: 18700000, // ₦18.7M
      rootCause: "Completed project milestones fail to trigger invoice creation in the legacy ERP pipeline due to manual reconciliation delay.",
      evidence: "87 completed strategic account delivery nodes found without matched invoice records in Salesforce.",
      confidence: 78,
      recoveryAction: "Automate delivery milestone syncing directly into ERP invoice routing triggers.",
      expectedOutcome: "Direct acceleration of operating cash flow and decreased bill-to-invoice latency.",
      recovered: false,
      isRecovering: false
    },
    {
      id: "leak-3",
      title: "Passive Churn Failed Credit collections",
      category: "Failed collections",
      estimatedValue: 16800000, // ₦16.8M
      rootCause: "Failed corporate transaction nodes lack active follow-up schedules, drifting silent subscriptions out of active billing bounds.",
      evidence: "134 transactional dunning failures flagged over the trailing 30 days with zero automated follow-up triggers.",
      confidence: 65,
      recoveryAction: "Activate automated dynamic retries with integrated credit cards passive auto-updaters.",
      expectedOutcome: "Immediate containment of silent, involuntary subscriber drop-off metrics.",
      recovered: false,
      isRecovering: false
    },
    {
      id: "leak-4",
      title: "Naira Price Volatility Inconsistencies",
      category: "Pricing inconsistencies",
      estimatedValue: 15200000, // ₦15.2M
      rootCause: "Active contracts utilize legacy flat exchange pricing, ignoring updated CBN currency rate bands.",
      evidence: "30-day foreign exchange variance triggers indexation Clause 4.2 parameters across active contract bounds.",
      confidence: 95,
      recoveryAction: "Apply active Nigerian Naira volatility multiplier parameters across billing cycles.",
      expectedOutcome: "Protects contract yield margins from structural local currency exchange depreciation.",
      recovered: false,
      isRecovering: false
    }
  ]);

  // Overall metric tracking
  const totalLeakage = useMemo(() => {
    return leakageSources.reduce((sum, s) => {
      return sum + (s.recovered ? 0 : s.estimatedValue);
    }, 0);
  }, [leakageSources]);

  // Vector breakdown matching specifications
  const vectorBreakdown = useMemo(() => {
    const vectors = {
      "Missed renewals": 31800000,
      "Billing errors": 4500000,
      "Underutilized contracts": 12400000,
      "SLA-related credits": 6200000,
      "Failed collections": 16800000,
      "Unbilled services": 18700000,
      "Pricing inconsistencies": 15200000
    };
    return Object.entries(vectors).map(([label, val]) => ({ label, val }));
  }, []);

  // Leakage Journey node configuration with active highlight indicators
  const journeyNodes = [
    { name: "CONTRACT", status: "SECURE", loss: "0%", color: "text-emerald border-emerald/20 bg-emerald/5", highlight: false },
    { name: "DELIVERY", status: "BLEEDING", loss: "11.4%", color: "text-red-400 border-red-500/30 bg-red-500/5 animate-pulse", highlight: true, detail: "Unbilled deliverables" },
    { name: "INVOICE", status: "LEAKING", loss: "5.8%", color: "text-red-400 border-red-500/30 bg-red-500/5", highlight: true, detail: "Expired SLA tickets" },
    { name: "PAYMENT", status: "SECURE", loss: "0%", color: "text-emerald border-emerald/20 bg-emerald/5", highlight: false }
  ];

  // Formatter helper
  const formatNaira = (val: number) => {
    if (val >= 1000000000) {
      return `₦${(val / 1000000000).toFixed(1)}B`;
    }
    if (val >= 1000000) {
      return `₦${(val / 1000000).toFixed(1)}M`;
    }
    return `₦${val.toLocaleString()}`;
  };

  // Recover simulated workflow
  const handleRecover = (id: string) => {
    setLeakageSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isRecovering: true } : s))
    );

    // Simulate multi-step verification sequence
    setTimeout(() => {
      setLeakageSources((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, isRecovering: false, recovered: true } : s
        )
      );
    }, 1800);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12 select-none relative" id="revenue-protection-workspace">
      
      {/* Background glow overlay */}
      <div className="absolute top-[-40px] left-[10%] w-[450px] h-[450px] bg-red-500/[0.015] blur-[120px] rounded-full pointer-events-none z-0" />

      <ValueHeader
        category="REVENUE PROTECTION INTELLIGENCE"
        title="REVENUE PROTECTION INTELLIGENCE"
        subtitle="Identify revenue that the organization has already earned, contracted, or should reasonably be capturing — but is losing through operational friction."
      />

      {!isDemoMode() ? (
        <ValueIntelligenceEmptyState
          title="No revenue leakage connected"
          description="Connect commercial billing streams and SLA contracts to trace operational revenue protection opportunities."
          badge="Leakage Engine Offline"
        />
      ) : (
        <>
          {/* REVENUE PROTECTION HERO */}
          <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-6 md:p-8 shadow-3xl overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-red-500/10 text-red-400 border border-red-500/25 animate-pulse">
                <ShieldAlert size={12} />
              </span>
              <span className="text-[10px] font-mono text-red-400 uppercase tracking-[0.2em] font-bold">ACTIVE DIAGNOSTIC ANALYSIS</span>
            </div>

            <h1 className="font-display text-[46px] md:text-[60px] font-extrabold text-ivory tracking-tight leading-none font-mono">
              {formatNaira(totalLeakage)}
            </h1>
            <p className="mt-3.5 text-[12.5px] uppercase font-mono tracking-wider text-red-400/80 font-bold">Estimated Revenue Leakage</p>
            <p className="mt-3 text-[13px] text-ivory/50 max-w-xl leading-relaxed">
              Diagnostic engines monitor pipeline exceptions to locate silent cash drains. Click **RECOVER VALUE** on any leakage source below to deploy immediate automated mitigation.
            </p>
          </div>

          {/* Specified Breaks Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            {vectorBreakdown.map((item, idx) => (
              <div key={idx} className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl min-w-[130px]">
                <span className="text-[9.5px] font-mono text-ivory/35 uppercase tracking-wider block">{item.label}</span>
                <span className="text-[14px] font-bold font-mono block mt-1 text-red-400">
                  {formatNaira(item.val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LEAKAGE JOURNEY MAP */}
      <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
          <span className="text-[11px] font-mono font-bold text-ivory/40 uppercase tracking-wider">REVENUE LEAKAGE JOURNEY DIAGRAM</span>
          <span className="text-[10px] font-mono text-red-400 font-bold uppercase animate-pulse">Risk Zones Active</span>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch justify-between gap-3 relative">
          {journeyNodes.map((node, idx) => (
            <div key={idx} className="flex-1 flex items-center gap-2">
              <div className={clsx(
                "flex-1 p-3.5 rounded-xl border flex flex-col justify-between relative overflow-hidden",
                node.color
              )}>
                {node.highlight && (
                  <div className="absolute top-0 right-0 bg-red-400 text-matte font-mono text-[8px] font-bold px-1.5 py-0.5 rounded-bl">
                    {node.detail}
                  </div>
                )}
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono tracking-wider font-bold uppercase">{node.name}</span>
                  <span className="text-[9px] font-mono font-bold">{node.status}</span>
                </div>
                <div className="flex justify-between items-end mt-2">
                  <span className="text-[10.5px] text-ivory/40 font-mono">Friction Rating</span>
                  <span className="text-[16px] font-mono font-bold">{node.loss} Loss</span>
                </div>
              </div>
              {idx < journeyNodes.length - 1 && (
                <ArrowRight size={13} className="text-white/20 hidden sm:block shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* TWO-COLUMN COGNITIVE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        
        {/* DIAGNOSTIC CARDS (EST VALUE, ROOT CAUSE, EVIDENCE, CONFIDENCE, RECOVERY ACTION) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Activity size={14} className="text-red-400" />
            <h4 className="text-[11px] font-mono font-bold text-red-400 uppercase tracking-wider">ACTIVE DIAGNOSTIC SOURCES</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leakageSources.map((source) => (
              <div
                key={source.id}
                className={clsx(
                  "rounded-2xl border p-5 transition-all flex flex-col justify-between space-y-4 text-left relative overflow-hidden",
                  source.recovered
                    ? "border-emerald-500/20 bg-emerald-500/[0.01] opacity-70"
                    : "border-white/[0.04] bg-white/[0.005] hover:border-red-500/20"
                )}
              >
                {source.recovered && (
                  <div className="absolute top-0 right-0 bg-emerald text-matte font-mono text-[9px] font-bold px-2 py-0.5 rounded-bl flex items-center gap-1">
                    <CheckCircle2 size={10} />
                    RECOVERED
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="rounded bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-[9.5px] font-mono text-red-400 uppercase font-bold">
                      {source.category}
                    </span>
                    <span className="text-[10px] font-mono text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                      Confidence: {source.confidence}%
                    </span>
                  </div>

                  <div>
                    <span className="text-[9.5px] uppercase tracking-wider font-mono text-ivory/30 block">Diagnostic Source</span>
                    <h4 className="text-[14.5px] font-bold text-ivory leading-tight">{source.title}</h4>
                  </div>

                  <div>
                    <span className="text-[9.5px] uppercase tracking-wider font-mono text-ivory/30 block">Potential Recovery Value</span>
                    <p className={clsx(
                      "text-[18px] font-mono font-bold",
                      source.recovered ? "text-emerald line-through" : "text-red-400"
                    )}>
                      {formatNaira(source.estimatedValue)}
                    </p>
                  </div>

                  <div className="space-y-1 bg-white/[0.01] border border-white/[0.03] p-3 rounded-xl">
                    <span className="text-[9.5px] uppercase tracking-wider font-mono text-red-400 block font-bold">Evidence Reference</span>
                    <p className="text-[12px] text-ivory/60 leading-relaxed italic">
                      &ldquo;{source.evidence}&rdquo;
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9.5px] uppercase tracking-wider font-mono text-ivory/30 block">Root Cause Analysis</span>
                    <p className="text-[12px] text-ivory/50 leading-relaxed pr-2">
                      {source.rootCause}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.03] space-y-3.5">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider font-mono text-ivory/30 block">Recovery Mitigation Action</span>
                    <p className="text-[11.5px] text-ivory/70 leading-snug">{source.recoveryAction}</p>
                  </div>

                  {/* RECOVER VALUE ACTION BUTTON */}
                  {!source.recovered ? (
                    <button
                      onClick={() => handleRecover(source.id)}
                      disabled={source.isRecovering}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-red-400/10 hover:bg-red-400/15 border border-red-400/25 text-red-400 font-mono font-bold text-[11px] py-2.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {source.isRecovering ? (
                        <>
                          <RefreshCw size={11} className="animate-spin" />
                          Plugging Leak...
                        </>
                      ) : (
                        <>
                          <Play size={10} className="fill-current" />
                          RECOVER VALUE
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/15 text-emerald font-mono text-[11px] font-bold rounded-lg text-center">
                      ✓ VALUE SECURED IN ACTIVE COGNITIVE LEDGER
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI ROOT-CAUSE ANALYSIS PANEL */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4 text-left">
            <div className="border-b border-white/[0.04] pb-2.5 flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-red-400 animate-pulse" />
              <h3 className="text-[12px] font-mono font-bold text-red-400 uppercase tracking-wider">AI Root-Cause Diagnostics</h3>
            </div>

            <div className="space-y-3 pt-1 text-[12.5px] text-ivory/80 leading-relaxed">
              <span className="text-[10px] font-mono text-gold uppercase tracking-wider block font-bold">WHY IS THIS REVENUE LEAKING?</span>
              <p>
                Telemetry audit indicates a critical chain of operational drift. Account provisioning systems remain unlinked from active client contracts, allowing unresolved support tasks to be resolved for accounts lacking valid retainers.
              </p>
              <p>
                Simultaneously, legacy credit card processing scripts silently drop expired transaction nodes without triggering active webhook re-attempts.
              </p>
            </div>

            <div className="pt-3 border-t border-white/[0.03] flex items-center justify-between text-[10px] font-mono text-ivory/30">
              <span>Risk Severity: High</span>
              <span>Audit: CBN Verified</span>
            </div>
          </div>
        </div>

      </div>
      </>
    )}

    </div>
  );
}
