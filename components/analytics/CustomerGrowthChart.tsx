"use client";

import { useState, useEffect } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Loader2 } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { revenueRepository } from "@/lib/data/repositories";
import { CustomerGrowthPoint } from "@/lib/types";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-charcoal-light/95 px-3 py-2 text-[12px] shadow-glass backdrop-blur-xl">
      <p className="mb-1 font-medium text-ivory/50">{label}</p>
      <p className="text-ivory">
        Customers: <span className="font-mono text-gold">{payload[0]?.value?.toLocaleString()}</span>
      </p>
    </div>
  );
}

export default function CustomerGrowthChart() {
  const [data, setData] = useState<CustomerGrowthPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    revenueRepository.getCustomerGrowth()
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load customer growth:", err);
        if (isMounted) {
          setData([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const first = data.length > 0 ? data[0].customers : 0;
  const last = data.length > 0 ? data[data.length - 1].customers : 0;
  const growthPct = first > 0 ? (((last - first) / first) * 100).toFixed(1) : "0.0";

  return (
    <GlassCard delay={0.15} className="p-5 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-[15px] font-bold text-ivory">Customer Growth</p>
          <p className="mt-0.5 text-[12px] text-ivory/40">Trailing 12 months, group-wide</p>
        </div>
        {data.length > 0 && (
          <span className="rounded-full border border-emerald/25 bg-emerald/10 px-2.5 py-1 text-[11px] font-semibold text-emerald">
            +{growthPct}%
          </span>
        )}
      </div>

      <div className="mt-4 h-[220px]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-ivory/40 gap-2 text-xs">
            <Loader2 className="animate-spin" size={16} />
            <span>Loading growth data...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-ivory/40 text-xs">
            No growth data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="customerFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3FBF8F" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3FBF8F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "rgba(247,245,240,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "rgba(247,245,240,0.4)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="customers"
                stroke="#3FBF8F"
                strokeWidth={2.25}
                fill="url(#customerFill)"
                isAnimationActive
                animationDuration={1200}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </GlassCard>
  );
}

