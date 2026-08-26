"use client";

import { useState, useMemo } from "react";
import { isDemoMode } from "@/lib/demo";
import ValueIntelligenceEmptyState from "@/components/value-engine/ValueIntelligenceEmptyState";
import ValueHeader from "@/components/value-engine/ValueHeader";
import GlassCard from "@/components/ui/GlassCard";
import {
  Zap,
  Play,
  CheckCircle2,
  ChevronRight,
  Terminal,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Cpu,
  AlertOctagon,
  TrendingUp,
  Award,
  SlidersHorizontal,
  FolderSync
} from "lucide-react";
import clsx from "clsx";

interface QueueActionItem {
  id: string;
  recommendation: string;
  owner: string;
  deadline: string;
  expectedValue: number;
  status: "Ready" | "Approved" | "In Progress" | "Completed" | "Measured";
  confidence: number;
  automationType: "Manual" | "AI-assisted" | "Automated" | "Awaiting approval";
  requiresHumanApproval: boolean;
  insightSource: string;
  decisionDetail: string;
  resultMetric: string;
  logs: string[];
}

export default function ActionControlCenterPage() {
  const [selectedItemId, setSelectedItemId] = useState<string>("action-dormant");
  const [activePipelineFilter, setActivePipelineFilter] = useState<string>("all");

  const [queueItems, setQueueItems] = useState<QueueActionItem[]>([
    {
      id: "action-dormant",
      recommendation: "Reactivate Dormant Enterprise Customer",
      owner: "Customer Success Team",
      deadline: "2026-08-25",
      expectedValue: 42300000, // ₦42.3M
      status: "Ready",
      confidence: 91,
      automationType: "AI-assisted",
      requiresHumanApproval: true,
      insightSource: "Dangote Industrial purchase latency exceeds 137-day average limits.",
      decisionDetail: "Dispatched direct custom-pricing reactivation outbound suite.",
      resultMetric: "Recovered active purchasing cycles; closes potential value leakage gap.",
      logs: [
        "Insight Node generated: Dormant relation detected",
        "Decision Matrix built: Activation pricing generated",
        "Awaiting Executive Approval to Dispatch Campaign"
      ]
    },
    {
      id: "action-volatility",
      recommendation: "Apply Naira Volatility Indexation Multipliers",
      owner: "Treasury Operations Desk",
      deadline: "2026-08-20",
      expectedValue: 15200000,
      status: "Approved",
      confidence: 95,
      automationType: "Automated",
      requiresHumanApproval: false,
      insightSource: "30-day CBN volatility boundary breach triggers Clause 4.2 parameters.",
      decisionDetail: "Execute billing multipliers on trailing monthly corporate contracts.",
      resultMetric: "Protected contract yield from foreign exchange local currency drop.",
      logs: [
        "Volatility indices parsed: Deviation found",
        "Trigger conditions satisfied for active indexation",
        "Multiplier staged and ready for auto-dispatch"
      ]
    },
    {
      id: "action-triage",
      recommendation: "Deploy Claims Intake Triage Automation Node",
      owner: "Operations Engineering",
      deadline: "2026-08-30",
      expectedValue: 8600000,
      status: "In Progress",
      confidence: 92,
      automationType: "Automated",
      requiresHumanApproval: false,
      insightSource: "Peak claims latency bottlenecks trigger SLA exception penalties.",
      decisionDetail: "Route inbound claims directly into AI triage classification queues.",
      resultMetric: "Reclaimed manual overhead and avoided exception penalties.",
      logs: [
        "Bottleneck identified in Lagos intake queue",
        "Claims Triage Model initialized",
        "Active deployment: Sequencing system routing changes (45% complete)"
      ]
    },
    {
      id: "action-advisor",
      recommendation: "Rebalance Advisor Workload Allocation Queues",
      owner: "Staffing & Capacity Management",
      deadline: "2026-08-22",
      expectedValue: 1500000,
      status: "Completed",
      confidence: 85,
      automationType: "Manual",
      requiresHumanApproval: true,
      insightSource: "Abuja support desks operate above 108% peak capacity.",
      decisionDetail: "Route overflow tickets to unoccupied Lagos consultant pools.",
      resultMetric: "Balanced queue load; reclaimed 40 idle capacity hours.",
      logs: [
        "Staffing levels mapped: Abuja overflow flagged",
        "Lagos seats verified: Unoccupied floor capacity matches",
        "Complete: Queues successfully reallocated and validated"
      ]
    },
    {
      id: "action-sweep",
      recommendation: "Initiate Inter-Bank Settlement Float Sweeps",
      owner: "Financial Management Office",
      deadline: "2026-08-10",
      expectedValue: 8200000,
      status: "Measured",
      confidence: 100,
      automationType: "Automated",
      requiresHumanApproval: false,
      insightSource: "Daily clearing sweeps lag standard CBN transaction cycles.",
      decisionDetail: "Trigger 30-minute automated asset sweeps directly inside treasury core.",
      resultMetric: "General Ledger yield confirmed; value successfully CAPTURED.",
      logs: [
        "Sweeping scheduler deployed",
        "Cleared cash balances mapped into financial accounts",
        "VALUE CAPTURED: ₦8.2M certified in active treasury sub-ledger"
      ]
    }
  ]);

  // Active selected item memo
  const activeItem = useMemo(() => {
    return queueItems.find(q => q.id === selectedItemId) || queueItems[0];
  }, [queueItems, selectedItemId]);

  // Format Helper
  const formatNaira = (val: number) => {
    if (val >= 1000000000) {
      return `₦${(val / 1000000000).toFixed(1)}B`;
    }
    if (val >= 1000000) {
      return `₦${(val / 1000000).toFixed(1)}M`;
    }
    return `₦${val.toLocaleString()}`;
  };

  // Pipeline execution sequence trigger
  const handleExecuteAction = (id: string) => {
    setQueueItems(prev => prev.map(item => {
      if (item.id === id) {
        // Progress item state through pipeline sequence
        const pipelineOrder: QueueActionItem["status"][] = ["Ready", "Approved", "In Progress", "Completed", "Measured"];
        const currentIndex = pipelineOrder.indexOf(item.status);
        const nextStatus = currentIndex < pipelineOrder.length - 1 ? pipelineOrder[currentIndex + 1] : item.status;
        
        let updatedLogs = [...item.logs];
        if (nextStatus === "Approved") {
          updatedLogs.push("Executive human approval verified and signed");
        } else if (nextStatus === "In Progress") {
          updatedLogs.push("Execution engine active; launching scripts");
        } else if (nextStatus === "Completed") {
          updatedLogs.push("Workflow execution complete and verified");
        } else if (nextStatus === "Measured") {
          updatedLogs.push("VALUE CAPTURED: Yield verified on general sub-ledger accounts");
        }

        return {
          ...item,
          status: nextStatus,
          logs: updatedLogs
        };
      }
      return item;
    }));
  };

  // Pipeline filter mappings
  const filteredQueueItems = useMemo(() => {
    if (activePipelineFilter === "all") return queueItems;
    return queueItems.filter(q => q.status === activePipelineFilter);
  }, [queueItems, activePipelineFilter]);

  // Overall statistics
  const stats = useMemo(() => {
    return {
      ready: queueItems.filter(q => q.status === "Ready").length,
      inProgress: queueItems.filter(q => q.status === "In Progress").length,
      completed: queueItems.filter(q => q.status === "Completed" || q.status === "Measured").length
    };
  }, [queueItems]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12 select-none relative" id="action-control-workspace">
      
      {/* Background glow highlights */}
      <div className="absolute top-[-30px] right-[10%] w-[450px] h-[450px] bg-gold/[0.02] blur-[120px] rounded-full pointer-events-none z-0" />

      <ValueHeader
        category="INTELLIGENCE-TO-ACTION CONTROL CENTER"
        title="INTELLIGENCE-TO-ACTION CONTROL CENTER"
        subtitle="The operational bridge connecting raw cognitive insights directly with executive decisions, automated workflows, and measured general ledger outcomes."
      />

      {!isDemoMode() ? (
        <ValueIntelligenceEmptyState
          title="No intelligence-driven actions yet"
          description="Action items, automated workflows, and executive decisions will appear here as organizational telemetry is monitored."
          badge="Action Center Offline"
        />
      ) : (
        <>
          {/* OPERATING SYSTEM CORE MESSAGE */}
          <div className="rounded-xl border border-gold/15 bg-gold/[0.01] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2.5">
          <Cpu className="text-gold" size={16} />
          <div>
            <p className="text-[12px] font-mono font-bold text-gold uppercase tracking-wider">APEX ONE CORE PURPOSE</p>
            <p className="text-[13px] font-semibold text-ivory mt-0.5">&ldquo;This is where APEX ONE stops being an analytics platform. It becomes an operating system for organizational action.&rdquo;</p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-ivory/45 sm:text-right">
          Integration: active ERP and clearing webhook sync
        </div>
      </div>

      {/* METRIC SUMMARIES */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <GlassCard className="p-5 border-white/[0.05]" hover={false}>
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">Execution Queue (Ready)</p>
            <span className="flex h-5 w-5 items-center justify-center rounded bg-gold/15 text-gold border border-gold/20">
              <Play size={11} fill="currentColor" />
            </span>
          </div>
          <div className="mt-2 text-left">
            <h3 className="font-display text-[26px] font-bold text-ivory font-mono tracking-tight">{stats.ready} Pending</h3>
            <p className="text-[11.5px] text-ivory/35 mt-1">Awaiting executive trigger blocks</p>
          </div>
        </GlassCard>

        <GlassCard className="p-5 border-white/[0.05]" hover={false}>
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">In Progress Workflows</p>
            <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-500/10 text-blue-400 border border-blue-500/15 animate-spin">
              <RefreshCw size={11} />
            </span>
          </div>
          <div className="mt-2 text-left">
            <h3 className="font-display text-[26px] font-bold text-ivory font-mono tracking-tight">{stats.inProgress} Active</h3>
            <p className="text-[11.5px] text-ivory/35 mt-1">Sequencing system changes live</p>
          </div>
        </GlassCard>

        <GlassCard className="p-5 border-white/[0.05]" hover={false}>
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">Measured Value Claws</p>
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 text-emerald border border-emerald-500/15">
              <CheckCircle2 size={11} />
            </span>
          </div>
          <div className="mt-2 text-left">
            <h3 className="font-display text-[26px] font-bold text-ivory font-mono tracking-tight">{stats.completed} Secured</h3>
            <p className="text-[11.5px] text-ivory/35 mt-1">Value successfully captured in general ledger</p>
          </div>
        </GlassCard>
      </div>

      {/* EXECUTION PIPELINE DISPLAY TRACK */}
      <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
          <span className="text-[11px] font-mono font-bold text-ivory/40 uppercase tracking-wider">APEX AUTOMATED EXECUTION PIPELINE</span>
          <span className="text-[10px] font-mono text-gold font-bold">5 Gated Verification Boundaries</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {["Ready", "Approved", "In Progress", "Completed", "Measured"].map((step, idx) => {
            const isActive = activePipeline === step;
            const colors: Record<string, string> = {
              Ready: "text-gold border-gold/20 bg-gold/5",
              Approved: "text-amber border-amber/20 bg-amber/5",
              "In Progress": "text-blue-400 border-blue-400/20 bg-blue-400/5",
              Completed: "text-purple-400 border-purple-400/20 bg-purple-400/5",
              Measured: "text-emerald border-emerald/30 bg-emerald/5"
            };
            return (
              <div key={idx} className={clsx(
                "p-3 rounded-xl border flex flex-col justify-between h-[80px] text-left",
                colors[step]
              )}>
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Stage 0{idx+1}</span>
                <div className="flex justify-between items-end">
                  <span className="text-[12.5px] font-bold tracking-tight">{step}</span>
                  <ArrowRight size={12} className="opacity-40" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FILTER & PIPELINE OPTION DROPDOWN */}
      <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3">
        <SlidersHorizontal size={13} className="text-ivory/40" />
        <span className="text-[11px] font-mono text-ivory/45 uppercase tracking-wider">Pipeline Track filter:</span>
        <select
          value={activePipelineFilter}
          onChange={(e) => setActivePipelineFilter(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-charcoal px-2.5 py-1 text-[11.5px] text-ivory outline-none font-mono"
        >
          <option value="all">All Action Items</option>
          <option value="Ready">Ready</option>
          <option value="Approved">Approved</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Measured">Measured (Captured)</option>
        </select>
      </div>

      {/* TWO-COLUMN WORKFLOW SPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* LEFT COLUMN: ACTIVE EXECUTION QUEUE */}
        <div className="lg:col-span-5 space-y-3 text-left">
          <span className="text-[11px] font-mono font-bold text-ivory/40 uppercase tracking-wider block px-1">Action Items Queue</span>
          
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredQueueItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className={clsx(
                  "p-4 rounded-xl border cursor-pointer transition-all",
                  selectedItemId === item.id
                    ? "border-gold bg-gold/10 shadow-gold-glow-soft"
                    : "border-white/[0.04] bg-white/[0.005] hover:bg-white/[0.015]"
                )}
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[9.5px] font-mono text-gold font-bold uppercase tracking-wider">
                    {item.automationType}
                  </span>
                  <span className={clsx(
                    "text-[9px] font-mono font-bold uppercase border px-2 py-0.5 rounded-full",
                    item.status === "Measured"
                      ? "text-emerald border-emerald/20 bg-emerald-500/10"
                      : "text-ivory/60 border-white/10"
                  )}>
                    {item.status}
                  </span>
                </div>

                <h4 className="text-[14px] font-bold text-ivory mt-2.5 leading-snug">
                  {item.recommendation}
                </h4>

                <div className="mt-3.5 pt-2 border-t border-white/[0.03] flex justify-between items-center text-[12px] font-mono">
                  <span className="text-ivory/40">Expected Value:</span>
                  <span className="text-gold font-extrabold">{formatNaira(item.expectedValue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: INTELLIGENCE CONNECTION SYSTEM (INSIGHT -> DECISION -> WORKFLOW -> OWNER -> RESULT) */}
        <div className="lg:col-span-7 rounded-2xl border border-white/[0.07] bg-charcoal/40 p-6 shadow-glass space-y-6 text-left">
          
          <div className="border-b border-white/[0.04] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-[10px] font-mono text-gold uppercase tracking-[0.15em] font-bold">INTELLIGENCE RELATIONSHIP LOG</span>
              <h3 className="font-display text-[18px] font-bold text-ivory tracking-tight mt-1">{activeItem.recommendation}</h3>
            </div>
            
            {/* Sensitive governance warnings */}
            {activeItem.requiresHumanApproval && activeItem.status === "Ready" && (
              <span className="rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1 text-[9.5px] font-mono text-red-400 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
                <AlertOctagon size={11} />
                HUMAN APPROVAL REQUIRED
              </span>
            )}
          </div>

          {/* Connected Value flow specifications exactly */}
          <div className="space-y-4">
            
            {/* 1. INSIGHT */}
            <div className="p-3.5 rounded-xl border border-white/[0.03] bg-white/[0.005] flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-gold/15 text-gold border border-gold/20 shrink-0 mt-0.5 text-[9px] font-bold font-mono">INS</span>
              <div>
                <span className="text-[9px] font-mono text-ivory/30 uppercase block">1. Raw Telemetry Insight</span>
                <p className="text-[12.5px] text-ivory/80 leading-relaxed italic mt-0.5">&ldquo;{activeItem.insightSource}&rdquo;</p>
              </div>
            </div>

            {/* 2. DECISION */}
            <div className="p-3.5 rounded-xl border border-white/[0.03] bg-white/[0.005] flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-amber/15 text-amber shrink-0 mt-0.5 text-[9px] font-bold font-mono border border-amber/20">DEC</span>
              <div>
                <span className="text-[9px] font-mono text-ivory/30 uppercase block">2. Gated Executive Decision</span>
                <p className="text-[12.5px] text-ivory/80 leading-relaxed mt-0.5">{activeItem.decisionDetail}</p>
              </div>
            </div>

            {/* 3. WORKFLOW */}
            <div className="p-3.5 rounded-xl border border-white/[0.03] bg-white/[0.005] flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-500/10 text-blue-400 shrink-0 mt-0.5 text-[9px] font-bold font-mono border border-blue-500/15">WRK</span>
              <div>
                <span className="text-[9px] font-mono text-ivory/30 uppercase block">3. Automated System Workflow</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-mono text-gold bg-gold/10 px-2 py-0.5 rounded uppercase font-bold">{activeItem.automationType}</span>
                  <span className="text-ivory/40 text-[11px] font-mono">• Deadline: {activeItem.deadline}</span>
                </div>
              </div>
            </div>

            {/* 4. OWNER */}
            <div className="p-3.5 rounded-xl border border-white/[0.03] bg-white/[0.005] flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-purple-500/10 text-purple-400 shrink-0 mt-0.5 text-[9px] font-bold font-mono border border-purple-500/15">OWN</span>
              <div>
                <span className="text-[9px] font-mono text-ivory/30 uppercase block">4. Responsible Owner</span>
                <p className="text-[12.5px] font-semibold text-ivory mt-0.5">{activeItem.owner}</p>
              </div>
            </div>

            {/* 5. RESULT (VALUE CAPTURED / CLOSES LOOP) */}
            <div className="p-3.5 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.01] flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/10 text-emerald shrink-0 mt-0.5 text-[9px] font-bold font-mono border border-emerald-500/15">RES</span>
              <div>
                <div className="flex items-center gap-1.5 text-emerald">
                  <Award size={12} />
                  <span className="text-[9px] font-mono uppercase block font-bold">5. CLOSING THE LOOP RESULT (VALUE CAPTURED)</span>
                </div>
                <p className="text-[12.5px] text-emerald font-medium leading-relaxed mt-1">{activeItem.resultMetric}</p>
              </div>
            </div>

          </div>

          {/* LIVE TERMINAL CONSOLE LOGS */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono text-ivory/30 uppercase block">ACTIVE EXECUTION STEPPER CONSOLE LOGS</span>
            <div className="bg-matte-950 p-3 rounded-xl border border-white/[0.05] font-mono text-[11px] text-emerald/80 h-[100px] overflow-y-auto space-y-1">
              {activeItem.logs.map((log, idx) => (
                <p key={idx} className="leading-snug">
                  <span className="text-gold/40">[{new Date().toLocaleTimeString()}]</span> {log}
                </p>
              ))}
            </div>
          </div>

          {/* TRIGGER BUTTON (EXECUTE / RECOVER VALUE WORKFLOWS) */}
          <div className="pt-3 border-t border-white/[0.05]">
            {activeItem.status === "Measured" ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/15 text-emerald font-mono text-[12px] font-bold rounded-xl text-center">
                ✓ ALL VALUE SUCCESSFUL RECOVERED AND MEASURED ON GENERAL SUB-LEDGER
              </div>
            ) : (
              <button
                onClick={() => handleExecuteAction(activeItem.id)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold hover:bg-gold/90 text-matte font-mono font-bold text-[12px] py-3 transition-all cursor-pointer"
              >
                <Play size={11} fill="currentColor" />
                EXECUTE ACTION PLAY ({activeItem.status === "Ready" ? "TRIGGER DECISION" : "PROCEED NEXT STEP"})
              </button>
            )}
          </div>

        </div>

      </div>

      </>
    )}

    </div>
  );
}

const activePipeline = "Ready";
