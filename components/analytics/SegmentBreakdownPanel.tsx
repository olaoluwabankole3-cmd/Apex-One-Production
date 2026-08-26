"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Loader2 } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { revenueRepository } from "@/lib/data/repositories";
import { SegmentBreakdown } from "@/lib/types";

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-charcoal-light/95 px-3 py-2 text-[12px] shadow-glass backdrop-blur-xl">
      <p className="font-medium text-ivory">{d.segment}</p>
      <p className="text-ivory/60">
        ARR: <span className="font-mono text-gold">${d.arr}M</span>
      </p>
      <p className="text-ivory/60">
        Customers: <span className="font-mono">{d.customers.toLocaleString()}</span>
      </p>
    </div>
  );
}

export default function SegmentBreakdownPanel() {
  const [data, setData] = useState<SegmentBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    revenueRepository.getSegmentBreakdown()
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load segment breakdown:", err);
        if (isMounted) {
          setData([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const totalArr = data.reduce((sum, s) => sum + s.arr, 0);

  return (
    <GlassCard delay={0.2} className="p-5 lg:p-6">
      <p className="font-display text-[15px] font-bold text-ivory">Revenue by Segment</p>
      <p className="mt-0.5 text-[12px] text-ivory/40">ARR distribution across customer tiers</p>

      {loading ? (
        <div className="mt-4 flex h-[140px] items-center justify-center text-ivory/40 gap-2 text-xs">
          <Loader2 className="animate-spin" size={16} />
          <span>Loading segment breakdown...</span>
        </div>
      ) : data.length === 0 ? (
        <div className="mt-4 flex h-[140px] items-center justify-center text-ivory/40 text-xs">
          No segment data available.
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-4">
          <div className="h-[140px] w-[140px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="arr"
                  nameKey="segment"
                  innerRadius={42}
                  outerRadius={64}
                  paddingAngle={3}
                  isAnimationActive
                  animationDuration={900}
                >
                  {data.map((s) => (
                    <Cell key={s.segment} fill={s.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="min-w-0 flex-1 space-y-2.5">
            {data.map((s) => (
              <div key={s.segment} className="flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-2 text-ivory/70">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.segment}
                </span>
                <span className="font-mono text-ivory/85">
                  {totalArr > 0 ? ((s.arr / totalArr) * 100).toFixed(0) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

