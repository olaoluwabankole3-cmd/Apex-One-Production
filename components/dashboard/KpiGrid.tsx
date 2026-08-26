"use client";

import { useState, useEffect } from "react";
import { useRole } from "@/components/layout/RoleContext";
import { useValueEngine } from "@/components/value-engine/ValueEngineContext";
import { revenueRepository } from "@/lib/data/repositories";
import { KpiDatum } from "@/lib/types";
import KpiCard from "./KpiCard";
import { Gem, ShieldCheck, Trophy, Sparkles, TrendingUp } from "lucide-react";
import AnimatedNumber from "./AnimatedNumber";
import GlassCard from "@/components/ui/GlassCard";

export default function KpiGrid() {
  const { role } = useRole();
  const { totalIdentified, totalCaptured, captureRate, opportunities } = useValueEngine();
  const [kpisList, setKpisList] = useState<KpiDatum[]>([]);

  useEffect(() => {
    async function fetchKpis() {
      const data = await revenueRepository.getKpis();
      setKpisList(data);
    }
    fetchKpis();
  }, []);

  const filtered = kpisList.filter((k) => k.roles.includes(role));
  const items = (filtered.length >= 3 ? filtered : kpisList).slice(0, 4);

  const isExecutive = role === "CEO" || role === "Operations";

  // Helper for Naira currency display
  const formatNairaValue = (val: number) => {
    return (val / 1000000).toFixed(1);
  };

  return (
    <div className="space-y-5">
      {/* Dynamic Apex Value Intelligence Console (Visible only for CEO and Operations) */}
      {isExecutive && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 mt-[-5px]">
              <Sparkles size={14} className="text-gold animate-pulse" />
              <h4 className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold font-mono animate-fade-in">
                Apex Value Engine • Executive Briefing
              </h4>
            </div>
            <span className="text-[10px] font-mono text-ivory/30">
              Systemic Loss Recovery Active
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 pt-0 mt-[4px]">
            {/* KPI 1: Identified Leakage & Yields */}
            <GlassCard className="p-5 border-gold/25 shadow-gold-glow/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 h-16 w-16 bg-gold/5 blur-xl rounded-full animate-pulse-slow" />
              <div className="flex items-start justify-between">
                <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ivory/45">
                  Identified Loss Backlog
                </p>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gold/10 text-gold border border-gold/20">
                  <Gem size={12} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-[26px] font-bold text-ivory tracking-tight">₦</span>
                <AnimatedNumber
                  value={parseFloat(formatNairaValue(totalIdentified))}
                  decimals={1}
                  suffix="M"
                  className="font-display text-[26px] font-bold tabular-nums tracking-tight text-ivory"
                />
              </div>
              <p className="mt-2 text-[11px] font-mono text-gold/60 font-semibold">
                {opportunities.filter(o => o.status !== "captured").length} active risk nodes detected
              </p>
            </GlassCard>

            {/* KPI 2: Certified Value Captured */}
            <GlassCard className="p-5 border-emerald/20 bg-emerald/[0.01] relative overflow-hidden">
              <div className="absolute top-0 right-0 h-16 w-16 bg-emerald/5 blur-xl rounded-full animate-pulse-slow" />
              <div className="flex items-start justify-between">
                <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ivory/45">
                  Verified Capital Recaptured
                </p>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald/15 text-emerald border border-emerald/25 animate-pulse-slow">
                  <Trophy size={12} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-[26px] font-bold text-emerald tracking-tight">₦</span>
                <AnimatedNumber
                  value={parseFloat(formatNairaValue(totalCaptured))}
                  decimals={1}
                  suffix="M"
                  className="font-display text-[26px] font-bold tabular-nums tracking-tight text-emerald"
                />
              </div>
              <p className="mt-2 text-[11.5px] text-ivory/35">
                Reflected in Group Treasury ledger
              </p>
            </GlassCard>

            {/* KPI 3: Capture Rate */}
            <GlassCard className="p-5 relative overflow-hidden">
              <div className="flex items-start justify-between">
                <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ivory/45">
                  Value Capture Efficiency
                </p>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.05] text-ivory/60 border border-white/[0.05]">
                  <TrendingUp size={12} strokeWidth={2.5} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline">
                <AnimatedNumber
                  value={captureRate}
                  decimals={1}
                  suffix="%"
                  className="font-display text-[26px] font-bold tabular-nums tracking-tight text-ivory"
                />
              </div>
              <p className="mt-2 text-[11.5px] text-ivory/35">
                Ratio of resolution to total backlog
              </p>
            </GlassCard>

            {/* KPI 4: Security Shield Rate */}
            <GlassCard className="p-5 relative overflow-hidden">
              <div className="flex items-start justify-between">
                <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ivory/45">
                  Loss Intervention Index
                </p>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald/10 text-emerald border border-emerald-25">
                  <ShieldCheck size={12} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline">
                {opportunities.length === 0 ? (
                  <span className="font-display text-[26px] font-bold text-ivory/30 tracking-tight">—</span>
                ) : (
                  <AnimatedNumber
                    value={94.8}
                    decimals={1}
                    suffix="%"
                    className="font-display text-[26px] font-bold tabular-nums tracking-tight text-emerald"
                  />
                )}
              </div>
              <p className="mt-2 text-[11.5px] text-ivory/35">
                Automated playbook accuracy rating
              </p>
            </GlassCard>
          </div>
        </div>
      )}

      {/* Standard Enterprise Operating System Metrics Header */}
      {isExecutive && (
        <div className="flex items-center gap-2 pt-[2px] pb-1 px-1">
          <h4 className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-ivory/40 font-mono">
            Enterprise Consolidated KPIs
          </h4>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.005] p-8 flex flex-col items-center justify-center text-center">
          <div className="h-10 w-10 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-ivory/40 mb-3.5">
            <TrendingUp size={16} />
          </div>
          <span className="text-[13px] font-bold text-ivory/80 uppercase tracking-wider block font-mono">Consolidated KPIs Not Connected</span>
          <p className="text-[11.5px] text-ivory/40 max-w-sm mt-1.5 leading-relaxed">
            There are no active organizational performance records. Go to Settings and enable Demo Mode to populate evaluation data, or configure cloud data streams.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 pt-0 mt-[7px]">
          {items.map((kpi, i) => (
            <KpiCard key={kpi.id} data={kpi} delay={0.05 * i} />
          ))}
        </div>
      )}
    </div>
  );
}
