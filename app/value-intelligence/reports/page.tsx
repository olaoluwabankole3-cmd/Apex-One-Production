"use client";

import { useState, useMemo } from "react";
import { isDemoMode } from "@/lib/demo";
import ValueIntelligenceEmptyState from "@/components/value-engine/ValueIntelligenceEmptyState";
import { useValueEngine } from "@/components/value-engine/ValueEngineContext";
import ValueHeader from "@/components/value-engine/ValueHeader";
import {
  Download,
  Check,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Calendar,
  Users,
  Share2,
  Presentation,
  BookOpen
} from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";

interface Opportunity {
  title: string;
  value: string;
  probability: string;
  playbook: string;
}

interface RiskItem {
  risk: string;
  financialImpact: string;
  probability: string;
  action: string;
}

interface BoardDecision {
  title: string;
  impact: string;
  deadline: string;
  options: string;
}

export default function ReportsPage() {
  const { 
    opportunities, 
    leakageEvents, 
    capacityMetrics, 
    totalIdentified, 
    totalCaptured,
    loading 
  } = useValueEngine();

  const [downloading, setDownloading] = useState<string | null>(null);

  // Success message alert states
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleAction = (actionType: string) => {
    setDownloading(actionType);
    setTimeout(() => {
      setDownloading(null);
      triggerToast(`Successfully completed: ${actionType}`);
    }, 1200);
  };

  const formatNaira = (val: number) => {
    if (val >= 1000000000) {
      return `₦${(val / 1000000000).toFixed(1)}B`;
    }
    if (val >= 1000000) {
      return `₦${(val / 1000000).toFixed(1)}M`;
    }
    return `₦${val.toLocaleString()}`;
  };

  // Top Opportunities List dynamically derived from repository
  const topOpportunities: Opportunity[] = useMemo(() => {
    return opportunities.slice(0, 4).map((opp) => ({
      title: opp.title,
      value: formatNaira(opp.valueAmount),
      probability: `${opp.impactTier} (${opp.probability}%)`,
      playbook: opp.recommendedAction
    }));
  }, [opportunities]);

  // Top Risks List dynamically derived from leakage repository
  const topRisks: RiskItem[] = useMemo(() => {
    return leakageEvents.slice(0, 3).map((leak) => ({
      risk: leak.title,
      financialImpact: formatNaira(leak.leakAmount),
      probability: `${leak.riskScore}%`,
      action: leak.recommendedAction
    }));
  }, [leakageEvents]);

  // Board decisions required (Derived from priority high-tier opportunities)
  const boardDecisions: BoardDecision[] = useMemo(() => {
    const highTier = opportunities.filter((o) => o.impactTier === "High" || o.valueAmount >= 15000000);
    const source = highTier.length > 0 ? highTier : opportunities;
    return source.slice(0, 2).map((opp) => ({
      title: opp.title,
      impact: formatNaira(opp.valueAmount),
      deadline: opp.expectedCaptureDate || "End of Q3",
      options: opp.recommendedAction
    }));
  }, [opportunities]);

  const totalLeakage = useMemo(() => {
    return leakageEvents.reduce((s, l) => s + l.leakAmount, 0);
  }, [leakageEvents]);

  const totalWaste = useMemo(() => {
    return capacityMetrics.reduce((s, c) => s + c.wasteValue, 0);
  }, [capacityMetrics]);

  const keyMetrics = useMemo(() => {
    return [
      { label: "Consolidated Baseline", value: "₦184.0M", sub: "Annualized baseline" },
      { label: "Group-Wide Growth Rate", value: "+12.4%", sub: "Trailing 12-month average" },
      { label: "Total Value Identified", value: formatNaira(totalIdentified), sub: "Cumulative pipeline", highlight: true },
      { label: "Verified Value Captured", value: formatNaira(totalCaptured), sub: "EBITDA margin expansion" },
      { label: "Identified Leakage", value: formatNaira(totalLeakage), sub: "Identified operational leakage" },
      { label: "Customer Contract Risk", value: formatNaira(Math.round(totalLeakage * 0.35)), sub: "High-exposure accounts" },
      { label: "Capacity Optimization", value: formatNaira(totalWaste), sub: "Reclaimable operational capacity" }
    ];
  }, [totalIdentified, totalCaptured, totalLeakage, totalWaste]);

  const validatedSum = useMemo(() => {
    const sum = opportunities
      .filter((o) => o.status === "validated" || o.status === "in_execution" || o.status === "captured")
      .reduce((s, o) => s + o.valueAmount, 0);
    return sum || Math.round(totalIdentified * 0.68);
  }, [opportunities, totalIdentified]);

  const inExecSum = useMemo(() => {
    const sum = opportunities
      .filter((o) => o.status === "in_execution" || o.status === "captured")
      .reduce((s, o) => s + o.valueAmount, 0);
    return sum || Math.round(totalIdentified * 0.40);
  }, [opportunities, totalIdentified]);

  const journeySteps = useMemo(() => [
    { stage: "IDENTIFIED", value: formatNaira(totalIdentified), desc: "Raw potential leakage", color: "text-gold/60" },
    { stage: "VALIDATED", value: formatNaira(validatedSum), desc: "Audited margin captures", color: "text-gold/80" },
    { stage: "EXECUTED", value: formatNaira(inExecSum), desc: "Active playbook tasks", color: "text-gold/90" },
    { stage: "CAPTURED", value: formatNaira(totalCaptured), desc: "EBITDA margin expansion", color: "text-gold font-bold" }
  ], [totalIdentified, validatedSum, inExecSum, totalCaptured]);

  const hasData = isDemoMode() && (opportunities.length > 0 || leakageEvents.length > 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12 select-none relative" id="executive-reports-workspace">
      
      {/* Background glow shadow */}
      <div className="absolute top-[-40px] left-[20%] w-[450px] h-[450px] bg-gold/[0.012] blur-[120px] rounded-full pointer-events-none z-0" />

      {/* HEADER SECTION */}
      <ValueHeader
        category="BOARD-LEVEL INTELLIGENCE"
        title="EXECUTIVE VALUE REPORTS"
        subtitle="The ultimate boardroom communication layer of the APEX ONE system. Translates raw telemetry into strategic insights, risks, and critical board decisions."
      />

      {!hasData ? (
        <ValueIntelligenceEmptyState
          title="No executive reports generated yet"
          description="Executive briefings, board memorandums, and value capture digests will be compiled automatically once organizational data streams are connected."
          badge="Report Engine Offline"
        />
      ) : (
        <>
          {/* TOAST SYSTEM NOTIFICATION */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="fixed top-6 right-6 z-50 bg-emerald/95 text-matte border border-emerald px-5 py-3.5 rounded-xl font-mono text-[12px] font-extrabold shadow-2xl flex items-center gap-2"
              >
                <Check size={14} className="shrink-0" />
                <span>{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* REPORT CONSOLE CONTROLS BAR (Actions Area) */}
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Left Side: Period Details */}
            <div className="text-left font-mono">
              <p className="text-[10px] text-gold font-bold uppercase tracking-widest">REPORT SPECIFICATION</p>
              <div className="flex flex-wrap items-center gap-3.5 mt-1 text-[12px] text-ivory/60">
                <span className="font-bold text-ivory">APEX ONE — EXECUTIVE VALUE REPORT</span>
                <span className="text-ivory/30">•</span>
                <span className="flex items-center gap-1"><Calendar size={12} /> Period: Q3 2026</span>
                <span className="text-ivory/30">•</span>
                <span className="flex items-center gap-1"><Users size={12} /> Audience: Executive Leadership</span>
              </div>
            </div>

            {/* Right Side: Action Buttons */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button
                onClick={() => handleAction("Generate Report")}
                disabled={downloading !== null}
                className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 rounded-lg bg-gold text-matte font-mono font-bold text-[10.5px] px-4 py-2 hover:bg-opacity-90 transition-all cursor-pointer"
              >
                {downloading === "Generate Report" ? <RefreshCw size={12} className="animate-spin" /> : <BookOpen size={12} />}
                Generate Report
              </button>
              
              <button
                onClick={() => handleAction("Export PDF")}
                disabled={downloading !== null}
                className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-gold/30 text-ivory/80 hover:text-gold font-mono font-bold text-[10.5px] px-3.5 py-2 transition-all cursor-pointer"
              >
                {downloading === "Export PDF" ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                Export PDF
              </button>

              <button
                onClick={() => handleAction("Share with Executive Team")}
                disabled={downloading !== null}
                className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-gold/30 text-ivory/80 hover:text-gold font-mono font-bold text-[10.5px] px-3.5 py-2 transition-all cursor-pointer"
              >
                {downloading === "Share with Executive Team" ? <RefreshCw size={12} className="animate-spin" /> : <Share2 size={12} />}
                Share
              </button>

              <button
                onClick={() => handleAction("Present to Board")}
                disabled={downloading !== null}
                className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-gold/30 text-ivory/80 hover:text-gold font-mono font-bold text-[10.5px] px-3.5 py-2 transition-all cursor-pointer"
              >
                {downloading === "Present to Board" ? <RefreshCw size={12} className="animate-spin" /> : <Presentation size={12} />}
                Present
              </button>
            </div>

          </div>

          {/* MCKINSEY-STYLE EXECUTIVE SUMMARY BANNER */}
          <div className="rounded-2xl border border-gold/15 bg-gold/[0.015] p-6 text-left relative overflow-hidden">
            <div className="absolute top-[-5px] right-[-5px] p-2 bg-gold/10 text-gold text-[9px] font-mono font-bold rounded-bl uppercase">
              Autonomous AI Summary
            </div>
            
            <div className="flex gap-4 items-start">
              <div className="h-10 w-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0 mt-0.5">
                <Sparkles size={18} className="animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-gold font-bold uppercase tracking-wider block">BOARD BRIEFING EXECUTIVE SUMMARY</span>
                <p className="text-[15px] font-serif text-ivory/95 leading-relaxed mt-1.5 font-medium italic">
                  &ldquo;Enterprise performance remains stable, with APEX ONE identifying {formatNaira(totalIdentified)} in potential value across customer expansion, revenue recovery and unused capacity. Targeted execution on priority playbooks can secure {formatNaira(totalCaptured || Math.round(totalIdentified * 0.2))} in verified value.&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* THREE-COLUMN COMPACT LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
            
            {/* LEFT COLUMN: KEY METRICS PANEL */}
            <div className="lg:col-span-4 space-y-4 text-left">
              <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4.5">
                <div className="border-b border-white/[0.04] pb-2.5 flex items-center justify-between">
                  <span className="text-[11.5px] font-mono font-bold text-gold uppercase tracking-wider">KEY METRICS SUMMARY</span>
                  <span className="text-[9px] font-mono text-ivory/30">Intelligence Feed</span>
                </div>

                <div className="space-y-3 font-mono">
                  {keyMetrics.map((metric, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 bg-white/[0.015] border border-white/[0.03] rounded-xl">
                      <div>
                        <span className="text-[11.5px] font-semibold text-ivory/70 block">{metric.label}</span>
                        <span className="text-[9px] text-ivory/30 block mt-0.5">{metric.sub}</span>
                      </div>
                      <span className={clsx(
                        "text-[14px] font-bold tabular-nums",
                        metric.highlight ? "text-gold" : "text-ivory"
                      )}>{metric.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* MIDDLE/RIGHT COLUMN: DETAILED REPORT SECTIONS */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* TOP OPPORTUNITIES & RISKS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                
                {/* Opportunities */}
                <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
                  <div className="border-b border-white/[0.04] pb-2 flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-gold uppercase tracking-wider">TOP STRATEGIC OPPORTUNITIES</span>
                    <span className="text-[9.5px] font-mono text-emerald font-bold">Value Potential</span>
                  </div>

                  <div className="space-y-3.5">
                    {topOpportunities.length === 0 ? (
                      <p className="text-xs font-mono text-ivory/40">No strategic opportunities found.</p>
                    ) : (
                      topOpportunities.map((opp, idx) => (
                        <div key={idx} className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl space-y-1">
                          <div className="flex justify-between items-start">
                            <h4 className="text-[13px] font-bold text-ivory tracking-tight">{opp.title}</h4>
                            <span className="text-[12.5px] font-mono font-black text-emerald shrink-0">{opp.value}</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-mono text-ivory/30">
                            <span>Probability: {opp.probability}</span>
                          </div>
                          <p className="text-[11.5px] text-ivory/50 mt-1 leading-relaxed italic">&ldquo;{opp.playbook}&rdquo;</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Risks */}
                <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
                  <div className="border-b border-white/[0.04] pb-2 flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-gold uppercase tracking-wider">CRITICAL REVENUE RISKS</span>
                    <span className="text-[9.5px] font-mono text-red-400 font-bold">At Risk</span>
                  </div>

                  <div className="space-y-3.5">
                    {topRisks.length === 0 ? (
                      <p className="text-xs font-mono text-ivory/40">No critical revenue risks detected.</p>
                    ) : (
                      topRisks.map((risk, idx) => (
                        <div key={idx} className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl space-y-1">
                          <div className="flex justify-between items-start">
                            <h4 className="text-[13px] font-bold text-ivory tracking-tight">{risk.risk}</h4>
                            <span className="text-[12.5px] font-mono font-black text-red-400 shrink-0">{risk.financialImpact}</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-mono text-ivory/30">
                            <span>Probability: {risk.probability}</span>
                          </div>
                          <p className="text-[11.5px] text-ivory/50 mt-1 leading-relaxed"><strong className="text-ivory/70">Remediation:</strong> {risk.action}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* BOARD / EXECUTIVE DECISIONS REQUIRED */}
              <div className="rounded-2xl border border-gold/15 bg-gold/[0.01] p-5.5 text-left space-y-4">
                <div className="border-b border-white/[0.04] pb-2 flex items-center justify-between">
                  <span className="text-[11.5px] font-mono font-bold text-gold uppercase tracking-wider">BOARD / EXECUTIVE DECISIONS REQUIRED</span>
                  <span className="text-[9.5px] font-mono text-gold bg-gold/10 px-2 py-0.5 rounded border border-gold/20 font-bold">Action Gated</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {boardDecisions.map((dec, idx) => (
                    <div key={idx} className="bg-white/[0.015] border border-white/[0.04] p-4 rounded-xl space-y-2">
                      <span className="text-[9px] font-mono text-gold uppercase font-bold tracking-wider">Critical Decision Node {idx + 1}</span>
                      <h4 className="text-[13.5px] font-bold text-ivory leading-snug tracking-tight">{dec.title}</h4>
                      
                      <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-ivory/40 pt-1.5 border-t border-white/[0.03]">
                        <div>
                          <span>Expected Impact</span>
                          <strong className="block text-emerald font-bold text-[11.5px] mt-0.5">{dec.impact}</strong>
                        </div>
                        <div>
                          <span>Decision Due By</span>
                          <strong className="block text-ivory mt-0.5">{dec.deadline}</strong>
                        </div>
                      </div>

                      <div className="pt-2 text-[11px] text-ivory/60 leading-snug">
                        <strong className="text-ivory/70">Action Required:</strong> {dec.options}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* VALUE JOURNEY PIPELINE */}
              <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass text-left space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-2.5">
                  <span className="text-[11px] font-mono font-bold text-gold uppercase tracking-wider">APEX ONE VALUE JOURNEY PIPELINE</span>
                  <span className="text-[10px] font-mono text-ivory/30">Conversion Funnel</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative font-mono">
                  {journeySteps.map((step, idx) => (
                    <div key={idx} className="bg-white/[0.01] border border-white/[0.03] p-3.5 rounded-xl space-y-1.5 relative">
                      {idx < 3 && (
                        <div className="hidden sm:block absolute right-[-10px] top-[40%] translate-y-[-50%] z-20 text-white/10">
                          <ChevronRight size={18} />
                        </div>
                      )}
                      <span className="text-[9px] text-ivory/30 block tracking-widest uppercase">{step.stage}</span>
                      <span className={clsx("text-[17px] font-black block mt-1", step.color)}>{step.value}</span>
                      <span className="text-[9.5px] text-ivory/40 block leading-snug">{step.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI OUTLOOK - WHAT APEX ONE EXPECTS NEXT */}
              <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass text-left space-y-3">
                <div className="border-b border-white/[0.04] pb-2 flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-gold uppercase tracking-wider">WHAT APEX ONE EXPECTS NEXT</span>
                  <span className="text-[9.5px] font-mono text-gold bg-gold/10 px-2 py-0.5 rounded border border-gold/20 font-bold">Predictive Signals</span>
                </div>

                <p className="text-[13.5px] text-ivory/80 leading-relaxed italic font-serif">
                  &ldquo;If current customer activity continues, enterprise renewal risk is expected to increase over the next 60 days.&rdquo;
                </p>

                <div className="pt-2 border-t border-white/[0.03] space-y-2">
                  <span className="text-[9.5px] font-mono text-ivory/30 uppercase block font-bold">Key Predictive Signals Detected</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { title: "Back-Office Latency", value: "+14% delay in handoff milestones", desc: "Bypasses automated webhook synchronizations" },
                      { title: "Ticket volume increase", value: "+41% volume across three accounts", desc: "Drives customer SLA friction bounds" },
                      { title: "Capacity mismatches", value: "Usage growth outstripping limits", desc: "Leads to manual billing reconciliations" }
                    ].map((sig, idx) => (
                      <div key={idx} className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg">
                        <span className="text-[11.5px] font-bold text-ivory block leading-tight">{sig.title}</span>
                        <span className="text-[11px] font-mono text-gold block mt-1">{sig.value}</span>
                        <p className="text-[10px] text-ivory/45 mt-0.5 leading-tight">{sig.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

          </div>

        </>
      )}

    </div>
  );
}

