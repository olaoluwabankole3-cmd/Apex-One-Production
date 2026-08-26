"use client";

import { useState } from "react";
import { isDemoMode } from "@/lib/demo";
import ValueIntelligenceEmptyState from "@/components/value-engine/ValueIntelligenceEmptyState";
import ValueHeader from "@/components/value-engine/ValueHeader";
import GlassCard from "@/components/ui/GlassCard";
import ValueDetailDrawer from "@/components/value-engine/ValueDetailDrawer";
import {
  Trophy,
  ShieldCheck,
  ArrowRight,
  Activity,
  Percent,
  ChevronRight,
  TrendingUp,
  FileCheck,
  Receipt,
  FileText,
  UserCheck,
  Coins,
  Cpu,
  BarChart3,
  ArrowDown
} from "lucide-react";
import clsx from "clsx";

interface CapturedValueEvent {
  id: string;
  opportunity: string;
  category: "Revenue recovered" | "Revenue generated" | "Cost avoided" | "Capacity recovered" | "Time saved";
  capturedValue: number;
  evidenceType: "Invoice Link" | "Contract Clause" | "Customer transaction log" | "Workflow completion" | "Before/after metric" | "Financial ledger record";
  evidenceDescription: string;
  originalEstimate: number;
  realizationDate: string;
  auditTrail: string[];
}

