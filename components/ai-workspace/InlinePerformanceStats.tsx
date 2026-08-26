"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { revenueRepository } from "@/lib/data/repositories";
import { KpiDatum } from "@/lib/types";

export default function InlinePerformanceStats() {
  const [data, setData] = useState<KpiDatum[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    revenueRepository.getKpis()
      .then((kpis) => {
        if (isMounted) {
          setData(kpis);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load KPIs:", err);
        if (isMounted) {
          setData([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const featured = data.filter((k) => ["revenue", "growth", "customers", "portfolio"].includes(k.id));

  if (loading) {
    return (
      <div className="mt-3 flex items-center justify-center py-4 text-ivory/40 gap-2 text-xs">
        <Loader2 className="animate-spin" size={14} />
        <span>Loading performance stats...</span>
      </div>
    );
  }

  if (featured.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
    >
      {featured.map((kpi) => (
        <div
          key={kpi.id}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
        >
          <p className="text-[10.5px] uppercase tracking-[0.08em] text-ivory/40">{kpi.label}</p>
          <p className="mt-1 font-display text-[17px] font-bold text-ivory">
            {kpi.prefix ?? ""}
            {kpi.value.toLocaleString("en-US", {
              minimumFractionDigits: kpi.decimals,
              maximumFractionDigits: kpi.decimals,
            })}
            {kpi.suffix ?? ""}
          </p>
        </div>
      ))}
    </motion.div>
  );
}

