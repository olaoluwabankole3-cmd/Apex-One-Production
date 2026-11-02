"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Database,
  FileSearch,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
  Workflow,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

/**
 * Institution setup is a guide to real capabilities—not a fake setup wizard.
 * Session organization and user identity are authoritative. No onboarding
 * completion is inferred for invite flows or unconnected financial sources.
 */
export default function SettingsWorkspace() {
  const { user, organization, availableOrganizations, hasPermission } = useAuth();
  const canReadDocuments = hasPermission("document:read");
  const canReviewWorkflows = hasPermission("workflow:read");
  const canReviewValue = hasPermission("value:read");

  const details = [
    { label: "Institution", value: organization?.name || "Unavailable" },
    { label: "Signed-in administrator", value: user?.name || user?.email || "Unavailable" },
    { label: "Assigned role", value: user?.role || "Unavailable" },
    { label: "Accessible organizations", value: String(availableOrganizations.length) },
  ];

  return (
    <div id="organizational-control-center" className="mx-auto w-full max-w-[1230px] space-y-8 pb-8">
      <header className="relative overflow-hidden border border-[#665749] bg-[#24231F] px-6 py-9 text-[#F5F1E8] sm:px-9 lg:px-11 lg:py-11">
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-[#A65A2E]/10 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D9A06F]">
            QORVEX / CORTEX / ADMINISTRATION
          </p>
          <h1 className="mt-5 font-display text-[clamp(32px,3.7vw,50px)] font-extrabold leading-[1.1] tracking-[-0.05em]">
            Institution setup
          </h1>
          <p className="mt-5 max-w-2xl text-[14px] leading-7 text-[#D6CCC2]">
            Start here to understand your institution&apos;s workspace, who can access it,
            and what is required before CORTEX can investigate real financial records.
          </p>
        </div>
      </header>

      <section aria-labelledby="institution-identity-heading" className="border border-[#C8B9A7] bg-[#F5F1E8] px-6 py-7 text-[#24231F] sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Building2 size={21} className="text-[#A65A2E]" aria-hidden="true" />
            <h2 id="institution-identity-heading" className="font-display text-xl font-bold tracking-tight">Your current institution</h2>
          </div>
          <span className="inline-flex items-center gap-2 border border-[#B2A18D] bg-[#EAE4DB] px-3 py-1.5 text-[11px] font-semibold text-[#5A4A3D]">
            <CheckCircle2 size={14} aria-hidden="true" /> Authenticated workspace
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[#63594E]">
          These details come from your signed-in session. They confirm access to a provisioned workspace,
          not that bank data has been connected or the institution has completed implementation.
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label} className="border-t border-[#D4C8B9] pt-3">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#78695A]">{detail.label}</dt>
              <dd className="mt-1.5 break-words text-[15px] font-semibold">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="institution-onboarding-heading" className="border border-[#C8B9A7] bg-[#FCFAF6] px-6 py-8 text-[#24231F] sm:px-8">
        <div className="border-b border-[#D4C8B9] pb-6">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-[#95502B]">Institution onboarding journey</p>
          <h2 id="institution-onboarding-heading" className="mt-3 font-display text-2xl font-bold tracking-[-0.04em]">
            From company setup to your first investigation
          </h2>
          <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[#63594E]">
            A live bank deployment requires approved users, trustworthy source connections,
            and an evidence-backed review process. The steps below distinguish working
            navigation from capabilities that still need implementation.
          </p>
        </div>

        <ol className="divide-y divide-[#D4C8B9]">
          <li className="grid gap-4 py-6 md:grid-cols-[46px_minmax(0,1fr)_180px] md:items-start">
            <span className="font-mono text-lg font-bold text-[#A65A2E]">01</span>
            <div>
              <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#95502B]" aria-hidden="true" /><h3 className="font-bold">Establish the institution workspace</h3></div>
              <p className="mt-2 text-[13px] leading-6 text-[#63594E]">
                Your organization and administrator are already resolved by the authenticated service.
                New institutions currently require controlled backend provisioning; creating a company
                from this screen is not available.
              </p>
            </div>
            <span className="inline-flex items-center justify-center border border-[#A4B6A7] bg-[#EDF1EA] px-3 py-2 text-center text-xs font-semibold text-[#365640]">Access confirmed</span>
          </li>
          <li className="grid gap-4 py-6 md:grid-cols-[46px_minmax(0,1fr)_180px] md:items-start">
            <span className="font-mono text-lg font-bold text-[#A65A2E]">02</span>
            <div>
              <div className="flex items-center gap-2"><UsersRound size={18} className="text-[#95502B]" aria-hidden="true" /><h3 className="font-bold">Onboard your team</h3></div>
              <p className="mt-2 text-[13px] leading-6 text-[#63594E]">
                Define who investigates, who reviews, and who approves outcomes. Roles and
                permissions are enforced by the backend. A self-service team invitation
                and approval flow is not yet available here.
              </p>
            </div>
            <span className="inline-flex items-center justify-center border border-[#D6C7B4] bg-[#F5EFE6] px-3 py-2 text-center text-xs font-semibold text-[#775C43]">Provisioning needed</span>
          </li>
          <li className="grid gap-4 py-6 md:grid-cols-[46px_minmax(0,1fr)_180px] md:items-start">
            <span className="font-mono text-lg font-bold text-[#A65A2E]">03</span>
            <div>
              <div className="flex items-center gap-2"><Database size={18} className="text-[#95502B]" aria-hidden="true" /><h3 className="font-bold">Connect approved financial sources</h3></div>
              <p className="mt-2 text-[13px] leading-6 text-[#63594E]">
                Real settlement, switch, acquirer, core-ledger and fee data must be
                authorized, securely ingested, mapped and validated. This page has
                no verified connector inventory or live-feed setup capability.
              </p>
            </div>
            <span className="inline-flex items-center justify-center border border-[#D6C7B4] bg-[#F5EFE6] px-3 py-2 text-center text-xs font-semibold text-[#775C43]">Integration needed</span>
          </li>
          <li className="grid gap-4 py-6 md:grid-cols-[46px_minmax(0,1fr)_180px] md:items-start">
            <span className="font-mono text-lg font-bold text-[#A65A2E]">04</span>
            <div>
              <div className="flex items-center gap-2"><FileSearch size={18} className="text-[#95502B]" aria-hidden="true" /><h3 className="font-bold">Explore available source records</h3></div>
              <p className="mt-2 text-[13px] leading-6 text-[#63594E]">
                You can inspect documents already visible to your authorized session.
                Stored summaries and extracted fields still require original-source review.
              </p>
            </div>
            {canReadDocuments ? (
              <Link href="/documents" className="inline-flex min-h-10 items-center justify-center gap-2 border border-[#A65A2E] bg-[#A65A2E] px-3 py-2 text-center text-xs font-bold text-white hover:bg-[#884321]">View documents <ArrowUpRight size={14} aria-hidden="true" /></Link>
            ) : <span className="text-center text-xs text-[#78695A]">Access not granted</span>}
          </li>
          <li className="grid gap-4 py-6 md:grid-cols-[46px_minmax(0,1fr)_180px] md:items-start">
            <span className="font-mono text-lg font-bold text-[#A65A2E]">05</span>
            <div>
              <div className="flex items-center gap-2"><Workflow size={18} className="text-[#95502B]" aria-hidden="true" /><h3 className="font-bold">Review possible issues and assign follow-up</h3></div>
              <p className="mt-2 text-[13px] leading-6 text-[#63594E]">
                Existing value and workflow records can be reviewed under your permissions.
                End-to-end reconciliation against verified live bank data and confirmed
                recoveries are not available in this release.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {canReviewValue && <Link href="/value-intelligence" className="inline-flex items-center justify-center gap-2 border border-[#BFA88D] px-3 py-2.5 text-center text-xs font-bold text-[#95502B] hover:bg-[#EFE6DC]">Value &amp; Risk <ArrowUpRight size={14} aria-hidden="true" /></Link>}
              {canReviewWorkflows && <Link href="/workflows" className="inline-flex items-center justify-center gap-2 border border-[#BFA88D] px-3 py-2.5 text-center text-xs font-bold text-[#95502B] hover:bg-[#EFE6DC]">Action Center <ArrowUpRight size={14} aria-hidden="true" /></Link>}
              {!canReviewValue && !canReviewWorkflows && <span className="text-center text-xs text-[#78695A]">Access not granted</span>}
            </div>
          </li>
        </ol>
      </section>

      <section className="grid gap-6 border border-[#6E5A49] bg-[#24231F] px-6 py-7 text-[#F5F1E8] sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]" aria-labelledby="institution-next-heading">
        <div>
          <h2 id="institution-next-heading" className="font-display text-xl font-bold">What your institution needs next</h2>
          <p className="mt-3 max-w-xl text-[13px] leading-7 text-[#D2C7BB]">
            CORTEX needs an approved institution-provisioning process, controlled
            user invitations, source connection and validation, and a real
            investigation-to-resolution workflow before it can become a deployable
            financial-institution solution.
          </p>
        </div>
        <div className="border-t border-[#716154] pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <p className="flex items-center gap-2 text-sm font-bold text-[#D9A06F]">
            <LockKeyhole size={17} aria-hidden="true" /> Configuration boundary
          </p>
          <p className="mt-3 text-[12px] leading-6 text-[#C7BAAB]">
            Database, cloud, AI-provider and encryption credentials are managed
            securely outside this interface. No system is labeled connected
            without confirmation from an authoritative integration service.
          </p>
          <p className="mt-3 flex items-start gap-2 text-[12px] leading-6 text-[#C7BAAB]"><KeyRound className="mt-1 shrink-0" size={15} aria-hidden="true" /> Do not enter banking credentials into document fields or AI chat.</p>
        </div>
      </section>
    </div>
  );
}
