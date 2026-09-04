"use client";

import { Gem, Target, Trophy, Zap } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { useValueEngine } from "@/components/value-engine/ValueEngineContext";
import { useOrganization } from "@/components/layout/OrganizationContext";

export default function ValueIntelligencePage() {
  const {
    opportunities,
    capturedLedger,
    plays,
    totalIdentified,
    totalCaptured,
    loading,
  } = useValueEngine();
  const { formatCurrency } = useOrganization();

  const activeOpportunities = opportunities.filter(
    (opportunity) => opportunity.status !== "captured"
  ).length;
  const activeExecution = plays.filter((play) => play.status === "in_progress").length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
          APEX ONE · Value Intelligence
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ivory">
          Value Overview
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
          Values shown here come from the authoritative opportunity, action and captured-value
          APIs. APEX ONE no longer inserts demo leakage totals, synthetic scans or fabricated
          capture outcomes.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Identified potential value", value: formatCurrency(totalIdentified, true), icon: Gem },
          { label: "Recorded captured value", value: formatCurrency(totalCaptured, true), icon: Trophy },
          { label: "Active opportunities", value: String(activeOpportunities), icon: Target },
          { label: "Actions in progress", value: String(activeExecution), icon: Zap },
        ].map(({ label, value, icon: Icon }) => (
          <GlassCard key={label} className="p-5">
            <Icon size={17} className="text-gold/70" />
            <p className="mt-4 text-[11px] uppercase tracking-[0.1em] text-ivory/40">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-ivory">
              {loading ? "—" : value}
            </p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-6">
        <p className="font-display text-lg font-bold text-ivory">Evidence boundary</p>
        <p className="mt-2 text-sm leading-6 text-ivory/45">
          A recorded captured-value entry is displayed as a record, not automatically as
          independently verified or certified evidence. Certification remains governed by
          the canonical evidence model and audit history.
        </p>
        <p className="mt-3 text-xs text-ivory/35">
          Captured records available: {capturedLedger.length}
        </p>
      </GlassCard>
    </div>
  );
}
