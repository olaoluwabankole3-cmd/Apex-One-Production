"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, KeyRound, Loader2, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

export default function UserMenu() {
  const router = useRouter();
  const {
    user,
    organization,
    availableOrganizations,
    switchOrganization,
    logout,
    isLoading,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const [switchingError, setSwitchingError] = useState<string | null>(null);

  const initials = user?.name
    ? user.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("")
    : "--";

  async function selectOrganization(id: string) {
    if (!organization || id === organization.id) {
      setOpen(false);
      return;
    }
    setSwitchingError(null);
    try {
      const session = await switchOrganization(id);
      setOpen(false);
      router.replace(
        session.user.permissions.includes("org:read") ? "/" : "/access-denied"
      );
    } catch (error) {
      setSwitchingError(
        error instanceof Error ? error.message : "Organization switch failed."
      );
    }
  }

  async function signOut() {
    setOpen(false);
    await logout();
    router.replace("/login");
  }

  return (
    <div className="relative">
      <button
        id="apex-user-menu-button"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-1.5 pr-2.5 text-ivory/70 transition-colors hover:border-gold/25 hover:text-ivory"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gold-gradient font-display text-[10px] font-bold text-matte">
          {initials}
        </span>
        <ChevronDown size={13} className="text-ivory/35" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-80 overflow-hidden rounded-xl border border-white/[0.09] bg-charcoal shadow-2xl"
        >
          <div className="border-b border-white/[0.06] p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/20 bg-gold/10 text-gold">
                <UserRound size={17} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ivory">{user?.name || "Authenticated user"}</p>
                <p className="mt-0.5 truncate text-xs text-ivory/40">{user?.email}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-gold/60">{user?.role}</p>
              </div>
            </div>
          </div>

          <div className="p-2">
            <div className="rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-ivory/30">Active organization</p>
              <p className="mt-1 truncate text-sm font-medium text-ivory/70">{organization?.name}</p>
            </div>

            {availableOrganizations.length > 1 && (
              <div className="mt-1 border-t border-white/[0.05] pt-2">
                <p className="px-3 pb-1.5 text-[10px] uppercase tracking-[0.12em] text-ivory/30">
                  Switch organization
                </p>
                {availableOrganizations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => selectOrganization(item.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ivory/55 hover:bg-white/[0.04] hover:text-ivory disabled:opacity-50"
                  >
                    <Building2 size={14} className={item.id === organization?.id ? "text-gold" : "text-ivory/30"} />
                    <span className="truncate">{item.name}</span>
                    {isLoading && item.id !== organization?.id && <Loader2 size={12} className="ml-auto animate-spin" />}
                  </button>
                ))}
              </div>
            )}

            {switchingError && (
              <p className="mx-2 mt-2 rounded-lg border border-crimson/20 bg-crimson/[0.08] p-2 text-xs text-crimson">
                {switchingError}
              </p>
            )}

            <div className="mt-2 border-t border-white/[0.05] pt-2">
              <Link
                href="/account/security"
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ivory/55 hover:bg-white/[0.04] hover:text-ivory"
              >
                <KeyRound size={14} />
                Change password
              </Link>
              <button
                id="apex-logout-button"
                type="button"
                onClick={signOut}
                disabled={isLoading}
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ivory/55 hover:bg-white/[0.04] hover:text-ivory disabled:opacity-50"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
