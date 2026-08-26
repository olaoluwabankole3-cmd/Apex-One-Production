"use client";

import { useMemo, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import GlassCard from "@/components/ui/GlassCard";
import { operationsRepository } from "@/lib/data/repositories";
import { Incident, IncidentStatus } from "@/lib/types";

const severityStyle: Record<string, string> = {
  critical: "text-crimson bg-crimson/10 border-crimson/25",
  high: "text-amber bg-amber/10 border-amber/25",
  medium: "text-gold bg-gold/10 border-gold/25",
  low: "text-ivory/50 bg-white/[0.05] border-white/[0.1]",
};

const statusStyle: Record<IncidentStatus, string> = {
  open: "text-crimson bg-crimson/10",
  investigating: "text-amber bg-amber/10",
  resolved: "text-emerald bg-emerald/10",
};

const filters: Array<{ id: "all" | IncidentStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "investigating", label: "Investigating" },
  { id: "resolved", label: "Resolved" },
];

export default function IncidentQueue() {
  const [data, setData] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | IncidentStatus>("all");

  useEffect(() => {
    let isMounted = true;
    operationsRepository.getIncidents()
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load incidents:", err);
        if (isMounted) {
          setData([]);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? data : data.filter((i) => i.status === filter)),
    [filter, data]
  );

  return (
    <GlassCard delay={0.15} className="p-5 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-[15px] font-bold text-ivory">Incident Queue</p>
          <p className="mt-0.5 text-[12px] text-ivory/40">Across all four subsidiaries</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
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

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-ivory/40 gap-2 text-xs">
            <Loader2 className="animate-spin" size={16} />
            <span>Loading incident queue...</span>
          </div>
        ) : (
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-[10.5px] uppercase tracking-[0.06em] text-ivory/35">
                <th className="pb-2.5 font-medium">Incident</th>
                <th className="pb-2.5 font-medium">Subsidiary</th>
                <th className="pb-2.5 font-medium">Severity</th>
                <th className="pb-2.5 font-medium">Status</th>
                <th className="pb-2.5 font-medium">Owner</th>
                <th className="pb-2.5 font-medium text-right">Opened</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((incident) => (
                <tr key={incident.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="py-2.5 pr-3 text-[12.5px] text-ivory/85">{incident.title}</td>
                  <td className="py-2.5 pr-3 text-[12px] text-ivory/50">{incident.subsidiary}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={clsx(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                        severityStyle[incident.severity]
                      )}
                    >
                      {incident.severity}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", statusStyle[incident.status])}>
                      {incident.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-[12px] text-ivory/50">{incident.owner}</td>
                  <td className="py-2.5 text-right font-mono text-[11px] text-ivory/35">{incident.opened}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[12.5px] text-ivory/35">
                    No incidents match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </GlassCard>
  );
}

