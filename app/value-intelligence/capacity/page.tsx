"use client";

import { useState, useMemo } from "react";
import { isDemoMode } from "@/lib/demo";
import ValueIntelligenceEmptyState from "@/components/value-engine/ValueIntelligenceEmptyState";
import ValueHeader from "@/components/value-engine/ValueHeader";
import GlassCard from "@/components/ui/GlassCard";
import ValueDetailDrawer from "@/components/value-engine/ValueDetailDrawer";
import {
  Cpu,
  Zap,
  Activity,
  Info,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Building,
  Users,
  HardDrive,
  Clock,
  Shuffle
} from "lucide-react";
import clsx from "clsx";

interface CapacityNode {
  name: string;
  wasteValue: number;
  available: string;
  utilized: number;
  unused: number;
  submetrics: { label: string; value: string; percentage: number }[];
}

export default function OrganizationalCapacityIntelligencePage() {
  const [selectedRec, setSelectedRec] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "surplus" | "mismatch">("all");

  const unusedCapacityValue = 34200000; // ₦34.2M

  // Categories as specified exactly
  const capacityCategories: CapacityNode[] = [
    {
      name: "People Capacity",
      wasteValue: 9600000,
      available: "100%",
      utilized: 68,
      unused: 32,
      submetrics: [
        { label: "Available Engineers/Consultants", value: "120 Seats", percentage: 100 },
        { label: "Utilized SLA Allocations", value: "81.6 Seats", percentage: 68 },
        { label: "Unused Support Hours", value: "38.4 Seats", percentage: 32 }
      ]
    },
    {
      name: "Technology Capacity",
      wasteValue: 14200000,
      available: "100%",
      utilized: 35,
      unused: 65,
      submetrics: [
        { label: "Infrastructure Utilization", value: "35% Active Peak", percentage: 35 },
        { label: "Unused Enterprise Licenses", value: "450 Seats Idle", percentage: 45 },
        { label: "Unused Legacy Systems", value: "2 Redundant Hubs", percentage: 20 }
      ]
    },
    {
      name: "Facilities",
      wasteValue: 4800000,
      available: "100%",
      utilized: 42,
      unused: 58,
      submetrics: [
        { label: "Available Workspace capacity", value: "300 Floor Seats", percentage: 100 },
        { label: "Used corporate physical seats", value: "126 Active Seats", percentage: 42 }
      ]
    },
    {
      name: "Operations",
      wasteValue: 5600000,
      available: "100%",
      utilized: 74,
      unused: 26,
      submetrics: [
        { label: "Execution Throughput rate", value: "74% Peak Flow", percentage: 74 },
        { label: "Queue Bottlenecks rate", value: "12% Queue Idle", percentage: 12 },
        { label: "Idle clearing floats capacity", value: "14% Float latency", percentage: 14 }
      ]
    }
  ];

  // Specific Regional mismatch nodes for Capacity Map representation
  const regionalMismatches = [
    {
      region: "Region A (Lagos Branch)",
      role: "Surplus Capacity Node",
      metric: "18% Unused Operational Capacity",
      status: "SURPLUS",
      color: "text-gold border-gold/30 bg-gold/5"
    },
    {
      region: "Region B (Abuja Branch)",
      role: "SLA Deficit Node",
      metric: "Operating Above Target (108% capacity)",
      status: "BOTTLENECK",
      color: "text-red-400 border-red-500/25 bg-red-500/5"
    }
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

  const handleOpenDetail = (cat: CapacityNode) => {
    setSelectedRec({
      title: `${cat.name} Realignment Play`,
      value: formatNaira(cat.wasteValue),
      confidence: 91,
      businessArea: cat.name.toUpperCase(),
      whyIdentified: `Continuous telemetry tracked active ${cat.name} utilization patterns averaging ${cat.utilized}% capacity over the past 30 days.`,
      evidence: `Active scanning flagged a structural ${cat.unused}% mismatch between available capacity and active demand loads.`,
      recommendedAction: `Reallocate unutilized resources and snapshot legacy licenses to secure current baseline performance.`,
      expectedOutcome: `Reclaims ${formatNaira(cat.wasteValue)} in latent enterprise overhead with zero additional expansion costs.`,
      executionStatus: "Actionable Optimization",
      financialImpact: `+${formatNaira(cat.wasteValue)} Annualized Reclaim`,
      auditTrail: [
        "Audit conducted by APEX ONE Resource Optimization module",
        "Validated against active CBN compliance parameters"
      ]
    });
    setDrawerOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12 select-none relative" id="capacity-intelligence-workspace">
      
      {/* Background glow shadow */}
      <div className="absolute top-[-40px] left-[15%] w-[450px] h-[450px] bg-blue-500/[0.015] blur-[120px] rounded-full pointer-events-none z-0" />

      <ValueHeader
        category="ORGANIZATIONAL CAPACITY INTELLIGENCE"
        title="ORGANIZATIONAL CAPACITY INTELLIGENCE"
        subtitle="Calibrate corporate resource allocation by tracking human bandwidth, physical real estate, infrastructure assets, and time latency."
      />

      {!isDemoMode() ? (
        <ValueIntelligenceEmptyState
          title="Capacity intelligence awaiting operational data"
          description="Connect operational resource logs, infrastructure metrics, and human resource systems to activate capacity tracking."
          badge="Capacity Engine Offline"
        />
      ) : (
        <>
          {/* CORE MESSAGE BLOCK */}
          <div className="rounded-xl border border-gold/15 bg-gold/[0.01] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2.5">
          <Cpu className="text-gold" size={16} />
          <div>
            <p className="text-[12px] font-mono font-bold text-gold uppercase tracking-wider">CORE OPTIMIZATION PRINCIPLE</p>
            <p className="text-[13px] font-semibold text-ivory mt-0.5">&ldquo;Before buying more capacity, understand the capacity you already have.&rdquo;</p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-ivory/45 sm:text-right">
          Monitoring: 12 global corporate nodes · Continuous resource sweep
        </div>
      </div>

      {/* RECLAIMABLE CAPACITY HERO */}
      <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-6 md:p-8 shadow-3xl overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10">
          <div>
            <span className="inline-flex rounded px-2.5 py-0.5 bg-gold/10 border border-gold/20 text-[9.5px] font-mono text-gold uppercase tracking-wider font-bold mb-3">
              Unused Capacity Value
            </span>
            <h1 className="font-display text-[46px] md:text-[60px] font-extrabold text-ivory tracking-tight leading-none font-mono">
              {formatNaira(unusedCapacityValue)}
            </h1>
            <p className="mt-2.5 text-[12.5px] uppercase font-mono tracking-wider text-gold/80 font-bold">Reclaimable organizational capacity.</p>
            <p className="mt-3.5 text-[13px] text-ivory/50 max-w-xl leading-relaxed">
              APEX ONE scans active computing clouds, human schedules, facility spaces, and operational execution flows to highlight unutilized overhead that can be reallocated immediately.
            </p>
          </div>

          {/* Specified Category Breaks */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            {[
              { label: "People capacity", val: 9600000 },
              { label: "Technology assets", val: 14200000 },
              { label: "Facilities/spaces", val: 4800000 },
              { label: "Operations float", val: 5600000 }
            ].map((item, idx) => (
              <div key={idx} className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl min-w-[130px]">
                <span className="text-[9.5px] font-mono text-ivory/35 uppercase tracking-wider block">{item.label}</span>
                <span className="text-[14px] font-bold font-mono block mt-1 text-gold">
                  {formatNaira(item.val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI RECOMMENDATION ADVISOR PANEL (Region A vs Region B) */}
      <div className="rounded-2xl border border-gold/15 bg-gold/[0.01] p-5 shadow-glass space-y-4">
        <div className="border-b border-white/[0.04] pb-2.5 flex items-center gap-1.5">
          <Zap size={14} className="text-gold" />
          <h3 className="text-[12.5px] font-mono font-bold text-gold uppercase tracking-wider">AI CAPACITY ALLOCATION ADVISOR</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-8 space-y-3.5">
            <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-xl text-[13.5px] text-ivory/85 leading-relaxed">
              <span className="text-[10px] font-mono text-gold uppercase tracking-wider block font-bold mb-1.5">SURPLUS VS DEFICIT ANALYSIS</span>
              &ldquo;Region A has 18% unused operational capacity while Region B is operating above target utilization. Reallocate workload before adding additional resources.&rdquo;
            </div>
            <div className="text-[12.5px] text-ivory/70 font-serif italic">
              <strong>Action Playbook:</strong> Automatically route Abuja advisory backlog overflow tickets to Lagos queue logs.
            </div>
          </div>

          <div className="lg:col-span-4 bg-white/[0.01] border border-white/[0.04] p-4 rounded-xl flex justify-between items-center">
            <div>
              <span className="text-[10px] font-mono text-ivory/35 uppercase tracking-wider block">Estimated Value</span>
              <span className="text-[20px] font-mono font-bold text-emerald">₦8.4M Saved</span>
              <span className="text-[9px] text-emerald/60 font-mono block mt-0.5 font-bold">Avoided new hire costs</span>
            </div>
            <span className="rounded px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/15 text-[10px] font-mono text-emerald font-bold uppercase">
              91% Conf.
            </span>
          </div>
        </div>
      </div>

      {/* CAPACITY ROUTING MAP */}
      <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-2.5">
          <div className="flex items-center gap-1.5">
            <Shuffle size={14} className="text-gold" />
            <h3 className="text-[12px] font-mono font-bold text-gold uppercase tracking-wider">REGIONAL CAPACITY MISMATCH ROUTING MAP</h3>
          </div>
          <span className="text-[10px] font-mono text-red-400 font-bold uppercase animate-pulse">2 Mismatches Detected</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 p-5 bg-white/[0.01] border border-white/[0.04] rounded-xl">
          {/* Lagos Surplus */}
          <div className={clsx("flex-1 p-4 rounded-xl border w-full text-left", regionalMismatches[0].color)}>
            <span className="text-[9px] font-mono font-bold uppercase text-gold">{regionalMismatches[0].status}</span>
            <h4 className="text-[14px] font-bold text-ivory mt-1">{regionalMismatches[0].region}</h4>
            <p className="text-[12px] text-ivory/60 mt-1 font-mono">{regionalMismatches[0].metric}</p>
          </div>

          {/* Interactive Routing Bridge */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="text-[10px] font-mono text-[#c9a961] font-bold uppercase">REALLOCATION PATH</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gold animate-ping" />
              <div className="w-[120px] h-[1px] bg-gradient-to-r from-gold via-gold/30 to-red-400" />
              <ArrowRight size={13} className="text-red-400 animate-pulse" />
            </div>
            <span className="text-[9.5px] font-mono text-ivory/30">Target: Balancing Load</span>
          </div>

          {/* Abuja Deficit */}
          <div className={clsx("flex-1 p-4 rounded-xl border w-full text-left", regionalMismatches[1].color)}>
            <span className="text-[9px] font-mono font-bold uppercase text-red-400">{regionalMismatches[1].status}</span>
            <h4 className="text-[14px] font-bold text-ivory mt-1">{regionalMismatches[1].region}</h4>
            <p className="text-[12px] text-ivory/60 mt-1 font-mono">{regionalMismatches[1].metric}</p>
          </div>
        </div>
      </div>

      {/* SPECIFIED CATEGORIES GRID (PEOPLE, TECHNOLOGY, FACILITIES, OPERATIONS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {capacityCategories.map((cat, idx) => (
          <div key={idx} className="rounded-2xl border border-white/[0.04] bg-white/[0.005] p-5 shadow-glass flex flex-col justify-between space-y-5 text-left">
            <div>
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 mb-4">
                <h3 className="font-display text-[16px] font-bold text-ivory tracking-tight">{cat.name}</h3>
                <span className="text-xs font-mono font-bold text-red-400">Overhead: {formatNaira(cat.wasteValue)}</span>
              </div>

              {/* THREE-STAGE UTILIZATION METERS */}
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[11px] font-mono text-ivory/40">
                  <span>Available: 100%</span>
                  <span>Utilized: {cat.utilized}%</span>
                  <span>Unused: {cat.unused}%</span>
                </div>

                <div className="w-full bg-white/[0.03] h-3 rounded-full overflow-hidden flex border border-white/[0.05]">
                  {/* Utilized segment */}
                  <div
                    className="bg-gold h-full transition-all duration-500"
                    style={{ width: `${cat.utilized}%` }}
                    title={`Utilized: ${cat.utilized}%`}
                  />
                  {/* Unused segment */}
                  <div
                    className="bg-red-400/30 h-full transition-all duration-500"
                    style={{ width: `${cat.unused}%` }}
                    title={`Unused: ${cat.unused}%`}
                  />
                </div>

                {/* Submetrics list */}
                <div className="space-y-2 pt-1 border-t border-white/[0.03]">
                  {cat.submetrics.map((sub, sIdx) => (
                    <div key={sIdx} className="flex justify-between items-center text-[11.5px] font-mono">
                      <span className="text-ivory/50">{sub.label}</span>
                      <span className="text-ivory font-bold">{sub.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3.5 border-t border-white/[0.04] flex items-center justify-between">
              <span className="text-[10px] font-mono text-ivory/30">Active sweep: Operational Ledger</span>
              <button
                onClick={() => handleOpenDetail(cat)}
                className="flex items-center gap-1.5 rounded-lg bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.06] text-ivory/80 py-1.5 px-3.5 text-[11px] font-mono font-bold transition-all cursor-pointer"
              >
                Review Recommendation
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* DETAIL VIEW DRAWER */}
      {selectedRec && (
        <ValueDetailDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={selectedRec.title}
          value={selectedRec.value}
          confidence={selectedRec.confidence}
          businessArea={selectedRec.businessArea}
          whyIdentified={selectedRec.whyIdentified}
          evidence={selectedRec.evidence}
          recommendedAction={selectedRec.recommendedAction}
          expectedOutcome={selectedRec.expectedOutcome}
          executionStatus={selectedRec.executionStatus}
          financialImpact={selectedRec.financialImpact}
          auditTrail={selectedRec.auditTrail}
        />
      )}
        </>
      )}
    </div>
  );
}
