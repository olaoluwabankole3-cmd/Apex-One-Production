"use client";

import { useState, useMemo } from "react";
import { isDemoMode } from "@/lib/demo";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Cpu, 
  Sparkles, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Users, 
  Server, 
  Building,
  ArrowRight,
  ChevronRight,
  Info
} from "lucide-react";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";
import { useRole } from "@/components/layout/RoleContext";
import { company } from "@/lib/organizationConfig";


// Type definitions for operations intelligence
interface Bottleneck {
  id: string;
  process: string;
  department: string;
  delayDays: number;
  cases: number;
  costImpactNaira: number; // in Millions/month
  recommendedAction: string;
  status: "stuck" | "optimizing" | "resolved";
}

interface CapacityMetric {
  id: string;
  category: "People" | "Technology" | "Facilities" | "Operations";
  available: number; // percentage
  used: number; // percentage
  unused: number; // percentage
  overloaded: number; // percentage
}

interface IncidentDetail {
  id: string;
  title: string;
  subsidiary: string;
  severity: "critical" | "high" | "medium";
  whatHappened: string;
  whyItHappened: string;
  systemsInvolved: string[];
  whoIsAffected: string;
  financialImpactNaira: number; // In Millions
  recommendedAction: string;
  status: "open" | "investigating" | "resolved";
}

interface PerformanceYear {
  year: number;
  days: number;
}

