import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldAlert } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <div id="apex-password-recovery" className="flex min-h-screen items-center justify-center bg-matte px-5 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-charcoal/70 p-7 shadow-glass sm:p-9">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 font-display text-sm font-bold text-gold">
            A1
          </div>
          <div>
            <p className="font-display text-lg font-bold text-ivory">APEX ONE</p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-ivory/35">
              Account recovery
            </p>
          </div>
        </div>

        <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
          <KeyRound size={21} />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-ivory">Password recovery</h1>
        <p className="mt-2 text-sm leading-6 text-ivory/55">
          Self-service password reset is not enabled yet because APEX ONE does not currently
          have an authoritative reset-token delivery service configured.
        </p>

        <div className="mt-6 flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-gold/70" />
          <p className="text-sm leading-6 text-ivory/50">
            Contact your organization administrator for account recovery. No password-reset
            request has been submitted from this page, and no account existence is disclosed.
          </p>
        </div>

        <Link
          href="/login"
          className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-gold/80 hover:text-gold"
        >
          <ArrowLeft size={15} />
          Back to secure sign-in
        </Link>
      </div>
    </div>
  );
}
