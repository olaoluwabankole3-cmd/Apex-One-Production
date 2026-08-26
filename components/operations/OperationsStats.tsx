"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, AlertTriangle, Clock, Cpu, Loader2 } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { operationsRepository } from "@/lib/data/repositories";
import { SubsidiaryOps } from "@/lib/types";

export default function OperationsStats() {
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
        console.error("Failed to load subsidiary operations stats:", err);
        if (isMounted) {
          setData([]);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const avgSla = data.length ? data.reduce((sum, s) => sum + s.slaCompliance, 0) / data.length : 0;
  const totalIncidents = data.reduce((sum, s) => sum + s.openIncidents, 0);
  const avgResolution = data.length ? data.reduce((sum, s) => sum + s.avgResolutionHours, 0) / data.length : 0;
  const avgAutomation = data.length ? data.reduce((sum, s) => sum + s.automationCoverage, 0) / data.length : 0;

  const stats = [
    {
      id: "sla",
      label: "SLA Compliance",
      value: avgSla,
      decimals: 1,
      suffix: "%",
      icon: ShieldCheck,
      tone: "text-emerald bg-emerald/10",
    },
    {
      id: "incidents",
      label: "Open Incidents",
      value: totalIncidents,
      decimals: 0,
      suffix: "",
      icon: AlertTriangle,
      tone: "text-crimson bg-crimson/10",
    },
    {
      id: "resolution",
      label: "Avg Resolution Time",
      value: avgResolution,
      decimals: 1,
      suffix: "h",
      icon: Clock,
      tone: "text-gold bg-gold/10",
    },
    {
      id: "automation",
      label: "Automation Coverage",
      value: avgAutomation,
      decimals: 0,
      suffix: "%",
      icon: Cpu,
      tone: "text-ivory/70 bg-white/[0.06]",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <GlassCard key={stat.id} delay={0.05 * i} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-medium uppercase tracking-[0.08em] text-ivory/45">
                {stat.label}
              </p>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.tone}`}>
                <Icon size={15} strokeWidth={1.75} />
              </span>
            </div>
            {loading ? (
              <div className="mt-3 flex items-center gap-2 py-1 text-ivory/40">
                <Loader2 className="animate-spin" size={16} />
                <span className="text-xs">Loading...</span>
              </div>
            ) : (
              <AnimatedNumber
                value={stat.value}
                decimals={stat.decimals}
                suffix={stat.suffix}
                className="mt-3 block font-display text-[26px] font-bold tabular-nums tracking-tight text-ivory"
              />
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}

