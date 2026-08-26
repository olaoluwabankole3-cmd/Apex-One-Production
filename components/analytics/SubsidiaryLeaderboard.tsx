"use client";

import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import clsx from "clsx";
import GlassCard from "@/components/ui/GlassCard";
import { revenueRepository } from "@/lib/data/repositories";
import { SubsidiaryPerformance } from "@/lib/types";

export default function SubsidiaryLeaderboard() {
  const [data, setData] = useState<SubsidiaryPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    revenueRepository.getSubsidiaryPerformance()
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load subsidiary leaderboard:", err);
        if (isMounted) {
          setData([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const sorted = [...data].sort((a, b) => b.portfolioValue - a.portfolioValue);

  return (
    <GlassCard delay={0.1} className="p-5 lg:p-6">
      <p className="font-display text-[15px] font-bold text-ivory">Business Unit Performance</p>
      <p className="mt-0.5 text-[12px] text-ivory/40">Ranked by portfolio value</p>

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-ivory/40 gap-2 text-xs">
            <Loader2 className="animate-spin" size={16} />
            <span>Loading leaderboard...</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-6 text-center text-xs text-ivory/40">
            No business unit performance data available.
          </div>
        ) : (
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-[10.5px] uppercase tracking-[0.06em] text-ivory/35">
                <th className="pb-2.5 font-medium">Business Unit</th>
                <th className="pb-2.5 font-medium text-right">Portfolio Value</th>
                <th className="pb-2.5 font-medium text-right">Customers</th>
                <th className="pb-2.5 font-medium text-right">Growth</th>
                <th className="pb-2.5 font-medium text-right">SLA</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => {
                const isPositive = s.growthPct >= 0;
                return (
                  <tr key={s.subsidiary} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2 text-[12.5px] text-ivory/90">
                        <span className="font-mono text-[10.5px] text-ivory/30">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {s.subsidiary}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-[12.5px] text-ivory/85">
                      ${s.portfolioValue}M
                    </td>
                    <td className="py-2.5 pr-3 text-right text-[12px] text-ivory/50">
                      {s.customers.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-0.5 font-mono text-[12px] font-medium",
                          isPositive ? "text-emerald" : "text-crimson"
                        )}
                      >
                        {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(s.growthPct).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-[12px] text-ivory/50">
                      {s.slaCompliance.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </GlassCard>
  );
}

