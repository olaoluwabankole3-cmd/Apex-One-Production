"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import GlassCard from "@/components/ui/GlassCard";
import { revenueRepository } from "@/lib/data/repositories";
import { PortfolioSlice } from "@/lib/types";

export default function PortfolioBreakdown() {
  const [slices, setSlices] = useState<PortfolioSlice[]>([]);

  useEffect(() => {
    async function loadPortfolio() {
      const data = await revenueRepository.getPortfolioBreakdown();
      setSlices(data);
    }
    loadPortfolio();
  }, []);

  const total = slices.reduce((s, d) => s + d.value, 0);

  return (
    <GlassCard delay={0.15} className="p-5 lg:p-6 flex flex-col justify-between">
      <div>
        <p className="font-display text-[15px] font-bold text-ivory">Portfolio by Subsidiary</p>
        <p className="mt-0.5 text-[12px] text-ivory/40">Assets under management, $M</p>
      </div>

      {slices.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
          <span className="text-[12px] font-bold text-ivory/60 uppercase tracking-wider block font-mono">Portfolio Offline</span>
          <p className="text-[11px] text-ivory/35 max-w-[200px] mt-1.5 leading-relaxed">
            No subsidiary financial structures connected. Enable Demo Mode in Settings to simulate portfolio holdings.
          </p>
        </div>
      ) : (
        <>
          <div className="relative mt-2 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={1200}
                >
                  {slices.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-display text-[20px] font-bold text-ivory">${total.toLocaleString()}M</p>
              <p className="text-[11px] text-ivory/40">Total AUM</p>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {slices.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-2 text-ivory/65">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="font-mono text-ivory/85">${d.value}M</span>
              </div>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
}
