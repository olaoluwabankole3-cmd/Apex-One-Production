"use client";

import { ShieldAlert, ArrowRight } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { useAuth } from "@/components/auth/AuthContext";

interface InternalOnlyShieldProps {
  children: React.ReactNode;
  /**
   * Optional additional capability required for this internal UI surface.
   * `org:read` is always required first so external/customer sessions cannot
   * enter APEX ONE merely because they hold a domain read capability.
   */
  requiredPermission?: string;
}

/**
 * UX-only privileged UI boundary derived from authenticated session metadata.
 *
 * SECURITY NOTE:
 * This component is not the authoritative security boundary. It only prevents
 * the normal frontend from rendering privileged surfaces when the authenticated
 * server session does not advertise the required capabilities. Every protected
 * backend operation must continue to enforce authorization independently.
 */
export default function InternalOnlyShield({
  children,
  requiredPermission,
}: InternalOnlyShieldProps) {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();

  // Fail closed while the server-backed HttpOnly-cookie session is unresolved.
  if (isLoading) {
    return null;
  }

  const hasInternalSessionCapability =
    isAuthenticated && hasPermission("org:read");
  const hasRequiredCapability = requiredPermission
    ? hasPermission(requiredPermission)
    : true;
  const hasAccess = hasInternalSessionCapability && hasRequiredCapability;

  if (!hasAccess) {
    const denialMessage = !isAuthenticated
      ? "A valid authenticated session is required to access this internal APEX ONE section."
      : !hasInternalSessionCapability
        ? "Your authenticated session is assigned to the APEX CONNECT customer environment and does not include internal APEX ONE access."
        : "Your authenticated session does not include the capability required for this privileged APEX ONE section.";

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
              {denialMessage}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4 text-left text-[12px] space-y-2">
            <p className="font-bold text-white uppercase tracking-wider text-[10.5px] font-mono">
              Connected Worlds Blueprint:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-ivory/60">
              <div>
                <span className="font-semibold text-gold">APEX CONNECT:</span> Used by clients to apply for products, view private portfolios, upload KYC, and book RM video calls.
              </div>
              <div>
                <span className="font-semibold text-gold">APEX ONE:</span> Used by authorized staff to operate internal workflows and enterprise functions.
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-center">
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="w-full sm:w-auto rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[12.5px] font-medium text-white hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-1.5"
            >
              Back to Overview <ArrowRight size={13} />
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return <>{children}</>;
}
