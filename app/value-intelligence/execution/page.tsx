"use client";

import { Zap } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { useValueEngine } from "@/components/value-engine/ValueEngineContext";
import { useOrganization } from "@/components/layout/OrganizationContext";
import { useAuth } from "@/components/auth/AuthContext";

export default function ExecutionPage() {
  const { plays, executePlayStep, loading } = useValueEngine();
  const { formatCurrency } = useOrganization();
  const { hasPermission } = useAuth();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
          APEX ONE · Value Intelligence
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ivory">Execution Center</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
          Action status and logs are read from the backend. Advancing an action calls the
          authoritative action lifecycle endpoint; no frontend timer marks work complete.
        </p>
      </header>

      {loading ? (
        <GlassCard className="p-8 text-center text-sm text-ivory/45">Loading execution records…</GlassCard>
      ) : plays.length === 0 ? (
        <GlassCard className="border-dashed p-8 text-center">
          <Zap size={24} className="mx-auto text-gold/70" />
          <h2 className="mt-4 font-display text-xl font-bold text-ivory">No execution actions</h2>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {plays.map((play) => (
            <GlassCard key={play.id} className="p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <p className="font-display text-base font-bold text-ivory">{play.title}</p>
                  <p className="mt-1 text-sm text-ivory/45">{play.description}</p>
                </div>
                <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-wider text-ivory/45">
                  {play.status.replace("_", " ")}
                </span>
              </div>
              <p className="mt-4 text-xs text-ivory/35">
                Expected value field: {formatCurrency(play.estimatedGain, true)}
              </p>
              {play.logs.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {play.logs.map((log, index) => (
                    <p key={index} className="font-mono text-[10.5px] text-ivory/40">{log}</p>
                  ))}
                </div>
              )}
              {hasPermission("action:execute") && play.status !== "completed" && (
                <button
                  onClick={() => executePlayStep(play.id)}
                  className="mt-4 rounded-lg bg-gold px-4 py-2 text-xs font-bold text-matte"
                >
                  Advance authoritative action
                </button>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
