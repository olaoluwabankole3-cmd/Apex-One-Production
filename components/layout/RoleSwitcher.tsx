"use client";

import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

/**
 * Read-only authenticated session role indicator.
 *
 * The frontend must never allow a user to select or manufacture a role.
 * Role authority comes only from the server-authenticated session exposed by AuthContext.
 */
export default function RoleSwitcher() {
  const { user, isAuthenticated } = useAuth();
  const roleLabel = isAuthenticated && user ? user.role : "Unauthenticated";

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] font-medium text-ivory/80"
      aria-label={`Authenticated session role: ${roleLabel}`}
      title="Role is assigned by the authenticated server session"
    >
      <span className="hidden sm:inline text-ivory/35">Session role</span>
      <span className="text-ivory">{roleLabel}</span>
      <ShieldCheck size={14} className="text-ivory/40" aria-hidden="true" />
    </div>
  );
}
