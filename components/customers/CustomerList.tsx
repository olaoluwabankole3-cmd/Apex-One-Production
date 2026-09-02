"use client";

import { useMemo, useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import clsx from "clsx";
import { customerRepository } from "@/lib/data/repositories";
import { Customer, CustomerStatus } from "@/lib/types";

interface CustomerListProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

const statusDot: Record<CustomerStatus, string> = {
  active: "bg-emerald",
  "at-risk": "bg-crimson",
  onboarding: "bg-amber",
};

const statusLabel: Record<CustomerStatus, string> = {
  active: "Active",
  "at-risk": "At Risk",
  onboarding: "Onboarding",
};

const filters: Array<{ id: "all" | CustomerStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "at-risk", label: "At Risk" },
  { id: "active", label: "Active" },
  { id: "onboarding", label: "Onboarding" },
];

export default function CustomerList({ selectedId, onSelect }: CustomerListProps) {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | CustomerStatus>("all");

  useEffect(() => {
    let isMounted = true;
    customerRepository.getCustomers()
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load customers:", err);
        if (isMounted) {
          setData([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return data.filter((c) => {
      const matchesFilter = filter === "all" || c.status === filter;
      const matchesQuery =
        !query.trim() ||
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.subsidiary.toLowerCase().includes(query.toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [data, query, filter]);

  return (
    <div className="flex h-[calc(100vh-160px)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-charcoal/40 shadow-glass">
      <div className="border-b border-white/[0.06] p-4">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ivory/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers…"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-8 pr-3 text-[12.5px] text-ivory placeholder:text-ivory/30 outline-none transition-colors duration-200 focus:border-gold/30"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={clsx(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-200",
                filter === f.id
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-white/[0.08] text-ivory/45 hover:text-ivory/70"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-ivory/40 gap-2 text-xs">
            <Loader2 className="animate-spin" size={16} />
            <span>Loading accounts...</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12.5px] text-ivory/35">No customers match.</p>
        ) : (
          <div className="space-y-1">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200",
                  selectedId === c.id ? "bg-white/[0.06] border border-gold/25" : "border border-transparent hover:bg-white/[0.03]"
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/10 font-display text-[13px] font-bold text-gold">
                  {c.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-medium text-ivory/90">{c.name}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ivory/40">
                    <span className={clsx("h-1.5 w-1.5 rounded-full", statusDot[c.status] || "bg-emerald")} />
                    {statusLabel[c.status] || c.status} · {c.subsidiary}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-ivory/35">
                  {c.arr >= 1_000_000 ? `$${(c.arr / 1_000_000).toFixed(1)}M` : `$${c.arr.toFixed(1)}M`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

