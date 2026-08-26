import React from "react";
import { Cpu } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  badge?: string;
}

export default function ValueIntelligenceEmptyState({
  title = "Enterprise intelligence awaiting data",
  description = "Connect financial and operational data streams to populate the intelligence engine.",
  badge = "Intelligence System Offline"
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-12 text-center shadow-glass max-w-2xl mx-auto my-12" id="value-intelligence-empty-state">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/5 border border-gold/15 text-gold mb-5">
        <Cpu size={24} className="animate-pulse" />
      </div>
      <h3 className="font-display text-[18px] font-bold tracking-tight text-ivory uppercase">
        {title}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-ivory/55">
        {description}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <span className="rounded-lg bg-white/[0.02] border border-white/[0.08] px-4 py-2 text-[11px] font-mono text-ivory/40 uppercase tracking-wider">
          {badge}
        </span>
      </div>
    </div>
  );
}
