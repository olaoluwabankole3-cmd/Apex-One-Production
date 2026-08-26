"use client";

import { useState, useEffect } from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { CheckCircle2, Clock3, AlertOctagon, Loader2 } from "lucide-react";
import clsx from "clsx";
import GlassCard from "@/components/ui/GlassCard";
import { operationsRepository } from "@/lib/data/repositories";
import { SubsidiaryOps, ReconciliationStatus } from "@/lib/types";

const statusMeta: Record<ReconciliationStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  complete: { label: "Reconciled", icon: CheckCircle2, className: "text-emerald bg-emerald/10 border-emerald/25" },
  pending: { label: "Pending", icon: Clock3, className: "text-amber bg-amber/10 border-amber/25" },
  delayed: { label: "Delayed", icon: AlertOctagon, className: "text-crimson bg-crimson/10 border-crimson/25" },
};

export default function SubsidiaryHealthGrid() {
  const [data, setData] = useState<SubsidiaryOps[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    operationsRepository.getSubsidiaryOps()
      .then((ops) => {
        if (isMounted) {
          setData(ops);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load subsidiary health:", err);
        if (isMounted) {
          setData([]);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div>
      <p className="mb-3 font-display text-[15px] font-bold text-ivory">Subsidiary Health</p>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-ivory/40 gap-2 text-xs">
          <Loader2 className="animate-spin" size={16} />
          <span>Loading subsidiary health...</span>
        </div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-xs text-ivory/40">
          No subsidiary operational data available.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.map((sub, i) => {
            const status = statusMeta[sub.reconciliationStatus] || statusMeta.complete;
            const StatusIcon = status.icon;
            const sparkData = sub.trend.map((v, idx) => ({ idx, v }));
            const isHealthy = sub.slaCompliance >= 97;

            return (
              <GlassCard key={sub.subsidiary} delay={0.05 * i} className="p-5">
                <div className="flex items-start justify-between">
                  <p className="font-display text-[14.5px] font-bold text-ivory">{sub.subsidiary}</p>
                  <span
                    className={clsx(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      status.className
                    )}
                  >
                    <StatusIcon size={11} />
                    {status.label}
                  </span>
                </div>

                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[10.5px] uppercase tracking-[0.08em] text-ivory/40">SLA</p>
                    <p
                      className={clsx(
                        "font-display text-[20px] font-bold tabular-nums",
                        isHealthy ? "text-ivory" : "text-crimson"
                      )}
                    >
                      {sub.slaCompliance.toFixed(1)}%
                    </p>
                  </div>
                  <div className="h-9 w-16 opacity-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparkData} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                        <defs>
                          <linearGradient id={`ops-spark-${sub.subsidiary}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isHealthy ? "#3FBF8F" : "#D8455F"} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={isHealthy ? "#3FBF8F" : "#D8455F"} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="v"
                          stroke={isHealthy ? "#3FBF8F" : "#D8455F"}
                          strokeWidth={1.75}
                          fill={`url(#ops-spark-${sub.subsidiary})`}
                          isAnimationActive
                          animationDuration={1200}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 text-[11.5px]">
                  <div>
                    <p className="text-ivory/40">Open incidents</p>
                    <p className="mt-0.5 font-medium text-ivory/85">{sub.openIncidents}</p>
                  </div>
                  <div>
                    <p className="text-ivory/40">Avg resolution</p>
                    <p className="mt-0.5 font-medium text-ivory/85">{sub.avgResolutionHours}h</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-ivory/40">
                    <span>Automation coverage</span>
                    <span className="font-mono text-ivory/60">{sub.automationCoverage}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gold-gradient transition-all duration-700"
                      style={{ width: `${sub.automationCoverage}%` }}
                    />
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

