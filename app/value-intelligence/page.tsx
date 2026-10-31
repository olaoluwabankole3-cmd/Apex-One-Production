"use client";

import Link from "next/link";
import { ArrowUpRight, Gem, ShieldAlert, Target, Trophy, Workflow, Zap } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { useAuth } from "@/components/auth/AuthContext";
import { useValueEngine } from "@/components/value-engine/ValueEngineContext";
import { useOrganization } from "@/components/layout/OrganizationContext";

/**
 * One financial-institution value/risk workspace instead of ten competing
 * top-level screens. Modules with missing source systems remain honest.
 */
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
  const { hasPermission } = useAuth();

  const activeOpportunities = opportunities.filter(
    (opportunity) => opportunity.status !== "captured"
  ).length;
  const activeExecution = plays.filter((play) => play.status === "in_progress").length;

  const investigations = [
    {
      href: "/value-intelligence/opportunities",
      title: "Financial value opportunities",
      description: "Investigate recorded opportunities and their source references. A potential value estimate is not a recovered amount.",
      icon: Target,
      permission: "value:read",
    },
    {
      href: "/value-intelligence/leakage",
      title: "Revenue leakage",
      description: "Review leakage-related records and exceptions supported by connected data. No synthetic scans or unverified losses.",
      icon: ShieldAlert,
      permission: "value:read",
    },
    {
      href: "/workflows",
      title: "Response and accountability",
      description: "Route permitted follow-up actions through the existing authorization and workflow controls.",
      icon: Workflow,
      permission: "workflow:read",
    },
    {
      href: "/value-intelligence/captured",
      title: "Recorded outcomes",
      description: "Examine captured-value entries. Recorded does not mean independently verified or certified.",
      icon: Trophy,
      permission: "value:read",
    },
  ].filter((item) => hasPermission(item.permission));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
          CORTEX · Financial Institution Intelligence
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ivory">
          Value &amp; Risk
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
          Find the financial opportunities, leakage-related records and accountable
          responses that the institution can substantiate. CORTEX does not invent
          transaction discrepancies, loss estimates, investigations or recoveries
          where authoritative source integrations are not available.
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

      <section aria-label="Value and risk investigations" className="grid gap-4 md:grid-cols-2">
        {investigations.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-gold/30 hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <div className="flex items-center justify-between">
              <Icon size={19} className="text-gold/80" />
              <ArrowUpRight size={17} className="text-ivory/30 transition-colors group-hover:text-gold" />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold text-ivory">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ivory/45">{description}</p>
          </Link>
        ))}
      </section>

      <GlassCard className="p-6">
        <p className="font-display text-lg font-bold text-ivory">Evidence boundary</p>
        <p className="mt-2 text-sm leading-6 text-ivory/45">
          Financial findings must remain traceable to permitted institutional records.
          A captured-value entry is a record, not automatically independently verified
          evidence. Certification remains governed by the canonical evidence model
          and audit history. Reconciliation and automated exception detection require
          real source integrations and are not claimed as connected here.
        </p>
        <p className="mt-3 text-xs text-ivory/35">
          Captured records available: {capturedLedger.length}
        </p>
      </GlassCard>
    </div>
  );
}
