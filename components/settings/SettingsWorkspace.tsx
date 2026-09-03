"use client";

import { Database, KeyRound, Network, ShieldCheck, UserRound } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { useAuth } from "@/components/auth/AuthContext";

export default function SettingsWorkspace() {
  const { user, organization, availableOrganizations } = useAuth();

  const rows = [
    {
      label: "Authenticated identity",
      value: user ? user.name || user.email : "Unavailable",
      icon: UserRound,
    },
    {
      label: "Server-assigned role",
      value: user?.role || "Unavailable",
      icon: ShieldCheck,
    },
    {
      label: "Active organization",
      value: organization?.name || "Unavailable",
      icon: Network,
    },
    {
      label: "Available organizations",
      value: String(availableOrganizations.length),
      icon: Database,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
          APEX ONE · Administration
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ivory">
          Settings & Integrations
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
          This surface reports authenticated configuration only. It does not claim external
          systems are connected and does not expose local controls that pretend to change
          server-side AI, security or financial policy.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map(({ label, value, icon: Icon }) => (
          <GlassCard key={label} className="p-5">
            <Icon size={17} className="text-gold/70" />
            <p className="mt-4 text-[11px] uppercase tracking-[0.1em] text-ivory/40">{label}</p>
            <p className="mt-1 break-words font-display text-lg font-bold text-ivory">{value}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-6">
        <div className="flex items-start gap-3">
          <KeyRound size={19} className="mt-0.5 shrink-0 text-gold/70" />
          <div>
            <h2 className="font-display text-lg font-bold text-ivory">
              Configuration boundary
            </h2>
            <p className="mt-2 text-sm leading-6 text-ivory/45">
              Database, Redis, object-storage, AI-provider and deployment credentials are
              server/deployment configuration and are not displayed here. Enterprise
              connector management will be added only when backed by an authoritative
              integration service.
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="border-dashed p-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-gold/70">
          External integrations
        </p>
        <p className="mt-2 text-sm text-ivory/50">
          No connector inventory API is currently available to this settings surface.
          Therefore no CRM, identity provider, warehouse or other external service is
          displayed as “connected.”
        </p>
      </GlassCard>
    </div>
  );
}
