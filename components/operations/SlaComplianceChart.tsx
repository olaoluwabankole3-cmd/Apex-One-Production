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
import { Loader2 } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { operationsRepository } from "@/lib/data/repositories";
import { SlaTrendPoint } from "@/lib/types";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-charcoal-light/95 px-3 py-2 text-[12px] shadow-glass backdrop-blur-xl">
      <p className="mb-1 font-medium text-ivory/50">{label}</p>
      <p className="text-ivory">
        Compliance: <span className="font-mono text-gold">{payload[0]?.value}%</span>
      </p>
      <p className="text-ivory/50">
        Target: <span className="font-mono">{payload[1]?.value}%</span>
      </p>
    </div>
  );
}

export default function SlaComplianceChart() {
  const [data, setData] = useState<SlaTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    operationsRepository.getSlaTrend()
      .then((trend) => {
        if (isMounted) {
          setData(trend);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load SLA trend:", err);
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
    <GlassCard delay={0.1} className="p-5 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-[15px] font-bold text-ivory">SLA Compliance</p>
          <p className="mt-0.5 text-[12px] text-ivory/40">Group-wide average, trailing 8 months</p>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-ivory/45">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gold" /> Compliance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ivory/25" /> Target
          </span>
        </div>
      </div>

      <div className="mt-4 h-[260px]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-ivory/40 gap-2 text-xs">
            <Loader2 className="animate-spin" size={16} />
            <span>Loading SLA trend...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-ivory/40 text-xs">
            No SLA trend data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="slaFill" x1="0" y1="0" x2="0" y2="1">
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
                domain={[94, 100]}
                tick={{ fill: "rgba(247,245,240,0.4)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
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
                dataKey="compliance"
                stroke="#C9A961"
                strokeWidth={2.25}
                fill="url(#slaFill)"
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

