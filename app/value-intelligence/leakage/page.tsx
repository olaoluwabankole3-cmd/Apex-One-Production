"use client";

import { ShieldAlert } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { useValueEngine } from "@/components/value-engine/ValueEngineContext";
import { useOrganization } from "@/components/layout/OrganizationContext";

export default function LeakagePage() {
  const { leakageEvents, loading } = useValueEngine();
  const { formatCurrency } = useOrganization();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
          APEX ONE · Value Intelligence
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ivory">Revenue Leakage</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
          Leakage views are derived only from authoritative value-opportunity records in
          supported recovery and optimization categories.
        </p>
      </header>

      {loading ? (
        <GlassCard className="p-8 text-center text-sm text-ivory/45">Loading leakage records…</GlassCard>
      ) : leakageEvents.length === 0 ? (
        <GlassCard className="border-dashed p-8 text-center">
          <ShieldAlert size={24} className="mx-auto text-gold/70" />
          <h2 className="mt-4 font-display text-xl font-bold text-ivory">No leakage records</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ivory/45">
            APEX ONE will not insert example SLA leakage, renewal losses or recovery amounts.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {leakageEvents.map((event) => (
            <GlassCard key={event.id} className="p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <p className="font-display text-base font-bold text-ivory">{event.title}</p>
                  <p className="mt-1 text-sm text-ivory/45">{event.description}</p>
                </div>
                <p className="font-mono text-base font-bold text-gold">
                  {formatCurrency(event.leakAmount, true)}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-ivory/35">
                <span>Status: {event.status}</span>
                <span>Recorded confidence: {event.riskScore}%</span>
                <span>Source: {event.systemAffected}</span>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
