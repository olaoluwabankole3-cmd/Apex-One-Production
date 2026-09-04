"use client";

import { Gem } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { useValueEngine } from "@/components/value-engine/ValueEngineContext";
import { useOrganization } from "@/components/layout/OrganizationContext";

export default function ValueOpportunitiesPage() {
  const { opportunities, loading } = useValueEngine();
  const { formatCurrency } = useOrganization();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
          APEX ONE · Value Intelligence
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ivory">Value Opportunities</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
          Opportunity records originate from the value service. The frontend does not run
          a synthetic AI scan or manufacture opportunity values.
        </p>
      </header>

      {loading ? (
        <GlassCard className="p-8 text-center text-sm text-ivory/45">Loading opportunities…</GlassCard>
      ) : opportunities.length === 0 ? (
        <GlassCard className="border-dashed p-8 text-center">
          <Gem size={24} className="mx-auto text-gold/70" />
          <h2 className="mt-4 font-display text-xl font-bold text-ivory">No opportunity records</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ivory/45">
            No authoritative value opportunities are available for this organization.
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {opportunities.map((opportunity) => (
            <GlassCard key={opportunity.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-base font-bold text-ivory">{opportunity.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-gold/60">{opportunity.category}</p>
                </div>
                <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-wider text-ivory/45">
                  {opportunity.status.replace("_", " ")}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-ivory/50">{opportunity.description}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-ivory/30">Potential value</p>
                  <p className="mt-1 font-mono text-sm font-bold text-ivory">
                    {formatCurrency(opportunity.valueAmount, true)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-ivory/30">Recorded confidence</p>
                  <p className="mt-1 font-mono text-sm font-bold text-ivory">{opportunity.confidence}%</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-ivory/35">
                Source entity type: {opportunity.sourceSystem}
              </p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
