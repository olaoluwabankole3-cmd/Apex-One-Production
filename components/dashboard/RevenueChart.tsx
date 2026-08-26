"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import GlassCard from "@/components/ui/GlassCard";
import { revenueRepository } from "@/lib/data/repositories";
import { useOrganization } from "@/components/layout/OrganizationContext";
import { RevenuePoint } from "@/lib/types";

function CustomTooltip({ active, payload, label, currencySymbol }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-charcoal-light/95 px-3 py-2 text-[12px] shadow-glass backdrop-blur-xl">
      <p className="mb-1 font-medium text-ivory/50">{label}</p>
      <p className="text-ivory">
        Revenue: <span className="font-mono text-gold">{currencySymbol}{payload[0].value}M</span>
      </p>
      <p className="text-ivory/50">
        Target: <span className="font-mono">{currencySymbol}{payload[1]?.value}M</span>
      </p>
    </div>
  );
}

export default function RevenueChart() {
  const { organization } = useOrganization();
  const [series, setSeries] = useState<RevenuePoint[]>([]);

  useEffect(() => {
    async function loadChartData() {
      const data = await revenueRepository.getRevenueSeries();
      setSeries(data);
    }
    loadChartData();
  }, []);

  return (
    <GlassCard delay={0.1} className="p-5 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-[15px] font-bold text-ivory">Revenue Performance</p>
          <p className="mt-0.5 text-[12px] text-ivory/40">Actual vs. target, trailing 8 months</p>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-ivory/45">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gold" /> Actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ivory/25" /> Target
          </span>
        </div>
      </div>

      <div className="mt-4 h-[260px]">
        {series.length === 0 ? (
          <div className="h-full w-full rounded-xl border border-dashed border-white/[0.05] bg-white/[0.002] flex flex-col items-center justify-center text-center p-6">
            <span className="text-[12px] font-bold text-ivory/60 uppercase tracking-wider block font-mono">Ledger Feed Disconnected</span>
            <p className="text-[11px] text-ivory/35 max-w-xs mt-1.5 leading-relaxed">
              No live database telemetry streams linked. Active Demo Mode in Settings to simulate ledger transactions.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A961" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#C9A961" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "rgba(247,245,240,0.4)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(247,245,240,0.4)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${organization.locale.currencySymbol}${v}M`}
              />
              <Tooltip content={<CustomTooltip currencySymbol={organization.locale.currencySymbol} />} />
              <Area
                type="monotone"
                dataKey="target"
                stroke="rgba(247,245,240,0.25)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="transparent"
                isAnimationActive
                animationDuration={1400}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#C9A961"
                strokeWidth={2.25}
                fill="url(#revenueFill)"
                isAnimationActive
                animationDuration={1400}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </GlassCard>
  );
}
