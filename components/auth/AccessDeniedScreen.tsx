"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

export default function AccessDeniedScreen() {
  const router = useRouter();
  const {
    user,
    organization,
    availableOrganizations,
    switchOrganization,
    logout,
    isLoading,
  } = useAuth();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (organization?.id) setSelectedOrganizationId(organization.id);
  }, [organization?.id]);

  async function tryAnotherOrganization() {
    if (!selectedOrganizationId || selectedOrganizationId === organization?.id) return;
    setActionError(null);
    try {
      const session = await switchOrganization(selectedOrganizationId);
      router.replace(
        session.user.permissions.includes("org:read") ? "/" : "/access-denied"
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to switch organization."
      );
    }
  }

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  const alternatives = availableOrganizations.filter(
    (item) => item.id !== organization?.id
  );

  return (
    <div id="apex-access-denied-screen" className="flex min-h-screen items-center justify-center bg-matte px-5 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-charcoal/70 p-7 shadow-glass sm:p-9">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 font-display text-sm font-bold text-gold">
            A1
          </div>
          <div>
            <p className="font-display text-lg font-bold text-ivory">APEX ONE</p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-ivory/35">
              Access control
            </p>
          </div>
        </div>

        <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-xl border border-crimson/20 bg-crimson/10 text-crimson">
          <ShieldAlert size={21} />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-ivory">
          Authenticated, but not authorized
        </h1>
        <p className="mt-2 text-sm leading-6 text-ivory/55">
          Your server-authenticated session does not include the capability required to
          enter the internal APEX ONE workspace. No internal business data is displayed.
        </p>

        <div className="mt-6 grid gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-ivory/35">Identity</p>
            <p className="mt-1 break-words font-semibold text-ivory/75">{user?.email || "Unavailable"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-ivory/35">Session role</p>
            <p className="mt-1 font-semibold text-ivory/75">{user?.role || "Unavailable"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-ivory/35">Organization</p>
            <p className="mt-1 font-semibold text-ivory/75">{organization?.name || "Unavailable"}</p>
          </div>
        </div>

        {alternatives.length > 0 && (
          <div className="mt-6">
            <label htmlFor="denied-organization" className="text-xs font-semibold text-ivory/60">
              Try another authorized organization
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Building2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ivory/35" />
                <select
                  id="denied-organization"
                  value={selectedOrganizationId}
                  onChange={(event) => setSelectedOrganizationId(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-white/[0.09] bg-charcoal px-4 py-3 pl-10 text-sm text-ivory outline-none focus:border-gold/40"
                >
                  <option value={organization?.id}>{organization?.name}</option>
                  {alternatives.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={isLoading || selectedOrganizationId === organization?.id}
                onClick={tryAnotherOrganization}
                className="rounded-xl border border-gold/25 bg-gold/10 px-4 py-3 text-sm font-semibold text-gold disabled:opacity-40"
              >
                {isLoading ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Switch"}
              </button>
            </div>
          </div>
        )}

        {actionError && (
          <p role="alert" className="mt-4 rounded-xl border border-crimson/20 bg-crimson/[0.08] p-3 text-sm text-crimson">
            {actionError}
          </p>
        )}

        <button
          type="button"
          onClick={signOut}
          disabled={isLoading}
          className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-ivory/55 hover:text-ivory"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}
