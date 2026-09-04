"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthClientError } from "@/lib/authClient";

function safeNextFromLocation(): string {
  if (typeof window === "undefined") return "/";
  const candidate = new URLSearchParams(window.location.search).get("next") || "/";
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/";
  if (
    candidate === "/login" ||
    candidate === "/forgot-password" ||
    candidate === "/access-denied"
  ) {
    return "/";
  }
  return candidate;
}

function loginErrorMessage(error: unknown): string {
  if (error instanceof AuthClientError) {
    if (error.status === 403) {
      return "Your credentials were accepted, but this account is not authorized for an active APEX ONE organization. Contact your administrator.";
    }
    if (error.status === 401) {
      if (error.message.toLowerCase().includes("too many failed login attempts")) {
        return error.message;
      }
      return "The email/username or password is incorrect, or this account is unavailable.";
    }
    if (error.status === 400) return error.message;
  }
  return "APEX ONE could not complete sign-in. Please try again.";
}

const noticeCopy = {
  session_expired: "Your session ended. Sign in again to continue securely.",
  signed_out: "You have been signed out securely.",
  password_changed: "Password updated. Sign in with your new password.",
} as const;

export default function LoginScreen() {
  const router = useRouter();
  const {
    login,
    switchOrganization,
    confirmOrganizationSelection,
    user,
    organization,
    availableOrganizations,
    isAuthenticated,
    isLoading,
    requiresPasswordChange,
    organizationSelectionRequired,
    notice,
  } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");

  useEffect(() => {
    if (organization?.id) setSelectedOrganizationId(organization.id);
  }, [organization?.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!identifier.trim() || !password) {
      setFormError("Enter your email/username and password.");
      return;
    }

    try {
      const session = await login({ identifier, password });
      if (session.requiresPasswordChange) {
        router.replace("/account/security?required=1");
        return;
      }
      if (session.availableOrganizations.length > 1) {
        return;
      }
      router.replace(safeNextFromLocation());
    } catch (error) {
      setFormError(loginErrorMessage(error));
    }
  }

  async function enterOrganization() {
    if (!selectedOrganizationId || !organization) return;
    setFormError(null);
    try {
      let session;
      if (selectedOrganizationId === organization.id) {
        confirmOrganizationSelection();
        session = {
          user: user!,
          organization,
          availableOrganizations,
          requiresPasswordChange,
        };
      } else {
        session = await switchOrganization(selectedOrganizationId);
      }

      if (session.requiresPasswordChange) {
        router.replace("/account/security?required=1");
        return;
      }
      router.replace(safeNextFromLocation());
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to enter the selected organization."
      );
    }
  }

  const showOrganizationChoice =
    isAuthenticated &&
    organizationSelectionRequired &&
    availableOrganizations.length > 1;

  return (
    <div
      id="apex-login-screen"
      className="relative min-h-screen overflow-hidden bg-matte px-5 py-8 sm:px-8 lg:px-12"
    >
      <div className="pointer-events-none absolute inset-0 bg-grain-radial opacity-70" />
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gold/[0.06] blur-3xl" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/[0.08] bg-charcoal/65 shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden border-r border-white/[0.06] p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 font-display text-sm font-bold text-gold">
                A1
              </div>
              <div>
                <p className="font-display text-xl font-bold text-ivory">APEX ONE</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ivory/35">
                  Executive Intelligence OS
                </p>
              </div>
            </div>

            <div className="mt-16 max-w-md">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-gold/70">
                Secure enterprise access
              </p>
              <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight text-ivory">
                Intelligence, decisions and execution in one trusted workspace.
              </h1>
              <p className="mt-5 text-sm leading-7 text-ivory/45">
                Sign in with an identity provisioned by your organization. APEX ONE derives
                tenant access, role and permissions exclusively from the authenticated
                server session.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              "HttpOnly session credentials",
              "Server-authoritative organization membership",
              "Capability-derived workspace access",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-ivory/55">
                <CheckCircle2 size={16} className="text-gold/75" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10 xl:p-14">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 font-display text-sm font-bold text-gold">
                A1
              </div>
              <div>
                <p className="font-display text-lg font-bold text-ivory">APEX ONE</p>
                <p className="text-[9px] uppercase tracking-[0.14em] text-ivory/35">
                  Executive Intelligence OS
                </p>
              </div>
            </div>

            {showOrganizationChoice ? (
              <div id="apex-organization-selector">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
                  <Building2 size={21} />
                </div>
                <h2 className="mt-5 font-display text-2xl font-bold text-ivory">
                  Choose your organization
                </h2>
                <p className="mt-2 text-sm leading-6 text-ivory/50">
                  {user?.name ? `${user.name}, your` : "Your"} account belongs to more
                  than one authorized organization. Choose the workspace to enter.
                </p>

                <div className="mt-6 space-y-2">
                  {availableOrganizations.map((item) => (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 transition-colors hover:border-gold/25"
                    >
                      <input
                        type="radio"
                        name="organization"
                        value={item.id}
                        checked={selectedOrganizationId === item.id}
                        onChange={() => setSelectedOrganizationId(item.id)}
                        className="accent-current"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ivory">{item.name}</p>
                        {item.id === organization?.id && (
                          <p className="mt-0.5 text-[11px] text-gold/60">Current session organization</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                {formError && (
                  <p id="organization-selection-error" role="alert" className="mt-4 rounded-xl border border-crimson/20 bg-crimson/[0.08] p-3 text-sm text-crimson">
                    {formError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={enterOrganization}
                  disabled={isLoading || !selectedOrganizationId}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gold-gradient px-4 py-3 text-sm font-bold text-matte transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  Enter workspace
                </button>
              </div>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
                  <LockKeyhole size={21} />
                </div>
                <h2 className="mt-5 font-display text-2xl font-bold text-ivory">
                  Sign in to APEX ONE
                </h2>
                <p className="mt-2 text-sm leading-6 text-ivory/50">
                  Use your organization-issued email address or username.
                </p>

                {notice && (
                  <div className="mt-5 flex items-start gap-3 rounded-xl border border-gold/15 bg-gold/[0.05] p-3.5 text-sm text-ivory/65">
                    <ShieldCheck size={17} className="mt-0.5 shrink-0 text-gold/75" />
                    <span>{noticeCopy[notice]}</span>
                  </div>
                )}

                {formError && (
                  <p id="login-error" role="alert" className="mt-5 rounded-xl border border-crimson/20 bg-crimson/[0.08] p-3.5 text-sm leading-5 text-crimson">
                    {formError}
                  </p>
                )}

                <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                  <div>
                    <label htmlFor="login-identifier" className="text-xs font-semibold text-ivory/65">
                      Email or username
                    </label>
                    <input
                      id="login-identifier"
                      name="identifier"
                      autoComplete="username"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      placeholder="you@company.com"
                      className="mt-2 w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 py-3 text-sm text-ivory outline-none transition-colors placeholder:text-ivory/25 focus:border-gold/40"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <label htmlFor="login-password" className="text-xs font-semibold text-ivory/65">
                        Password
                      </label>
                      <Link href="/forgot-password" className="text-xs font-medium text-gold/75 hover:text-gold">
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative mt-2">
                      <input
                        id="login-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 py-3 pr-11 text-sm text-ivory outline-none transition-colors focus:border-gold/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ivory/35 transition-colors hover:text-ivory/70"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <button
                    id="login-submit"
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-gradient px-4 py-3 text-sm font-bold text-matte transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                    {isLoading ? "Signing in…" : "Sign in securely"}
                  </button>
                </form>

                <p className="mt-6 text-center text-[11px] leading-5 text-ivory/30">
                  Session credentials are stored only in a hardened HttpOnly cookie and are
                  never exposed to application JavaScript.
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