export default function ProvenValueRoiPage() {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const verifiedValueCaptured = 18400000; // ₦18.4M

  // Specified captured vector break downs
  const vectorBreakdowns = [
    { label: "Revenue recovered", val: 8200000, color: "text-emerald" },
    { label: "Revenue generated", val: 4500000, color: "text-emerald" },
    { label: "Cost avoided", val: 3200000, color: "text-emerald" },
    { label: "Capacity recovered", val: 1500000, color: "text-emerald" },
    { label: "Time saved", val: 1000000, color: "text-emerald" }
  ];

  // Verified capture events with rigorous evidence metrics as requested
  const capturedEvents: CapturedValueEvent[] = [
    {
      id: "cap-1",
      opportunity: "Clearing Sweep Float Optimization",
      category: "Revenue recovered",
      capturedValue: 8200000,
      evidenceType: "Financial ledger record",
      evidenceDescription: "CBN daily clearing sweeping ledger reference txn-sweeps-881A. Float latency reduced to exactly 30 minutes.",
      originalEstimate: 9600000,
      realizationDate: "2026-08-12",
      auditTrail: [
        "Sweeping script deployed and validated by Treasury Management",
        "General Ledger sweep matched by Marcus Thorne (CFO Office)"
      ]
    },
    {
      id: "cap-2",
      opportunity: "Access Digital Expansion Milestone",
      category: "Revenue generated",
      capturedValue: 4500000,
      evidenceType: "Invoice Link",
      evidenceDescription: "Active Invoice record INV-2026-091A. Capacity usage overflow SLA tier adjustment billing executed.",
      originalEstimate: 5000000,
      realizationDate: "2026-08-01",
      auditTrail: [
        "Capacity overflow billing locks triggered dynamically",
        "Invoice approved and validated by Amina Yusuf (Accounts)"
      ]
    },
    {
      id: "cap-3",
      opportunity: "Redundant Cloud CDN Node Decommission",
      category: "Cost avoided",
      capturedValue: 3200000,
      evidenceType: "Before/after metric",
      evidenceDescription: "Staging cluster lease bills. AWS Regional usage bill lowered from $4,100 to $1,800 monthly.",
      originalEstimate: 3500000,
      realizationDate: "2026-07-20",
      auditTrail: [
        "Unutilized CDN staging servers safely snapshot and destroyed",
        "Infrastructure billing update confirmed by Yusuf Alao"
      ]
    },
    {
      id: "cap-4",
      opportunity: "Claims Triage Automated Routing",
      category: "Time saved",
      capturedValue: 1000000,
      evidenceType: "Workflow completion",
      evidenceDescription: "Solace Claims dashboard log stats. Manual triage latency reduced from 45 minutes to 4 minutes.",
      originalEstimate: 1200000,
      realizationDate: "2026-07-15",
      auditTrail: [
        "Triage workflow node deployed and active in Workflows hub",
        "SLA exception penalties drop to zero on active queue logs"
      ]
    },
    {
      id: "cap-5",
      opportunity: "Advisor Queue Workload Rebalancing",
      category: "Capacity recovered",
      capturedValue: 1500000,
      evidenceType: "Contract Clause",
      evidenceDescription: "Contract clause alignment telemetry. Abuja SLA tickets overflow successfully re-routed to Lagos advisors.",
      originalEstimate: 1800000,
      realizationDate: "2026-07-02",
      auditTrail: [
        "Workload parameters verified across Lagos/Abuja teams",
        "Time tracking audit records 40 reclaimed advisor capacity hours"
      ]
    }
  ];

  // Specific visual Value Journey values (Identified -> Validated -> Executed -> Captured)
  const journeySteps = [
    { label: "IDENTIFIED", val: 184700000, color: "text-gold border-gold/20 bg-gold/5" },
    { label: "VALIDATED", val: 126300000, color: "text-amber border-amber/20 bg-amber/5" },
    { label: "EXECUTED", val: 73800000, color: "text-blue-400 border-blue-400/20 bg-blue-400/5" },
    { label: "CAPTURED", val: 18400000, color: "text-emerald border-emerald/30 bg-emerald/5" }
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

  const handleOpenDetail = (event: CapturedValueEvent) => {
    setSelectedEvent({
      title: event.opportunity,
      value: formatNaira(event.capturedValue),
      confidence: 100,
      businessArea: event.category.toUpperCase(),
      whyIdentified: `This value event traces directly from the APEX ONE continuous audit. Original potential target estimate was ${formatNaira(event.originalEstimate)}.`,
      evidence: event.evidenceDescription,
      recommendedAction: "Audit verified and consolidated into corporate balance sheet.",
      expectedOutcome: `Successfully secured ${formatNaira(event.capturedValue)} in captured yield with full ledger traceability.`,
      executionStatus: "PROVEN CAPTURED",
      financialImpact: `+${formatNaira(event.capturedValue)} Certified Ledger Yield`,
      auditTrail: event.auditTrail
    });
    setDrawerOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12 select-none relative" id="proven-value-workspace">
      
      {/* Background glow shadow */}
      <div className="absolute top-[-40px] right-[10%] w-[450px] h-[450px] bg-emerald-500/[0.015] blur-[120px] rounded-full pointer-events-none z-0" />

      <ValueHeader
        category="PROVEN VALUE / ROI EVIDENCE"
        title="PROVEN VALUE"
        subtitle="This page proves whether intelligence identified by APEX ONE actually produced measurable, certified financial results."
      />

      {!isDemoMode() ? (
        <ValueIntelligenceEmptyState
          title="No verified value captured yet"
          description="Verified financial returns, recovered revenue, and avoided costs will be tracked here once organizational data is connected and actions are executed."
          badge="ROI Tracking Offline"
        />
      ) : (
        <>
          {/* VERIFIED HERO VALUE */}
          <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-6 md:p-8 shadow-3xl overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 text-emerald border border-emerald-500/25">
                <Trophy size={11} />
              </span>
              <span className="text-[10px] font-mono text-emerald uppercase tracking-[0.2em] font-bold">Verified Realized Capital</span>
            </div>

            <h1 className="font-display text-[46px] md:text-[60px] font-extrabold text-ivory tracking-tight leading-none font-mono">
              {formatNaira(verifiedValueCaptured)}
            </h1>
            <p className="mt-2.5 text-[12.5px] uppercase font-mono tracking-wider text-emerald font-bold">Verified Value Captured</p>
            <p className="mt-3.5 text-[13px] text-ivory/50 max-w-xl leading-relaxed">
              Proven and captured capital. Every value entry displayed has passed validation gates and resides in corporate sub-ledger accounts.
            </p>
          </div>

          {/* Breakdown components specified exactly */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            {vectorBreakdowns.map((item, idx) => (
              <div key={idx} className="bg-white/[0.01] border border-white/[0.04] p-3.5 rounded-xl min-w-[150px]">
                <span className="text-[9.5px] font-mono text-ivory/35 uppercase tracking-wider block">{item.label}</span>
                <span className="text-[14px] font-bold font-mono block mt-1.5 text-emerald">
                  {formatNaira(item.val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* VISUAL VALUE JOURNEY PIPELINE (Difference between potential and realized) */}
      <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
          <span className="text-[11px] font-mono font-bold text-ivory/40 uppercase tracking-wider">APEX ONE VALUE JOURNEY FUNNEL</span>
          <span className="text-[10px] font-mono text-emerald font-bold uppercase">100% Realization Verifiable</span>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch justify-between gap-3 relative">
          {journeySteps.map((step, idx) => (
            <div key={idx} className="flex-1 flex items-center gap-2">
              <div className={clsx(
                "flex-1 p-3.5 rounded-xl border flex flex-col justify-between h-[85px]",
                step.color
              )}>
                <span className="text-[10px] font-mono opacity-60 tracking-wider font-bold uppercase">{step.label}</span>
                <span className="text-[18px] font-mono font-bold mt-1.5">{formatNaira(step.val)}</span>
              </div>
              {idx < journeySteps.length - 1 && (
                <ArrowRight size={13} className="text-white/20 hidden sm:block shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* TWO-COLUMN ROI SUMMARY & EVIDENCE MODULE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* LEFT COLUMN: EVIDENCE-RICH VALUE EVENTS (Invoice, Contract, Transaction, etc.) */}
        <div className="lg:col-span-8 space-y-4 text-left">
          <div className="flex items-center gap-2 px-1">
            <ShieldCheck size={14} className="text-emerald" />
            <h4 className="text-[11px] font-mono font-bold text-emerald uppercase tracking-wider">CERTIFIED CAPTURE EVIDENCE RECORDS</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {capturedEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => handleOpenDetail(event)}
                className="rounded-2xl border border-white/[0.04] bg-white/[0.005] p-5 hover:bg-white/[0.015] hover:border-emerald/20 transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="rounded bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-[9.5px] font-mono text-emerald uppercase font-bold">
                      {event.category}
                    </span>
                    <span className="text-[10px] font-mono text-emerald bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-0.5 rounded-full font-bold">
                      {event.realizationDate}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-[14.5px] font-bold text-ivory group-hover:text-emerald transition-colors leading-tight">{event.opportunity}</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-[11.5px] font-mono border-y border-white/[0.03] py-2">
                    <div>
                      <span className="text-ivory/30 block text-[9px] uppercase">Estimate</span>
                      <span className="text-ivory/60">{formatNaira(event.originalEstimate)}</span>
                    </div>
                    <div>
                      <span className="text-emerald/80 block text-[9px] uppercase">Captured Yield</span>
                      <span className="text-emerald font-bold">{formatNaira(event.capturedValue)}</span>
                    </div>
                  </div>

                  {/* Specific Evidence Block */}
                  <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald">
                      <Receipt size={12} />
                      <span className="text-[9.5px] uppercase tracking-wider font-mono block font-bold">Audit Evidence ({event.evidenceType})</span>
                    </div>
                    <p className="text-[12px] text-ivory/60 leading-relaxed italic">
                      &ldquo;{event.evidenceDescription}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.03] flex items-center justify-between text-[11px] font-mono text-ivory/35">
                  <span>Ledger Code: verified-capture</span>
                  <span className="flex items-center gap-0.5 font-bold text-emerald group-hover:translate-x-0.5 transition-transform">
                    View Audit Trace
                    <ChevronRight size={11} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: APEX ONE ROI LEDGER SCORECARD */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Cpu size={14} className="text-emerald" />
            <h4 className="text-[11px] font-mono font-bold text-emerald uppercase tracking-wider">APEX COGNITIVE ROI LEDGER</h4>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.01] p-6 shadow-glass space-y-6 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-emerald/10 rounded-full h-20 w-20 blur-2xl pointer-events-none" />

            <div className="border-b border-white/[0.04] pb-3">
              <h3 className="text-[14px] font-mono font-bold text-emerald uppercase tracking-wider">APEX ONE ROI</h3>
              <p className="text-[11px] text-ivory/40 mt-0.5">Calculated trailing metrics as of active calendar cycle.</p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/[0.03] pb-2 text-[12.5px]">
                <span className="text-ivory/60">Value captured:</span>
                <span className="font-mono font-bold text-emerald">{formatNaira(verifiedValueCaptured)}</span>
              </div>

              <div className="flex justify-between items-center border-b border-white/[0.03] pb-2 text-[12.5px]">
                <span className="text-ivory/60">Cost of intervention:</span>
                <span className="font-mono font-bold text-ivory">₦2.1M</span>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-[13px] text-emerald font-bold">PROVEN RETURN:</span>
                <span className="font-mono text-[32px] font-black text-emerald tracking-tight leading-none">
                  8.8×
                </span>
              </div>
            </div>

            <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl text-[12px] text-ivory/65 leading-relaxed">
              APEX ONE has delivered a verified <strong className="text-emerald">8.8-to-1</strong> cash yield return across the organization. This metric is computed strictly by contrasting realized general ledger clawbacks against computational engine licenses.
            </div>

            <div className="pt-3 border-t border-white/[0.03] text-[10px] font-mono text-ivory/30 text-center uppercase tracking-wider">
              Secure Ledger Node: Active and Certified
            </div>
          </div>
        </div>

      </div>
      </>
    )}

    </div>
  );
}
