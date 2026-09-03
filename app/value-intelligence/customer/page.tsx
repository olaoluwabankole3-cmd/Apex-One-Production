"use client";

import { UserCheck } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { useValueEngine } from "@/components/value-engine/ValueEngineContext";
import { useOrganization } from "@/components/layout/OrganizationContext";

export default function CustomerValuePage() {
  const { customerValues, loading } = useValueEngine();
  const { formatCurrency } = useOrganization();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
          APEX ONE · Value Intelligence
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ivory">Customer Value</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
          This view uses authorized customer records only. Expansion values are displayed
          only when explicitly present in the customer contract.
        </p>
      </header>

      {loading ? (
        <GlassCard className="p-8 text-center text-sm text-ivory/45">Loading customer value records…</GlassCard>
      ) : customerValues.length === 0 ? (
        <GlassCard className="border-dashed p-8 text-center">
          <UserCheck size={24} className="mx-auto text-gold/70" />
          <h2 className="mt-4 font-display text-xl font-bold text-ivory">No customer value records</h2>
        </GlassCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {customerValues.map((customer) => (
            <GlassCard key={customer.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-base font-bold text-ivory">{customer.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-gold/60">{customer.tier}</p>
                </div>
                <span className="text-xs text-ivory/45">Risk: {customer.churnRisk}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-ivory/30">Recorded ARR</p>
                  <p className="mt-1 font-mono text-sm font-bold text-ivory">{formatCurrency(customer.contractValue, true)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-ivory/30">Expansion field</p>
                  <p className="mt-1 font-mono text-sm font-bold text-ivory">
                    {customer.expansionOpportunity > 0 ? formatCurrency(customer.expansionOpportunity, true) : "Not recorded"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-ivory/30">Health score</p>
                  <p className="mt-1 font-mono text-sm font-bold text-ivory">{customer.confidence}%</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-ivory/45">{customer.recommended}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
