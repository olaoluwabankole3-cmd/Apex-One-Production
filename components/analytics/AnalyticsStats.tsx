"use client";

import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, RefreshCw, UserMinus, Loader2 } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { revenueRepository } from "@/lib/data/repositories";
import { AnalyticsSummaryStats } from "@/lib/types";

export default function AnalyticsStats() {
  const [data, setData] = useState<AnalyticsSummaryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    revenueRepository.getAnalyticsStats()
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load analytics stats:", err);
        if (isMounted) {
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const stats = [
    {
      id: "revenue",
      label: "Total Revenue (Trailing 8mo)",
      value: data ? data.totalRevenue : 0,
      decimals: 1,
      prefix: "$",
      suffix: "M",
      icon: DollarSign,
      tone: "text-gold bg-gold/10",
    },
    {
      id: "netnew",
      label: "Net New ARR (QoQ)",
      value: data ? data.netNewArr : 0,
      decimals: 1,
      prefix: "$",
      suffix: "M",
      icon: TrendingUp,
      tone: "text-emerald bg-emerald/10",
    },
    {
      id: "nrr",
      label: "Net Revenue Retention",
      value: data ? data.netRevenueRetention : 0,
      decimals: 1,
      prefix: "",
      suffix: "%",
      icon: RefreshCw,
      tone: "text-ivory/70 bg-white/[0.06]",
    },
    {
      id: "churn",
      label: "Gross Churn Rate",
      value: data ? data.grossChurnRate : 0,
      decimals: 1,
      prefix: "",
      suffix: "%",
      icon: UserMinus,
      tone: "text-crimson bg-crimson/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <GlassCard key={stat.id} delay={0.05 * i} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-ivory/45">{stat.label}</p>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stat.tone}`}>
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
                prefix={stat.prefix}
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

