"use client";

import { Trophy } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { useValueEngine } from "@/components/value-engine/ValueEngineContext";
import { useOrganization } from "@/components/layout/OrganizationContext";

export default function CapturedValuePage() {
  const { capturedLedger, totalCaptured, loading } = useValueEngine();
  const { formatCurrency } = useOrganization();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
          APEX ONE · Value Intelligence
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ivory">Captured Value Records</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
          These are durable captured-value records returned by the backend. Record presence
          is not presented as independent verification or certification.
        </p>
      </header>

      <GlassCard className="p-5">
        <Trophy size={17} className="text-gold/70" />
        <p className="mt-4 text-[11px] uppercase tracking-[0.1em] text-ivory/40">Recorded captured value</p>
        <p className="mt-1 font-display text-3xl font-bold text-ivory">
          {loading ? "—" : formatCurrency(totalCaptured, true)}
        </p>
      </GlassCard>

      {!loading && capturedLedger.length === 0 ? (
        <GlassCard className="border-dashed p-8 text-center">
          <h2 className="font-display text-xl font-bold text-ivory">No captured-value records</h2>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {capturedLedger.map((entry) => (
            <GlassCard key={entry.id} className="p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="font-display text-base font-bold text-ivory">{entry.playTitle}</p>
                  <p className="mt-1 text-xs text-ivory/40">{entry.category} · {entry.date}</p>
                </div>
                <p className="font-mono text-base font-bold text-gold">{formatCurrency(entry.amountCaptured, true)}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-ivory/45">{entry.impactMetrics}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
