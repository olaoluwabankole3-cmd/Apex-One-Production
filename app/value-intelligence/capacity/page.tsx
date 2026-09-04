"use client";

import { Gauge } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { useValueEngine } from "@/components/value-engine/ValueEngineContext";

export default function CapacityPage() {
  const { capacityMetrics, loading } = useValueEngine();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
          APEX ONE · Value Intelligence
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ivory">Capacity Intelligence</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
          People, technology and capital utilization metrics require an authoritative
          utilization telemetry service.
        </p>
      </header>

      {loading ? (
        <GlassCard className="p-8 text-center text-sm text-ivory/45">Loading capacity records…</GlassCard>
      ) : capacityMetrics.length === 0 ? (
        <GlassCard className="border-dashed p-8 text-center">
          <Gauge size={24} className="mx-auto text-gold/70" />
          <h2 className="mt-4 font-display text-xl font-bold text-ivory">Capacity source not connected</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ivory/45">
            No utilization, waste-value, saved-value or capacity-confidence figures are
            displayed until a real telemetry source is connected.
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {capacityMetrics.map((metric) => (
            <GlassCard key={`${metric.department}-${metric.name}`} className="p-5">
              <p className="font-display text-base font-bold text-ivory">{metric.name}</p>
              <p className="mt-1 text-xs text-ivory/40">{metric.department}</p>
              <div className="mt-4 flex gap-5 text-sm text-ivory/55">
                <span>Allocated: {metric.allocated}</span>
                <span>Utilized: {metric.utilized}</span>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
