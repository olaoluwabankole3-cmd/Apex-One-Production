"use client";

import { LockKeyhole, Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import ApiFailureBanner from "@/components/layout/ApiFailureBanner";

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 font-display text-sm font-bold text-gold">
        A1
      </div>
      <div>
        <p className="font-display text-lg font-bold tracking-tight text-ivory">APEX ONE</p>
        <p className="text-[10px] uppercase tracking-[0.14em] text-ivory/35">Executive Intelligence OS</p>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div id="apex-session-loading" className="flex min-h-screen items-center justify-center bg-matte px-6">
        <div className="flex flex-col items-center gap-5 text-center">
          <BrandMark />
          <div className="flex items-center gap-2 text-sm text-ivory/50">
            <Loader2 size={16} className="animate-spin text-gold" />
            Verifying secure session…
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div id="apex-authentication-required" className="flex min-h-screen items-center justify-center bg-matte px-6">
        <div className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-charcoal/70 p-8 shadow-glass">
          <BrandMark />
          <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
            <LockKeyhole size={22} />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-ivory">Authentication required</h1>
          <p className="mt-2 text-sm leading-6 text-ivory/55">
            A valid authenticated session is required to access APEX ONE. No enterprise,
            customer, financial, workflow, document, or intelligence data is rendered until
            the server confirms the user identity.
          </p>
          <p className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs leading-5 text-ivory/40">
            Secure sign-in is being completed as a dedicated authentication experience.
            This screen deliberately fails closed instead of falling back to demo or client-portal data.
          </p>
        </div>
      </div>
    );
  }

  if (!hasPermission("org:read")) {
    return (
      <div id="apex-access-denied" className="flex min-h-screen items-center justify-center bg-matte px-6">
        <div className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-charcoal/70 p-8 shadow-glass">
          <BrandMark />
          <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-xl border border-crimson/20 bg-crimson/10 text-crimson">
            <ShieldAlert size={22} />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-ivory">Access denied</h1>
          <p className="mt-2 text-sm leading-6 text-ivory/55">
            Your authenticated session is not authorized for the APEX ONE internal workspace.
            No internal business data has been displayed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="apex-authenticated-shell" className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <ApiFailureBanner />
        <main className="ml-0 flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-10 -mt-[8px]">{children}</main>
      </div>
    </div>
  );
}
