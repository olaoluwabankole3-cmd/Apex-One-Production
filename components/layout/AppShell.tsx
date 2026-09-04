"use client";

import { Loader2, LockKeyhole, ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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
        <p className="font-display text-lg font-bold tracking-tight text-ivory">
          APEX ONE
        </p>
        <p className="text-[10px] uppercase tracking-[0.14em] text-ivory/35">
          Executive Intelligence OS
        </p>
      </div>
    </div>
  );
}

function TransitionState({
  id,
  title,
  detail,
  denied = false,
}: {
  id: string;
  title: string;
  detail: string;
  denied?: boolean;
}) {
  return (
    <div id={id} className="flex min-h-screen items-center justify-center bg-matte px-6">
      <div className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-charcoal/70 p-8 shadow-glass">
        <BrandMark />
        <div
          className={
            "mt-8 flex h-12 w-12 items-center justify-center rounded-xl border " +
            (denied
              ? "border-crimson/20 bg-crimson/10 text-crimson"
              : "border-gold/20 bg-gold/10 text-gold")
          }
        >
          {denied ? (
            <ShieldAlert size={22} />
          ) : (
            <LockKeyhole size={22} />
          )}
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-ivory">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ivory/55">{detail}</p>
        <div className="mt-5 flex items-center gap-2 text-xs text-ivory/35">
          <Loader2 size={14} className="animate-spin text-gold" />
          Applying secure session routing…
        </div>
      </div>
    </div>
  );
}

function safeNextPath(pathname: string): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return "/";
  if (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/access-denied"
  ) {
    return "/";
  }
  return pathname;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const {
    isSessionLoading,
    isAuthenticated,
    hasPermission,
    requiresPasswordChange,
    organizationSelectionRequired,
  } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPath = pathname === "/login";
  const isForgotPasswordPath = pathname === "/forgot-password";
  const isPublicAuthPath = isLoginPath || isForgotPasswordPath;
  const isPasswordSecurityPath = pathname === "/account/security";
  const isAccessDeniedPath = pathname === "/access-denied";

  useEffect(() => {
    if (isSessionLoading) return;

    if (!isAuthenticated) {
      if (!isPublicAuthPath) {
        router.replace(
          `/login?next=${encodeURIComponent(safeNextPath(pathname))}`
        );
      }
      return;
    }

    if (requiresPasswordChange) {
      if (!isPasswordSecurityPath) {
        router.replace("/account/security?required=1");
      }
      return;
    }

    if (organizationSelectionRequired) {
      if (!isLoginPath) {
        router.replace(
          `/login?selectOrganization=1&next=${encodeURIComponent(
            safeNextPath(pathname)
          )}`
        );
      }
      return;
    }

    if (!hasPermission("org:read")) {
      if (!isAccessDeniedPath && !isPasswordSecurityPath) {
        router.replace("/access-denied");
      }
      return;
    }

    if (isPublicAuthPath || isAccessDeniedPath) {
      router.replace("/");
    }
  }, [
    hasPermission,
    isAccessDeniedPath,
    isSessionLoading,
    isLoginPath,
    isPasswordSecurityPath,
    isPublicAuthPath,
    isAuthenticated,
    organizationSelectionRequired,
    pathname,
    requiresPasswordChange,
    router,
  ]);

  if (isSessionLoading) {
    return (
      <div
        id="apex-session-loading"
        className="flex min-h-screen items-center justify-center bg-matte px-6"
      >
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
    if (isPublicAuthPath) {
      return <div id="apex-public-auth-shell">{children}</div>;
    }

    return (
      <TransitionState
        id="apex-authentication-required"
        title="Authentication required"
        detail="A valid authenticated session is required to access APEX ONE. No enterprise data is rendered while the browser is being redirected to secure sign-in."
      />
    );
  }

  if (requiresPasswordChange) {
    if (isPasswordSecurityPath) {
      return <div id="apex-required-password-shell">{children}</div>;
    }
    return (
      <TransitionState
        id="apex-password-change-required"
        title="Password update required"
        detail="Your authenticated account requires a password update before the APEX ONE workspace can be entered."
      />
    );
  }

  if (organizationSelectionRequired) {
    if (isLoginPath) {
      return <div id="apex-organization-selection-shell">{children}</div>;
    }
    return (
      <TransitionState
        id="apex-organization-selection-required"
        title="Choose an organization"
        detail="Your account belongs to more than one authorized organization. Confirm the workspace you want to enter."
      />
    );
  }

  if (!hasPermission("org:read")) {
    if (isAccessDeniedPath || isPasswordSecurityPath) {
      return <div id="apex-restricted-auth-shell">{children}</div>;
    }

    return (
      <TransitionState
        id="apex-access-denied"
        title="Access denied"
        detail="Your authenticated session is not authorized for the APEX ONE internal workspace."
        denied
      />
    );
  }

  if (isPublicAuthPath || isAccessDeniedPath) {
    return (
      <TransitionState
        id="apex-authenticated-redirect"
        title="Session confirmed"
        detail="Your authenticated workspace is ready."
      />
    );
  }

  return (
    <div id="apex-authenticated-shell" className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <ApiFailureBanner />
        <main className="ml-0 flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-10 -mt-[8px]">
          {children}
        </main>
      </div>
    </div>
  );
}
