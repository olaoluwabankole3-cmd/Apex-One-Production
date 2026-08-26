"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import GlassCard from "@/components/ui/GlassCard";
import { customerRepository } from "@/lib/data/repositories";
import { Customer } from "@/lib/types";

const statusDot: Record<string, string> = {
  active: "bg-emerald",
  "at-risk": "bg-crimson",
  onboarding: "bg-amber",
};

export default function TopAccountsPanel() {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    customerRepository.getCustomers()
      .then((customers) => {
        if (isMounted) {
          setData(customers);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load top accounts:", err);
        if (isMounted) {
          setData([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const top = [...data].sort((a, b) => b.arr - a.arr).slice(0, 5);

  return (
    <GlassCard delay={0.15} className="p-5 lg:p-6">
      <p className="font-display text-[15px] font-bold text-ivory">Top Accounts by ARR</p>
      <p className="mt-0.5 text-[12px] text-ivory/40">Across all subsidiaries</p>

      <div className="mt-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-ivory/40 gap-2 text-xs">
            <Loader2 className="animate-spin" size={16} />
            <span>Loading accounts...</span>
          </div>
        ) : top.length === 0 ? (
          <div className="py-6 text-center text-xs text-ivory/40">
            No account records available.
          </div>
        ) : (
          top.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg px-1 py-2">
              <span className="font-mono text-[11px] text-ivory/30">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/10 font-display text-[12px] font-bold text-gold">
                {c.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-ivory/90">{c.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ivory/40">
                  <span className={clsx("h-1.5 w-1.5 rounded-full", statusDot[c.status] || "bg-emerald")} />
                  {c.subsidiary}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[12.5px] font-medium text-ivory/85">
                {c.arr >= 1_000_000 ? `$${(c.arr / 1_000_000).toFixed(2)}M` : `$${c.arr.toFixed(2)}M`}
              </span>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}

