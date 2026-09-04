"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Gauge, Workflow } from "lucide-react";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";
import GlassCard from "@/components/ui/GlassCard";
import { operationsRepository } from "@/lib/data/repositories";

interface OperationsCounts {
  incidents: number;
  bottlenecks: number;
  capacity: number;
  automation: number;
}

export default function OperationsPage() {
  const [counts, setCounts] = useState<OperationsCounts>({
    incidents: 0,
    bottlenecks: 0,
    capacity: 0,
    automation: 0,
  });
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      operationsRepository.getIncidents(),
      operationsRepository.getBottlenecks(),
      operationsRepository.getCapacityMetrics(),
      operationsRepository.getAutomationOpportunities(),
    ])
      .then(([incidents, bottlenecks, capacity, automation]) => {
        if (!mounted) return;
        setCounts({
          incidents: incidents.length,
          bottlenecks: bottlenecks.length,
          capacity: capacity.length,
          automation: automation.length,
        });
      })
      .catch(() => {
        if (mounted) setUnavailable(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const totalRecords =
    counts.incidents + counts.bottlenecks + counts.capacity + counts.automation;

  return (
    <InternalOnlyShield>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
            APEX ONE · Operations
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ivory">
            Operations Intelligence
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
            Operational incidents, bottlenecks, capacity and automation opportunities
            appear here only when backed by connected enterprise telemetry.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Incident records", value: counts.incidents, icon: AlertTriangle },
            { label: "Bottleneck records", value: counts.bottlenecks, icon: Activity },
            { label: "Capacity records", value: counts.capacity, icon: Gauge },
            { label: "Automation opportunities", value: counts.automation, icon: Workflow },
          ].map(({ label, value, icon: Icon }) => (
            <GlassCard key={label} className="p-5">
              <Icon size={17} className="text-gold/70" />
              <p className="mt-4 text-[11px] uppercase tracking-[0.1em] text-ivory/40">{label}</p>
              <p className="mt-1 font-display text-3xl font-bold text-ivory">
                {loading ? "—" : value}
              </p>
            </GlassCard>
          ))}
        </div>

        {!loading && totalRecords === 0 && (
          <GlassCard className="border-dashed p-8 text-center">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gold/70">
              Operations source not connected
            </p>
            <h2 className="mt-3 font-display text-xl font-bold text-ivory">
              No authoritative operations telemetry is available
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-ivory/45">
              APEX ONE will not invent incidents, SLA breaches, KYC failures, capacity
              utilization, financial impact or remediation outcomes. These surfaces will
              activate after the corresponding operations data service is connected.
            </p>
          </GlassCard>
        )}

        {unavailable && (
          <p className="text-sm text-crimson/80">
            The operations data request could not be completed.
          </p>
        )}
      </div>
    </InternalOnlyShield>
  );
}
