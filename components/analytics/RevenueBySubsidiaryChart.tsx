"use client";

import { useState, useEffect } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Loader2 } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import TimeRangeSelector from "./TimeRangeSelector";
import { revenueRepository } from "@/lib/data/repositories";
import { TimeRange, RevenueBySubsidiaryPoint } from "@/lib/types";

const series = [
  { key: "enterpriseOps", label: "Enterprise Operations", color: "#C9A961" },
  { key: "commercialOps", label: "Commercial Operations", color: "#3FBF8F" },
  { key: "strategicAccounts", label: "Strategic Accounts", color: "#E0A845" },
  { key: "customerOps", label: "Customer Operations", color: "#8A7EE8" },
];

function sliceData<T>(items: T[], range: TimeRange): T[] {
  const counts: Record<TimeRange, number> = { "30D": 1, "90D": 3, YTD: 7, "12M": items.length };
  const count = Math.min(counts[range] ?? items.length, items.length);
  return items.slice(items.length - count);
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum: number, p: any) => sum + (p.value ?? 0), 0);
  return (
    <div className="rounded-lg border border-white/10 bg-charcoal-light/95 px-3 py-2 text-[12px] shadow-glass backdrop-blur-xl">
      <p className="mb-1 font-medium text-ivory/50">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="text-ivory/70">{series.find((s) => s.key === p.dataKey)?.label}</span>
          <span className="font-mono" style={{ color: p.color }}>
            ${p.value.toFixed(1)}M
          </span>
        </p>
      ))}
      <p className="mt-1 flex items-center justify-between gap-4 border-t border-white/10 pt-1 text-ivory/80">
        <span>Total</span>
        <span className="font-mono text-gold">${total.toFixed(1)}M</span>
      </p>
    </div>
  );
}

export default function RevenueBySubsidiaryChart() {
  const [rawData, setRawData] = useState<RevenueBySubsidiaryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("12M");

  useEffect(() => {
    let isMounted = true;
    revenueRepository.getRevenueBySubsidiaryMonthly()
      .then((res) => {
        if (isMounted) {
          setRawData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load subsidiary monthly revenue:", err);
        if (isMounted) {
          setRawData([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const data = sliceData(rawData, range);

  return (
    <GlassCard delay={0.1} className="p-5 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-[15px] font-bold text-ivory">Revenue by Subsidiary</p>
          <p className="mt-0.5 text-[12px] text-ivory/40">Monthly revenue, stacked by entity</p>
        </div>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-ivory/45">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="mt-3 h-[280px]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-ivory/40 gap-2 text-xs">
            <Loader2 className="animate-spin" size={16} />
            <span>Loading revenue data...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-ivory/40 text-xs">
            No subsidiary revenue data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "rgba(247,245,240,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "rgba(247,245,240,0.4)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}M`}
              />
              <Tooltip content={<CustomTooltip />} />
              {series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stackId="revenue"
                  stroke={s.color}
                  strokeWidth={1.5}
                  fill={`url(#fill-${s.key})`}
                  isAnimationActive
                  animationDuration={900}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </GlassCard>
  );
}

