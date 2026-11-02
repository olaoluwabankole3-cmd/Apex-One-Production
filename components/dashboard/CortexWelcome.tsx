"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  FileSearch,
  GitBranch,
  MessageSquareText,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { useOrganization } from "@/components/layout/OrganizationContext";

/**
 * Product entry, not a financial dashboard.
 *
 * The cards point only at existing, permission-checked application journeys.
 * No bank connectivity, verified financial loss, or achieved value is implied.
 */
export default function CortexWelcome() {
  const { hasPermission } = useAuth();
  const { organization, isFeatureEnabled } = useOrganization();

  const journeys = [
    {
      number: "01",
      title: "Start with evidence",
      description: "Open authorized documents, examine source material and understand what is actually available.",
      href: "/documents",
      action: "Explore documents",
      Icon: FileSearch,
      allowed: hasPermission("document:read"),
    },
    {
      number: "02",
      title: "Build institutional context",
      description: "Find published knowledge and the supporting records that help your team understand an issue.",
      href: "/knowledge-hub",
      action: "Explore knowledge",
      Icon: BookOpenText,
      allowed: hasPermission("knowledge:read"),
    },
    {
      number: "03",
      title: "Ask better questions",
      description: "Use CORTEX Intelligence to explore authorized information. Answers remain limited by available evidence.",
      href: "/ai-workspace",
      action: "Open intelligence",
      Icon: MessageSquareText,
      allowed: hasPermission("ai:execute") && isFeatureEnabled("aiWorkspace"),
    },
    {
      number: "04",
      title: hasPermission("case:read") ? "Manage my banking cases" : "Move toward a decision",
      description: hasPermission("case:read")
        ? "Review your assigned cases, create operational issues when authorized and hand off work with an audit trail."
        : "Review permitted workflows and accountable follow-up; sensitive actions still require authorization.",
      href: hasPermission("case:read") ? "/work/cases" : "/workflows",
      action: hasPermission("case:read") ? "Open My Cases" : "Review actions",
      Icon: GitBranch,
      allowed: hasPermission("case:read") ||
        (hasPermission("workflow:read") && isFeatureEnabled("workflowIntelligence")),
    },
  ];
  const firstAvailable = journeys.find((item) => item.allowed);
  const canReviewValue = hasPermission("value:read") && isFeatureEnabled("valueIntelligence");

  return (
    <div
      className="cortex-welcome mx-auto w-full max-w-[1480px] overflow-hidden rounded-[22px] border border-[#6a5b4b]/25 bg-[#F5F1E8] text-[#24231F] shadow-[0_24px_80px_rgba(0,0,0,0.15)]"
      id="cortex-executive-command-center"
    >
      <section className="cortex-welcome-hero relative isolate overflow-hidden bg-[#171715] px-6 pb-10 pt-7 text-[#F5F1E8] sm:px-10 lg:px-12 lg:pb-14 lg:pt-10">
        <div className="cortex-welcome-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 top-0 -z-10 h-[420px] w-[420px] rounded-full bg-[#A65A2E]/20 blur-[100px]" aria-hidden="true" />
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F5F1E8]/15 pb-5">
          <div className="flex items-center gap-3">
            <Image src="/qorvex-emblem.svg" alt="" width={34} height={30} className="h-[30px] w-[34px]" />
            <div className="leading-tight">
              <p className="text-[12px] font-bold tracking-[0.16em]">QORVEX <span className="font-normal text-[#B8AEA3]">/</span> CORTEX</p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[#B8AEA3]">Financial intelligence workspace</p>
            </div>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.11em] text-[#D9A06F]">Secure staging environment</p>
        </div>

        <div className="grid gap-8 pt-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(245px,0.6fr)] lg:items-end lg:gap-14 lg:pt-16">
          <div>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[#D9A06F]">Your starting point</p>
            <h1 className="max-w-[820px] font-display text-[clamp(36px,4.5vw,68px)] font-bold leading-[1.1] tracking-[-0.055em]">
              From information<br />
              <span className="text-[#C58D5F]">to informed action.</span>
            </h1>
            <p className="mt-6 max-w-[660px] text-[14px] leading-7 text-[#D3C9BD] sm:text-[15px]">
              CORTEX brings authorized documents, knowledge, analysis and follow-up
              into one place. Begin with evidence, understand what it tells you,
              then decide what your team should do next.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              {firstAvailable ? (
                <Link
                  href={firstAvailable.href}
                  className="inline-flex min-h-12 items-center justify-center gap-5 rounded-sm bg-[#C58D5F] px-5 py-3 text-[13px] font-bold text-[#171715] transition-colors hover:bg-[#D9A06F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F1E8]"
                >
                  {firstAvailable.action}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              ) : (
                <span className="rounded border border-[#C58D5F]/40 px-4 py-3 text-sm text-[#D3C9BD]">
                  Ask your workspace administrator for access to a starting workflow.
                </span>
              )}
              {hasPermission("org:admin") && (
                <Link href="/settings" className="inline-flex min-h-11 items-center gap-2 text-[12px] font-semibold text-[#D9A06F] underline decoration-[#C58D5F] underline-offset-[7px] hover:text-[#F5F1E8]">
                  Institution setup guide <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              )}
              <a href="#how-cortex-works" className="inline-flex min-h-11 items-center gap-2 text-[12px] font-semibold text-[#F5F1E8] underline decoration-[#C58D5F] underline-offset-[7px] hover:text-[#D9A06F]">
                Understand the workspace <ArrowRight size={15} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="rounded-sm border border-[#BFAE9B]/30 bg-[#24231F]/80 p-5 sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#D9A06F]">Before you begin</p>
            <h2 className="mt-3 text-[18px] font-bold tracking-[-0.025em]">Evidence determines the answer.</h2>
            <p className="mt-3 text-[12px] leading-[1.8] text-[#C4B9AB]">
              Your access depends on your assigned permissions and the records available to {organization.displayName}.
              An empty page means information has not been provided or is unavailable to your account.
            </p>
            <div className="mt-5 flex items-start gap-2 border-t border-[#F5F1E8]/15 pt-4 text-[11px] leading-[1.75] text-[#D3C9BD]">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#D9A06F]" aria-hidden="true" />
              <span>No verified live bank feeds or independently confirmed recoveries are represented by this staging workspace.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 sm:px-10 lg:px-12 lg:py-12" id="how-cortex-works" aria-labelledby="cortex-how-heading">
        <div className="flex flex-col justify-between gap-4 border-b border-[#BFB3A5] pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#95502B]">01 / Find your way</p>
            <h2 id="cortex-how-heading" className="mt-3 max-w-xl font-display text-[29px] font-bold leading-[1.17] tracking-[-0.045em] sm:text-[36px]">
              A clear path through CORTEX.
            </h2>
          </div>
          <p className="max-w-sm text-[12px] leading-[1.8] text-[#5E564E]">
            These are real areas of the application—not a demonstration of connected bank data.
            Select a step to open a workspace your account can access.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {journeys.map(({ number, title, description, href, action, Icon, allowed }) => {
            const contents = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-[11px] font-semibold text-[#95502B]">{number}</span>
                  <Icon size={22} className="text-[#95502B]" strokeWidth={1.6} aria-hidden="true" />
                </div>
                <h3 className="mt-7 text-[17px] font-bold leading-snug tracking-[-0.03em]">{title}</h3>
                <p className="mt-3 min-h-[90px] text-[12px] leading-[1.75] text-[#5E564E]">{description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-[11px] font-bold text-[#95502B]">
                  {allowed ? action : "Not enabled for this account"}
                  {allowed && <ArrowUpRight size={15} aria-hidden="true" />}
                </span>
              </>
            );
            return allowed ? (
              <Link
                key={number}
                href={href}
                className="group flex min-h-[282px] flex-col rounded-sm border border-[#C9BDAE] bg-[#FCFAF6] p-5 transition-all hover:-translate-y-1 hover:border-[#A65A2E] hover:shadow-[0_16px_30px_rgba(80,58,35,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A65A2E]"
              >
                {contents}
              </Link>
            ) : (
              <div key={number} className="flex min-h-[282px] flex-col rounded-sm border border-[#D4C9BC] bg-[#EDE9E1] p-5 opacity-80">
                {contents}
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-8 border-t border-[#C9BDAE] bg-[#E5E1D8] px-6 py-10 sm:px-10 lg:grid-cols-2 lg:gap-14 lg:px-12 lg:py-12" aria-labelledby="cortex-now-heading">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#95502B]">02 / What is usable now</p>
          <h2 id="cortex-now-heading" className="mt-3 text-[24px] font-bold tracking-[-0.035em] sm:text-[30px]">
            A foundation you can explore.
          </h2>
          <p className="mt-4 text-[13px] leading-7 text-[#5E564E]">
            Document and knowledge workflows, permission-controlled AI analysis,
            action tracking and recorded value workflows exist today. Each journey
            shows only information your account is permitted to access.
          </p>
          {canReviewValue && (
            <Link href="/value-intelligence" className="mt-5 inline-flex items-center gap-2 text-[12px] font-bold text-[#95502B] underline underline-offset-4 hover:text-[#6F371E]">
              Explore Value &amp; Risk <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          )}
        </div>
        <div className="border-l-2 border-[#A65A2E] bg-[#F5F1E8] px-6 py-6">
          <div className="flex items-center gap-2 text-[#95502B]">
            <Target size={18} aria-hidden="true" />
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.13em]">Still being developed</h3>
          </div>
          <p className="mt-3 text-[14px] font-bold">Verified financial-source connectivity</p>
          <p className="mt-2 text-[12px] leading-7 text-[#5E564E]">
            Live institution-approved bank feeds, authenticated settlement evidence,
            complete reconciliation investigations and independently verified financial
            recoveries are not available in this release. Internal matching and
            integrity engines are engineering foundations, not production findings.
          </p>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#C9BDAE] bg-[#F5F1E8] px-6 py-4 text-[10px] text-[#685F56] sm:px-10 lg:px-12">
        <span>QORVEX / CORTEX · Financial institution intelligence in development</span>
        <span>Authorized records only · No fabricated financial outcomes</span>
      </footer>
    </div>
  );
}
