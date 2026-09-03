"use client";

import { ShieldAlert } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { useAuth } from "@/components/auth/AuthContext";

interface InternalOnlyShieldProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export default function InternalOnlyShield({
  children,
  requiredPermission,
}: InternalOnlyShieldProps) {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();

  if (isLoading) return null;

  const hasInternalAccess = isAuthenticated && hasPermission("org:read");
  const hasRequiredCapability = requiredPermission ? hasPermission(requiredPermission) : true;

  if (!hasInternalAccess || !hasRequiredCapability) {
    const denialMessage = !isAuthenticated
      ? "A valid authenticated session is required to access this internal APEX ONE section."
      : !hasInternalAccess
        ? "Your authenticated session is not authorized for the APEX ONE internal workspace."
        : "Your authenticated session does not include the capability required for this privileged APEX ONE section.";

    return (
      <div className="mx-auto max-w-[680px] px-4 py-12">
        <GlassCard className="space-y-5 border-gold/25 bg-gold/[0.02] p-6 text-center shadow-gold-glow sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-gold">
            <ShieldAlert size={28} />
          </div>
          <div className="space-y-2">
            <span className="rounded bg-gold/15 px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-gold">
              APEX ONE ACCESS CONTROL
            </span>
            <h2 className="font-display text-[20px] font-bold tracking-tight text-white sm:text-[23px]">
              Access denied
            </h2>
            <p className="mx-auto max-w-md text-[13px] leading-relaxed text-ivory/60">
              {denialMessage}
            </p>
          </div>
        </GlassCard>
      </div>
    );
  }

  return <>{children}</>;
}
