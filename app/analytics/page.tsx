"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, HeartPulse, ShieldAlert, Users } from "lucide-react";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";
import GlassCard from "@/components/ui/GlassCard";
import { customerRepository } from "@/lib/data/repositories";
import type { Customer } from "@/lib/types";
import { useOrganization } from "@/components/layout/OrganizationContext";

export default function AnalyticsPage() {
  const { formatCurrency } = useOrganization();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    customerRepository
      .getCustomers()
      .then((records) => {
        if (mounted) setCustomers(records);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const totalArr = customers.reduce((sum, customer) => sum + (customer.arr || 0), 0);
    const atRisk = customers.filter(
      (customer) => customer.status === "at-risk" || customer.healthScore < 70
    ).length;
    const averageHealth = customers.length
      ? Math.round(
          customers.reduce((sum, customer) => sum + customer.healthScore, 0) /
            customers.length
        )
      : 0;

    return { totalArr, atRisk, averageHealth };
  }, [customers]);

  return (
    <InternalOnlyShield requiredPermission="financial:read">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
            APEX ONE · Analytics
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ivory">
            Enterprise Analytics
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
            Current metrics are derived only from authorized customer records. Historical
            financial series, causal analysis and cross-system analytics remain unavailable
            until their authoritative data sources are connected.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <GlassCard className="p-5">
            <Users size={17} className="text-gold/70" />
            <p className="mt-4 text-[11px] uppercase tracking-[0.1em] text-ivory/40">
              Authorized accounts
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-ivory">
              {loading ? "—" : customers.length}
            </p>
          </GlassCard>

          <GlassCard className="p-5">
            <BarChart3 size={17} className="text-gold/70" />
            <p className="mt-4 text-[11px] uppercase tracking-[0.1em] text-ivory/40">
              Recorded ARR
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-ivory">
              {loading ? "—" : formatCurrency(metrics.totalArr, true)}
            </p>
          </GlassCard>

          <GlassCard className="p-5">
            <ShieldAlert size={17} className="text-gold/70" />
            <p className="mt-4 text-[11px] uppercase tracking-[0.1em] text-ivory/40">
              Accounts flagged
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-ivory">
              {loading ? "—" : metrics.atRisk}
            </p>
          </GlassCard>

          <GlassCard className="p-5">
            <HeartPulse size={17} className="text-gold/70" />
            <p className="mt-4 text-[11px] uppercase tracking-[0.1em] text-ivory/40">
              Average health score
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-ivory">
              {loading || customers.length === 0 ? "—" : `${metrics.averageHealth}%`}
            </p>
          </GlassCard>
        </div>

        <GlassCard className="p-7">
          <p className="font-display text-lg font-bold text-ivory">Analytics coverage</p>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="font-medium text-ivory/80">Available now</p>
              <p className="mt-1 text-ivory/45">
                Customer count, recorded ARR, account health and risk flags from authorized
                customer records.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="font-medium text-ivory/80">Requires connected sources</p>
              <p className="mt-1 text-ivory/45">
                Historical revenue trends, targets, margins, causal analysis, forecasts and
                subsidiary performance telemetry.
              </p>
            </div>
          </div>
          {failed && (
            <p className="mt-4 text-sm text-crimson/80">
              The authorized customer analytics request could not be completed.
            </p>
          )}
        </GlassCard>
      </div>
    </InternalOnlyShield>
  );
}
