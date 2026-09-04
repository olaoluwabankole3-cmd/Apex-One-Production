"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthClientError } from "@/lib/authClient";

export default function PasswordChangeScreen() {
  const router = useRouter();
  const { user, requiresPasswordChange, changePassword, isLoading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setFormError("Complete all password fields.");
      return;
    }
    if (newPassword.length < 8) {
      setFormError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("New password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setFormError("Choose a new password that differs from the current password.");
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      router.replace("/login");
    } catch (error) {
      if (error instanceof AuthClientError && error.status === 401) {
        setFormError("Current password is incorrect.");
        return;
      }
      setFormError(error instanceof Error ? error.message : "Password change failed.");
    }
  }

  return (
    <div id="apex-password-change-screen" className="flex min-h-screen items-center justify-center bg-matte px-5 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-charcoal/70 p-7 shadow-glass sm:p-9">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 font-display text-sm font-bold text-gold">
            A1
          </div>
          <div>
            <p className="font-display text-lg font-bold text-ivory">APEX ONE</p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-ivory/35">Account security</p>
          </div>
        </div>

        <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
          <KeyRound size={21} />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-ivory">
          {requiresPasswordChange ? "Update your password to continue" : "Change your password"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ivory/55">
          {requiresPasswordChange
            ? "Your server-authenticated account is marked for a required password change. Workspace access remains blocked until it is completed."
            : `Update the password for ${user?.email || "your authenticated account"}.`}
        </p>

        {requiresPasswordChange && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-gold/15 bg-gold/[0.05] p-4">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-gold/75" />
            <p className="text-sm leading-6 text-ivory/55">
              After a successful change, all sessions for this account are revoked and you
              must sign in again with the new password.
            </p>
          </div>
        )}

        {formError && (
          <p role="alert" className="mt-5 rounded-xl border border-crimson/20 bg-crimson/[0.08] p-3.5 text-sm text-crimson">
            {formError}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label htmlFor="current-password" className="text-xs font-semibold text-ivory/65">Current password</label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 py-3 text-sm text-ivory outline-none focus:border-gold/40"
            />
          </div>

          <div>
            <label htmlFor="new-password" className="text-xs font-semibold text-ivory/65">New password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 py-3 text-sm text-ivory outline-none focus:border-gold/40"
            />
            <p className="mt-2 text-[11px] text-ivory/35">Minimum 8 characters.</p>
          </div>

          <div>
            <label htmlFor="confirm-password" className="text-xs font-semibold text-ivory/65">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 py-3 text-sm text-ivory outline-none focus:border-gold/40"
            />
          </div>

          <button
            id="change-password-submit"
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-gradient px-4 py-3 text-sm font-bold text-matte disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {isLoading ? "Updating password…" : "Update password"}
          </button>
        </form>

        {!requiresPasswordChange && (
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ivory/45 hover:text-ivory/80"
          >
            <ArrowLeft size={15} />
            Return to workspace
          </button>
        )}
      </div>
    </div>
  );
}
