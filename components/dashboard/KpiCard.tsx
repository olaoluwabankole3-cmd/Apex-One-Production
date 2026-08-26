"use client";

import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import clsx from "clsx";
import { KpiDatum } from "@/lib/types";
import AnimatedNumber from "./AnimatedNumber";
import { useOrganization } from "@/components/layout/OrganizationContext";
import GlassCard from "@/components/ui/GlassCard";

interface KpiCardProps {
  data: KpiDatum;
  delay?: number;
}

export default function KpiCard({ data, delay = 0 }: KpiCardProps) {
  const { organization } = useOrganization();
  const isGood =
    (data.trend === "up" && data.id !== "risk-exposure") ||
    (data.trend === "down" && data.id === "risk-exposure");

  const sparkData = data.sparkline.map((v, i) => ({ i, v }));

  return (
    <GlassCard delay={delay} className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-[12.5px] font-medium uppercase tracking-[0.08em] text-ivory/45">
          {data.label}
        </p>
        <span
          className={clsx(
            "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            isGood ? "bg-emerald/10 text-emerald" : "bg-crimson/10 text-crimson"
          )}
        >
          {data.trend === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(data.delta)}
          {data.id === "customers" ? "%" : ""}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <AnimatedNumber
          value={data.value}
          decimals={data.decimals}
          prefix={data.prefix === "$" || data.prefix === "₦" ? organization.locale.currencySymbol : data.prefix}
          suffix={data.suffix}
          className="font-display text-[26px] font-bold tabular-nums tracking-tight text-ivory"
        />
        <div className="h-9 w-20 shrink-0 opacity-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={`spark-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isGood ? "#3FBF8F" : "#D8455F"}
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor={isGood ? "#3FBF8F" : "#D8455F"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={isGood ? "#3FBF8F" : "#D8455F"}
                strokeWidth={1.75}
                fill={`url(#spark-${data.id})`}
                isAnimationActive
                animationDuration={1200}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="mt-2 text-[11.5px] text-ivory/35">{data.deltaLabel}</p>
    </GlassCard>
  );
}