export default function OperationsIntelligencePage() {
  const { role } = useRole();

  // 1. State for Bottlenecks
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([
    {
      id: "bot-1",
      process: "Claims Review",
      department: "Customer Operations Claims",
      delayDays: 2.8,
      cases: 1842,
      costImpactNaira: 3.8,
      recommendedAction: "Deploy Claims Automation Phase 2 Vetting Module to bypass manual signature triggers.",
      status: "stuck"
    },
    {
      id: "bot-2",
      process: "Compliance KYC Scans",
      department: "Enterprise Operations Risk division",
      delayDays: 4.2,
      cases: 142,
      costImpactNaira: 6.1,
      recommendedAction: "Auto-ingest KYC files using digital registry scraper to eliminate CSV backlogs.",
      status: "stuck"
    },
    {
      id: "bot-3",
      process: "Portfolio Settlement Lock",
      department: "Strategic Accounts Custody",
      delayDays: 1.5,
      cases: 89,
      costImpactNaira: 2.4,
      recommendedAction: "Reallocate idle capital clearance desks from retail audit to corporate settlement queues.",
      status: "stuck"
    }
  ]);

  // 2. Initial Capacity metrics
  const [capacityMetrics, setCapacityMetrics] = useState<CapacityMetric[]>([
    { id: "cap-1", category: "People", available: 100, used: 65, unused: 15, overloaded: 20 },
    { id: "cap-2", category: "Technology", available: 100, used: 78, unused: 18, overloaded: 4 },
    { id: "cap-3", category: "Facilities", available: 100, used: 55, unused: 45, overloaded: 0 },
    { id: "cap-4", category: "Operations", available: 100, used: 72, unused: 8, overloaded: 20 }
  ]);

  const [capacityOptimized, setCapacityOptimized] = useState<boolean>(false);

  // 3. Incidents intelligence
  const [incidents, setIncidents] = useState<IncidentDetail[]>([
    {
      id: "INC-9481",
      title: "Reinsurance Clearing Bottleneck",
      subsidiary: "Customer Operations",
      severity: "critical",
      whatHappened: "A sudden peak in high-value claims triggered a cascading delay in our automated reinsurance brokerage clearing ledger.",
      whyItHappened: "A manual override was introduced during a secondary audit, causing a lockup in standard database pipelines.",
      systemsInvolved: ["ClaimSentry API", "Apex Reledger Sync v4"],
      whoIsAffected: "28 high-priority logistics and corporate underwriting partners.",
      financialImpactNaira: 4.8, // ₦4.8M
      recommendedAction: "Deploy automatic ledger reconciliation clearing script to bypass manual interlocks.",
      status: "open"
    },
    {
      id: "INC-9482",
      title: "KYC Automated Validation Fault",
      subsidiary: "Enterprise Operations",
      severity: "high",
      whatHappened: "Federal identity registry API experienced transient outages, failing 38% of onboarding KYC runs.",
      whyItHappened: "Missing failover endpoints in the security validation module caused scans to timeout silently.",
      systemsInvolved: ["IDVerify Hub", "RiskScorer Base"],
      whoIsAffected: "142 institutional clearing prospects waiting for terminal setup.",
      financialImpactNaira: 3.1, // ₦3.1M
      recommendedAction: "Configure alternative registry cache server with 24-hour verification delay buffers.",
      status: "investigating"
    },
    {
      id: "INC-9483",
      title: "Multi-Signature Asset Settlement Delay",
      subsidiary: "Strategic Accounts",
      severity: "medium",
      whatHappened: "Corporate portfolio allocation approvals stalled due to signing credential mismatches.",
      whyItHappened: "A software update changed key metadata properties, causing the authorization webhook to fail validation.",
      systemsInvolved: ["ApexSign Secure", "PortfolioClear engine"],
      whoIsAffected: "3 private family office advisory accounts.",
      financialImpactNaira: 1.5, // ₦1.5M
      recommendedAction: "Flush authentication metadata cache and force security properties rollback.",
      status: "open"
    }
  ]);

  const [selectedIncidentId, setSelectedIncidentId] = useState<string>("INC-9481");

  // 4. Process Memory Data Selector
  const [selectedProcess, setSelectedProcess] = useState<"Claims Processing" | "KYC Validation" | "Asset Settlement">("Claims Processing");

  const processMemoryData: Record<"Claims Processing" | "KYC Validation" | "Asset Settlement", { history: PerformanceYear[], commentary: string }> = {
    "Claims Processing": {
      history: [
        { year: 2022, days: 4.1 },
        { year: 2023, days: 3.7 },
        { year: 2024, days: 3.2 },
        { year: 2025, days: 2.8 },
        { year: 2026, days: 3.4 }
      ],
      commentary: "Performance improved for four years before reversing in Q2 2026. This reversal was directly caused by the implementation of manual verification overrides on reinsurance claims, which added an average of 18 hours of administrative lag per file."
    },
    "KYC Validation": {
      history: [
        { year: 2022, days: 6.8 },
        { year: 2023, days: 5.9 },
        { year: 2024, days: 4.5 },
        { year: 2025, days: 3.1 },
        { year: 2026, days: 4.8 }
      ],
      commentary: "Onboarding speeds improved consistently for four years through digital ingestion, before reversing in mid-2026 due to transient federal registry API downtime and a backlog in manual security validation sweeps."
    },
    "Asset Settlement": {
      history: [
        { year: 2022, days: 3.2 },
        { year: 2023, days: 2.9 },
        { year: 2024, days: 2.1 },
        { year: 2025, days: 1.4 },
        { year: 2026, days: 2.6 }
      ],
      commentary: "Settle times fell to a record low of 1.4 days in late 2025. This success was offset in 2026 by multi-signature authorization mismatches and liquidity matching queues inside our capital custody divisions."
    }
  };

  // 5. Simulated Actions
  const handleResolveBottleneck = (id: string) => {
    setBottlenecks(prev => prev.map(bot => {
      if (bot.id === id) {
        return { ...bot, status: "resolved", delayDays: 0.2, costImpactNaira: 0.1 };
      }
      return bot;
    }));
  };

  const handleOptimizeCapacity = () => {
    setCapacityOptimized(true);
    // Simulate reallocating people and operational workloads
    setCapacityMetrics(prev => prev.map(metric => {
      if (metric.category === "People") {
        return { ...metric, used: 80, unused: 20, overloaded: 0 };
      }
      if (metric.category === "Operations") {
        return { ...metric, used: 75, unused: 25, overloaded: 0 };
      }
      return metric;
    }));
  };

  const handleResolveIncident = (id: string) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === id) {
        return { ...inc, status: "resolved" };
      }
      return inc;
    }));
  };

  // 6. Dynamic aggregations for KPI top metrics
  const kpis = useMemo(() => {
    // Basic sums
    const totalStuck = bottlenecks.filter(b => b.status === "stuck").length;
    const unresolvedIncidents = incidents.filter(i => i.status !== "resolved").length;
    const activeRisk = totalStuck * 12 + unresolvedIncidents * 18;

    return {
      operationalHealth: 94.2 - (unresolvedIncidents * 1.5) - (totalStuck * 1.2),
      openIncidents: unresolvedIncidents,
      slaCompliance: 98.4 - (totalStuck * 0.3),
      avgResolutionHours: 2.4 + (unresolvedIncidents * 0.4),
      automationCoverage: 71 + (bottlenecks.filter(b => b.status === "resolved").length * 8),
      riskScore: activeRisk
    };
  }, [bottlenecks, incidents]);

  const activeIncident = useMemo(() => {
    return incidents.find(i => i.id === selectedIncidentId) || incidents[0];
  }, [incidents, selectedIncidentId]);

  return (
    <InternalOnlyShield>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-gold/70 font-mono">
              APEX ONE · Operations Intelligence
            </p>
            <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-ivory lg:text-[32px] uppercase">
              Operations Intelligence Center
            </h1>
            <p className="mt-1.5 text-[13.5px] text-ivory/50">
              Diagnostic operational performance, capacity optimization engines, and active bottleneck resolution systems.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.08] px-3.5 py-1.5 text-[12px] font-mono text-gold/80">
            <span className="h-2 w-2 rounded-full bg-emerald animate-pulse" />
            Active Role: <span className="font-bold text-ivory">{role}</span>
          </div>
        </div>

        {!isDemoMode() ? (
          <div className="rounded-2xl border border-white/[0.08] bg-charcoal/40 p-12 text-center shadow-glass flex flex-col items-center justify-center min-h-[400px]">
            <div className="h-16 w-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-4">
              <Activity size={28} />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-mono tracking-wide uppercase bg-white/[0.04] border border-white/[0.08] text-ivory/60 mb-3">
              Telemetry Inactive
            </span>
            <h3 className="font-display text-xl font-bold text-ivory">Operations intelligence awaiting data</h3>
            <p className="mt-2 text-sm text-ivory/50 max-w-md">
              Operational bottlenecks, incident diagnostics, capacity utilization matrices, and SLA throughput metrics will populate once live telemetry is connected.
            </p>
          </div>
        ) : (
          <>
            {/* ────────────────── TOP SUMMARY SUMMARY ────────────────── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" id="ops-summary-metrics">
          {/* Operational Health */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4 shadow-glass-flat">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">Operational Health</span>
              <Activity size={14} className="text-emerald" />
            </div>
            <p className="mt-1.5 font-display text-[22px] font-bold text-ivory">{kpis.operationalHealth.toFixed(1)}%</p>
            <p className="mt-1 text-[10.5px] text-ivory/45 font-mono">System composite speed</p>
          </div>

          {/* Open Incidents */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4 shadow-glass-flat">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">Open Incidents</span>
              <AlertTriangle size={14} className={kpis.openIncidents > 0 ? "text-crimson" : "text-emerald"} />
            </div>
            <p className="mt-1.5 font-display text-[22px] font-bold text-ivory">{kpis.openIncidents}</p>
            <p className="mt-1 text-[10.5px] text-crimson/70 font-mono">Active resolution load</p>
          </div>

          {/* SLA Compliance */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4 shadow-glass-flat">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">SLA Compliance</span>
              <ShieldCheck size={14} className="text-emerald" />
            </div>
            <p className="mt-1.5 font-display text-[22px] font-bold text-ivory">{kpis.slaCompliance.toFixed(1)}%</p>
            <p className="mt-1 text-[10.5px] text-emerald font-mono flex items-center gap-0.5">
              <TrendingUp size={10} /> Target: 98.0%
            </p>
          </div>

          {/* Average Resolution Time */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4 shadow-glass-flat">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">Avg Resolve Time</span>
              <Clock size={14} className="text-gold" />
            </div>
            <p className="mt-1.5 font-display text-[22px] font-bold text-ivory">{kpis.avgResolutionHours.toFixed(1)}h</p>
            <p className="mt-1 text-[10.5px] text-ivory/40 font-mono">-12% MoM reduction</p>
          </div>

          {/* Automation Coverage */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4 shadow-glass-flat">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">Automation Coverage</span>
              <Cpu size={14} className="text-gold" />
            </div>
            <p className="mt-1.5 font-display text-[22px] font-bold text-ivory">{kpis.automationCoverage}%</p>
            <p className="mt-1 text-[10.5px] text-gold/80 font-mono">Automated workflow routes</p>
          </div>

          {/* Operational Risk */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4 shadow-glass-flat">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">Operational Risk</span>
              <AlertCircle size={14} className={kpis.riskScore >= 40 ? "text-crimson" : "text-emerald"} />
            </div>
            <p className="mt-1.5 font-display text-[20px] font-bold uppercase text-ivory">
              {kpis.riskScore >= 50 ? "Moderate" : "Minimal"}
            </p>
            <p className="mt-1 text-[10.5px] text-ivory/45 font-mono">Index: {kpis.riskScore}/100</p>
          </div>
        </div>

        {/* ────────────────── AI OPERATIONAL INSIGHT BANNER ────────────────── */}
        <div className="rounded-xl border border-gold/30 bg-gold/[0.03] p-4 shadow-gold-glow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3 items-start">
            <Sparkles size={18} className="text-gold shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-gold font-mono">APEX ONE OPERATIONAL DECISION COGNITION</h3>
              <p className="text-[13.5px] text-ivory/90 font-mono leading-relaxed mt-1">
                &ldquo;Three operational bottlenecks account for approximately 61% of current processing delays. Deploying recommended automated clearings will salvage ₦12.3M/month in overhead drag.&rdquo;
              </p>
            </div>
          </div>
          
          {/* Visual block breakdown representing the bottlenecks */}
          <div className="flex flex-col gap-1.5 bg-white/[0.03] border border-white/[0.05] p-3 rounded-lg min-w-[200px]">
            <p className="text-[10px] font-mono text-ivory/40 uppercase tracking-wider">Delay Distribution (61% Contribution)</p>
            <div className="flex h-2.5 w-full bg-white/5 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-gold" style={{ width: "45%" }} title="Claims Review: 45%" />
              <div className="h-full bg-crimson" style={{ width: "35%" }} title="Compliance KYC: 35%" />
              <div className="h-full bg-emerald" style={{ width: "20%" }} title="Settlement Lock: 20%" />
            </div>
            <div className="flex justify-between text-[9px] text-ivory/40 font-mono mt-0.5">
              <span>Claims (45%)</span>
              <span>KYC (35%)</span>
              <span>Custody (20%)</span>
            </div>
          </div>
        </div>

        {/* ────────────────── ORGANIZATIONAL BOTTLENECKS (WHERE WORK IS STUCK) ────────────────── */}
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-5 shadow-glass" id="operations-bottlenecks-board">
          <div className="flex justify-between items-center border-b border-white/[0.05] pb-3">
            <div>
              <h2 className="font-display text-[17px] font-bold text-ivory tracking-tight uppercase">WHERE WORK IS GETTING STUCK</h2>
              <p className="text-[11.5px] text-ivory/40 mt-0.5">Top organizational bottlenecks causing active structural friction across subsidiaries</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-[9.5px] font-mono uppercase bg-white/5 border border-white/10 px-2 py-0.5 rounded text-ivory/60">
                Active Audit Feed
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {bottlenecks.map((bot) => {
              const isStuck = bot.status === "stuck";
              return (
                <div 
                  key={bot.id} 
                  className={`rounded-xl border p-4.5 flex flex-col justify-between transition-all ${
                    isStuck 
                      ? "bg-white/[0.02] border-white/[0.06]" 
                      : "bg-emerald/[0.02] border-emerald/30 shadow-emerald-glow"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-[10px] font-mono text-gold/70 uppercase tracking-wider">{bot.department}</p>
                        <h4 className="font-display text-[15px] font-bold text-ivory mt-0.5">{bot.process}</h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold font-mono uppercase ${
                        isStuck 
                          ? "bg-crimson/10 border border-crimson/25 text-crimson animate-pulse" 
                          : "bg-emerald/10 border border-emerald/25 text-emerald"
                      }`}>
                        {isStuck ? "Stuck" : "Resolved"}
                      </span>
                    </div>

                    {/* Bottleneck stats */}
                    <div className="mt-4 grid grid-cols-3 gap-2 border-y border-white/[0.04] py-2.5 text-center">
                      <div>
                        <p className="text-[9px] font-mono text-ivory/40 uppercase">AVG DELAY</p>
                        <p className={`text-[13.5px] font-mono font-bold mt-0.5 ${isStuck ? "text-crimson" : "text-emerald"}`}>
                          {bot.delayDays} Days
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-mono text-ivory/40 uppercase">AFFECTED VOLUME</p>
                        <p className="text-[13.5px] font-mono font-bold text-ivory mt-0.5">{bot.cases} cases</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-mono text-ivory/40 uppercase">EST. DRAG</p>
                        <p className={`text-[13.5px] font-mono font-bold mt-0.5 ${isStuck ? "text-gold" : "text-emerald"}`}>
                          ₦{bot.costImpactNaira}M/mo
                        </p>
                      </div>
                    </div>

                    {/* Action directive description */}
                    <div className="mt-3.5 space-y-1">
                      <span className="text-[9.5px] font-mono uppercase text-gold/70 font-semibold flex items-center gap-1">
                        <Info size={11} /> Recommended Action:
                      </span>
                      <p className="text-[11.5px] text-ivory/70 leading-relaxed font-mono">{bot.recommendedAction}</p>
                    </div>
                  </div>

                  {/* Operational trigger button */}
                  <div className="mt-5 pt-3.5 border-t border-white/[0.04]">
                    {isStuck ? (
                      <button
                        onClick={() => handleResolveBottleneck(bot.id)}
                        className="w-full text-center rounded-lg bg-gold/10 hover:bg-gold/15 border border-gold/30 hover:border-gold/50 px-3.5 py-1.5 text-[11.5px] font-mono font-bold text-gold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Zap size={11} /> Optimize & Deploy Directive
                      </button>
                    ) : (
                      <div className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald/5 border border-emerald/20 px-3.5 py-1.5 text-[11.5px] font-mono text-emerald">
                        <CheckCircle2 size={12} /> Optimization Successful
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ────────────────── TWO SECTION ROW: CAPACITY & PROCESS MEMORY ────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          
          {/* CAPACITY INTELLIGENCE */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-5 shadow-glass" id="capacity-intelligence-widget">
            <div className="flex justify-between items-start border-b border-white/[0.05] pb-3">
              <div>
                <h2 className="font-display text-[17px] font-bold text-ivory tracking-tight uppercase">CAPACITY INTELLIGENCE</h2>
                <p className="text-[11.5px] text-ivory/40 mt-0.5">Cross-allocation metrics linking human staff, server workloads, and brick facilities</p>
              </div>
              <button
                disabled={capacityOptimized}
                onClick={handleOptimizeCapacity}
                className={`px-3 py-1 text-[11px] font-mono font-bold rounded-lg transition-all ${
                  capacityOptimized 
                    ? "bg-emerald/10 text-emerald border border-emerald/20" 
                    : "bg-gold-gradient hover:shadow-gold-glow text-matte cursor-pointer"
                }`}
              >
                {capacityOptimized ? "Optimized" : "Optimize Capacity"}
              </button>
            </div>

            {/* Capacity bars breakdown */}
            <div className="mt-5 space-y-4">
              {capacityMetrics.map((cap) => {
                const Icon = cap.category === "People" ? Users : cap.category === "Technology" ? Server : cap.category === "Facilities" ? Building : Activity;
                return (
                  <div key={cap.id} className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-4.5">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded bg-gold/10 text-gold border border-gold/20">
                          <Icon size={12} />
                        </span>
                        <span className="text-[12.5px] font-bold text-ivory">{cap.category} Asset allocation</span>
                      </div>
                      <div className="flex gap-3 text-[10.5px] font-mono">
                        <span className="text-emerald font-semibold">Idle: {cap.unused}%</span>
                        {cap.overloaded > 0 && <span className="text-crimson font-bold animate-pulse">Overloaded: {cap.overloaded}%</span>}
                        <span className="text-ivory/40">Used: {cap.used}%</span>
                      </div>
                    </div>

                    {/* Progress Slider segments */}
                    <div className="flex h-3 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gold" style={{ width: `${cap.used}%` }} title={`Used: ${cap.used}%`} />
                      <div className="h-full bg-emerald" style={{ width: `${cap.unused}%` }} title={`Idle: ${cap.unused}%`} />
                      <div className="h-full bg-crimson" style={{ width: `${cap.overloaded}%` }} title={`Overloaded: ${cap.overloaded}%`} />
                    </div>

                    {/* Interactive re-balancing micro feedback */}
                    {cap.overloaded > 0 ? (
                      <p className="text-[10px] text-crimson font-mono mt-1.5 flex items-center gap-1 leading-snug">
                        <AlertTriangle size={11} /> Friction active: Reallocation of idle capacity strongly recommended.
                      </p>
                    ) : (
                      <p className="text-[10px] text-emerald font-mono mt-1.5 flex items-center gap-1 leading-snug">
                        <CheckCircle2 size={11} /> Asset allocation running at optimized efficiency.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* PROCESS MEMORY */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-5 shadow-glass flex flex-col justify-between" id="process-memory-widget">
            <div>
              <div className="flex justify-between items-start border-b border-white/[0.05] pb-3">
                <div>
                  <h2 className="font-display text-[17px] font-bold text-ivory tracking-tight uppercase">OPERATIONAL PROCESS MEMORY</h2>
                  <p className="text-[11.5px] text-ivory/40 mt-0.5">Historical multi-year performance audits identifying processing speed drift</p>
                </div>
                <select
                  value={selectedProcess}
                  onChange={(e) => setSelectedProcess(e.target.value as any)}
                  className="bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-gold rounded p-1 outline-none"
                >
                  <option value="Claims Processing">Claims Processing</option>
                  <option value="KYC Validation">KYC Automated Scan</option>
                  <option value="Asset Settlement">Asset Settlement Lock</option>
                </select>
              </div>

              {/* Graphic vertical display comparing years 2022 to 2026 */}
              <div className="mt-5 grid grid-cols-5 gap-2 items-end h-[160px] bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl">
                {processMemoryData[selectedProcess].history.map((pt) => {
                  const maxDays = Math.max(...processMemoryData[selectedProcess].history.map(h => h.days));
                  const percentageHeight = (pt.days / maxDays) * 100;
                  const isCurrentYear = pt.year === 2026;
                  
                  return (
                    <div key={pt.year} className="flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[10.5px] font-mono text-ivory/60">{pt.days}d</span>
                      <div 
                        className={`w-full rounded-t-md transition-all duration-500 ${
                          isCurrentYear 
                            ? "bg-crimson/50 border-t border-crimson shadow-crimson-glow-soft" 
                            : "bg-gold/20 border-t border-gold/40"
                        }`} 
                        style={{ height: `${percentageHeight - 20}%` }}
                      />
                      <span className={`text-[11px] font-mono ${isCurrentYear ? "text-crimson font-bold" : "text-ivory/40"}`}>
                        {pt.year}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Explicit AI Operational Commentary */}
            <div className="mt-4 rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-[12px] leading-relaxed text-ivory/80 font-mono">
              <span className="text-gold font-bold uppercase block mb-1">AI Contextual Analysis:</span>
              &ldquo;{processMemoryData[selectedProcess].commentary}&rdquo;
            </div>
          </div>

        </div>

        {/* ────────────────── INCIDENT INTELLIGENCE HUB ────────────────── */}
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-5 shadow-glass" id="operations-incidents-panel">
          <div className="flex justify-between items-center border-b border-white/[0.05] pb-3">
            <div>
              <h2 className="font-display text-[17px] font-bold text-ivory tracking-tight uppercase">INCIDENT INTELLIGENCE</h2>
              <p className="text-[11.5px] text-ivory/40 mt-0.5">Deep risk analysis of operational interruptions across group ledger nodes</p>
            </div>
            <span className="text-[10px] font-mono bg-white/5 border border-white/10 px-2.5 py-0.5 rounded text-gold/80">
              Active Queue: {incidents.filter(i => i.status !== "resolved").length} Serious Issues
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
            
            {/* Left selector menu of incident cards */}
            <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1 scrollbar-none">
              {incidents.map((inc) => {
                const isSelected = inc.id === selectedIncidentId;
                const isResolved = inc.status === "resolved";
                return (
                  <button
                    key={inc.id}
                    onClick={() => setSelectedIncidentId(inc.id)}
                    className={`w-full text-left rounded-xl border p-3 flex flex-col gap-1 transition-all ${
                      isSelected 
                        ? "bg-white/[0.06] border-gold/50 shadow-gold-glow-soft" 
                        : "bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[9.5px] font-mono text-gold/70 font-semibold">{inc.id}</span>
                      <span className={`px-1.5 py-0.1 rounded text-[8px] font-bold font-mono uppercase ${
                        inc.severity === "critical" 
                          ? "bg-crimson/10 border border-crimson/25 text-crimson" 
                          : "bg-amber/10 border border-amber/25 text-amber"
                      }`}>
                        {inc.severity}
                      </span>
                    </div>
                    <h4 className="text-[12.5px] font-bold text-ivory truncate mt-0.5">{inc.title}</h4>
                    <p className="text-[10.5px] text-ivory/45">{inc.subsidiary}</p>
                    
                    <div className="mt-2 flex justify-between items-center text-[9.5px] font-mono border-t border-white/[0.03] pt-2">
                      <span className="text-ivory/40">Status:</span>
                      <span className={isResolved ? "text-emerald" : "text-amber"}>{inc.status}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right details dossier layout */}
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-5 relative overflow-hidden flex flex-col justify-between">
              
              <div>
                {/* Dossier Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.04] pb-4">
                  <div>
                    <span className="text-[10px] font-mono text-gold/70 uppercase font-semibold">{activeIncident.id} · {activeIncident.subsidiary}</span>
                    <h3 className="font-display text-[16.5px] font-bold text-ivory mt-0.5">{activeIncident.title}</h3>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2.5 py-0.5 text-[10px] font-bold font-mono uppercase ${
                      activeIncident.severity === "critical" 
                        ? "bg-crimson/10 border border-crimson/25 text-crimson animate-pulse" 
                        : "bg-amber/10 border border-amber/25 text-amber"
                    }`}>
                      {activeIncident.severity} Severity
                    </span>
                    <span className={`rounded px-2.5 py-0.5 text-[10px] font-bold font-mono uppercase ${
                      activeIncident.status === "resolved" 
                        ? "bg-emerald/10 border border-emerald/25 text-emerald" 
                        : "bg-amber/10 border border-amber/25 text-amber"
                    }`}>
                      {activeIncident.status}
                    </span>
                  </div>
                </div>

                {/* Dossier core content */}
                <div className="mt-4 space-y-4">
                  {/* Section 1: What & Why */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg bg-white/[0.01] border border-white/[0.03] p-3.5">
                      <span className="text-[9.5px] font-mono text-gold/60 uppercase tracking-wider font-semibold">What Happened:</span>
                      <p className="text-[11.5px] text-ivory/80 leading-relaxed font-mono mt-1">{activeIncident.whatHappened}</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.01] border border-white/[0.03] p-3.5">
                      <span className="text-[9.5px] font-mono text-gold/60 uppercase tracking-wider font-semibold">Why It Happened:</span>
                      <p className="text-[11.5px] text-ivory/80 leading-relaxed font-mono mt-1">{activeIncident.whyItHappened}</p>
                    </div>
                  </div>

                  {/* Section 2: Technical specifications & impact */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-y border-white/[0.04] py-3.5">
                    <div>
                      <span className="text-[9.5px] font-mono text-ivory/40 uppercase">Systems Involved:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {activeIncident.systemsInvolved.map((sys) => (
                          <span key={sys} className="rounded bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 text-[9.5px] font-mono text-ivory/70">
                            {sys}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[9.5px] font-mono text-ivory/40 uppercase">Impacted Cohorts:</span>
                      <p className="text-[11px] text-ivory/80 font-mono mt-1">{activeIncident.whoIsAffected}</p>
                    </div>
                    <div>
                      <span className="text-[9.5px] font-mono text-ivory/40 uppercase font-bold text-gold">Financial Drag:</span>
                      <p className="text-[13.5px] font-mono font-bold text-gold mt-0.5">₦{activeIncident.financialImpactNaira}M</p>
                    </div>
                  </div>

                  {/* Section 3: Recommended Action */}
                  <div className="rounded-lg bg-gold/[0.02] border border-gold/15 p-3.5">
                    <span className="text-[9.5px] font-mono text-gold uppercase tracking-wider font-bold">Recommended Mitigation Directive:</span>
                    <p className="text-[12.5px] text-ivory/80 font-mono mt-1 leading-relaxed">{activeIncident.recommendedAction}</p>
                  </div>
                </div>
              </div>

              {/* Dossier footer triggers */}
              <div className="mt-6 pt-4 border-t border-white/[0.04] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <span className="text-[10.5px] text-ivory/40 font-mono">
                  Confirm operations audit checks before resolving incidents.
                </span>
                
                {activeIncident.status !== "resolved" ? (
                  <button
                    onClick={() => handleResolveIncident(activeIncident.id)}
                    className="rounded-lg bg-gold-gradient hover:shadow-gold-glow text-matte font-bold text-[11.5px] px-5 py-2 transition-all font-mono flex items-center justify-center gap-1"
                  >
                    Resolve Incident & Log Audit
                  </button>
                ) : (
                  <div className="rounded-lg bg-emerald/10 border border-emerald/25 px-4 py-2 text-[11.5px] font-mono font-bold text-emerald flex items-center gap-1">
                    <CheckCircle2 size={12} /> Closed & Archived in Operations Ledger
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>

          </>
        )}

      </div>
    </InternalOnlyShield>
  );
}
