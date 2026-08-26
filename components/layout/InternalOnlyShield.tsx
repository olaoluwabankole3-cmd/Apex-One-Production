"use client";

import { useRole } from "./RoleContext";
import { ShieldAlert, ArrowRight, UserCheck } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { Role } from "@/lib/types";

interface InternalOnlyShieldProps {
  children: React.ReactNode;
}

export default function InternalOnlyShield({ children }: InternalOnlyShieldProps) {
  const { role, setRole } = useRole();

  if (role === "Customer / Investor") {
    return (
      <div className="mx-auto max-w-[680px] py-12 px-4">
        <GlassCard className="p-6 sm:p-8 border-gold/25 bg-gold/[0.02] text-center space-y-6 shadow-gold-glow">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-gold">
            <ShieldAlert size={28} />
          </div>

          <div className="space-y-2">
            <span className="rounded bg-gold/15 px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-gold">
              APEX ONE SECURE SYSTEM ARCHITECTURE
            </span>
            <h2 className="font-display text-[20px] sm:text-[23px] font-bold text-white tracking-tight">
              Enterprise Back-Office Shield
            </h2>
            <p className="text-[13px] text-ivory/60 leading-relaxed max-w-md mx-auto font-sans">
              You are currently viewing the ecosystem from the outside using the <span className="font-semibold text-gold">APEX CONNECT</span> customer portal. 
              This section is restricted to authorized employees on the <span className="font-semibold text-gold">APEX ONE</span> internal operating system.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4 text-left text-[12px] space-y-2">
            <p className="font-bold text-white uppercase tracking-wider text-[10.5px] font-mono">Connected Worlds Blueprint:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-ivory/60">
              <div>
                <span className="font-semibold text-gold">APEX CONNECT:</span> Used by clients to apply for products, view private portfolios, upload KYC, and book RM video calls.
              </div>
              <div>
                <span className="font-semibold text-gold">APEX ONE:</span> Used by staff (CEO, HR, Sales, Compliance) to approve applications, verify uploaded documents, and track company KPIs.
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setRole("CEO")}
              className="w-full sm:w-auto rounded-lg bg-gold-gradient px-5 py-2.5 text-[12.5px] font-bold text-matte hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-lg"
            >
              <UserCheck size={14} /> Switch to CEO Mode (APEX ONE)
            </button>
            <button
              onClick={() => {
                // Navigate back to overview page
                window.location.href = "/";
              }}
              className="w-full sm:w-auto rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[12.5px] font-medium text-white hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-1.5"
            >
              Back to Customer Portal <ArrowRight size={13} />
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return <>{children}</>;
}
