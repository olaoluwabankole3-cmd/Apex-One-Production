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
 * QORVEX editorial workspace art direction.
 * Real, permission-filtered journeys only; no synthetic metrics, bank feeds
 * or financial recoveries are suggested by the interface.
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
      title: "Move toward a decision",
      description: "Review permitted workflows and accountable follow-up; sensitive actions still require authorization.",
      href: "/workflows",
      action: "Review actions",
      Icon: GitBranch,
      allowed: hasPermission("workflow:read") && isFeatureEnabled("workflowIntelligence"),
    },
  ];

  const firstAvailable = journeys.find((item) => item.allowed);
  const canReviewValue = hasPermission("value:read") && isFeatureEnabled("valueIntelligence");

  return (
    <div
      id="cortex-executive-command-center"
      className="cortex-welcome mx-auto w-full max-w-[1480px] overflow-hidden border border-[#5E5146] bg-[#F5F1E8] text-[#24231F] shadow-[0_26px_70px_rgba(0,0,0,0.16)]"
    >
      <section className="relative isolate flex min-h-[590px] flex-col overflow-hidden bg-[#171715] px-6 pb-12 pt-7 text-[#F5F1E8] sm:px-10 lg:min-h-[660px] lg:px-14 lg:pb-14 lg:pt-9">
        <div className="cortex-welcome-grid pointer-events-none absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
        <div className="absolute -right-20 -top-44 -z-10 h-[480px] w-[480px] rounded-full bg-[#A65A2E]/[0.08] blur-[90px]" aria-hidden="true" />

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#75695F]/60 pb-5">
          <div className="flex items-center gap-3">
            <Image src="/qorvex-emblem.svg" alt="" width={35} height={31} className="h-[31px] w-[35px]" />
            <div>
              <p className="text-[12px] font-bold tracking-[0.16em]">QORVEX <span className="mx-1 text-[#A79B8E]">/</span> CORTEX</p>
              <p className="mt-1 text-[10px] text-[#B6AA9D]">Financial intelligence workspace</p>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#CDB6A2]">
            Secure staging environment
          </span>
        </div>

        <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[minmax(0,1.45fr)_minmax(270px,0.55fr)] lg:gap-12 lg:py-16">
          <div className="max-w-[850px]">
            <div className="flex items-center gap-4">
              <span className="h-px w-9 bg-[#C58D5F]" aria-hidden="true" />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#D9A06F]">Your starting point</span>
            </div>

            <h1 className="mt-8 font-display text-[clamp(40px,5vw,79px)] font-extrabold leading-[1.055] tracking-[-0.07em]">
              From information
              <span className="block text-[#C58D5F]">to informed action.</span>
            </h1>
            <p className="mt-8 max-w-[650px] text-[15px] leading-[1.9] text-[#CEC5BA] sm:text-[16px]">
              CORTEX brings authorized documents, knowledge, analysis and follow-up
              into one place. Begin with evidence, understand what it tells you,
              then decide what your team should do next.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-6">
              {firstAvailable ? (
                <Link
                  href={firstAvailable.href}
                  className="group inline-flex min-h-[51px] items-center justify-between gap-10 border border-[#C58D5F] bg-[#C58D5F] px-5 py-3 text-[13px] font-bold text-[#171715] transition-colors hover:bg-[#D9A06F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F5F1E8]"
                >
                  {firstAvailable.action}
                  <ArrowUpRight size={19} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                </Link>
              ) : (
                <span className="border border-[#8E725A] px-4 py-3 text-[13px] text-[#D8C8B8]">
                  Ask your workspace administrator for access to a starting workflow.
                </span>
              )}
              <a
                href="#how-cortex-works"
                className="inline-flex min-h-11 items-center gap-3 border-b border-[#AD7248] text-[12px] font-semibold text-[#F5F1E8] transition-colors hover:text-[#D9A06F]"
              >
                Understand the workspace <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          <aside className="relative hidden self-stretch border-l border-[#6C5E53]/70 pl-8 lg:flex lg:flex-col lg:justify-between" aria-label="How CORTEX approaches an investigation">
            <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.16em] text-[#D9A06F]">
              <span>Q / 01</span><span>WORKSPACE</span>
            </div>
            <div className="relative mx-auto my-6 flex h-[230px] w-[230px] items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-[#C58D5F]/30" aria-hidden="true" />
              <div className="absolute inset-5 rounded-full border border-dashed border-[#C58D5F]/20" aria-hidden="true" />
              <div className="absolute inset-12 rotate-45 border border-[#A65A2E]/45" aria-hidden="true" />
              <Image src="/qorvex-emblem.svg" width={91} height={80} alt="" className="relative h-[80px] w-[91px] opacity-90" />
            </div>
            <div className="space-y-4 border-t border-[#6C5E53]/70 pt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#D9A06F]">Evidence → understanding → action</p>
              <p className="text-[13px] leading-6 text-[#BFB3A7]">
                Access is limited to the records and workflows authorized for {organization.displayName}.
              </p>
            </div>
          </aside>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#75695F]/60 pt-5 font-mono text-[10px] uppercase tracking-[0.09em] text-[#A89B8E]">
          <span>Institutional intelligence / in development</span>
          <span>Scroll to explore ↓</span>
        </div>
      </section>

      <section
        className="px-6 py-12 sm:px-10 lg:px-14 lg:py-16"
        id="how-cortex-works"
        aria-labelledby="cortex-how-heading"
      >
        <div className="grid gap-5 border-b border-[#C7B8A7] pb-8 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-end">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#95502B]">01 / Find your way</p>
            <h2 id="cortex-how-heading" className="mt-4 max-w-2xl font-display text-[clamp(30px,3vw,48px)] font-extrabold leading-[1.12] tracking-[-0.055em]">
              A clear path through CORTEX.
            </h2>
          </div>
          <p className="max-w-sm text-[13px] leading-[1.8] text-[#62584E]">
            These are real areas of the application—not a demonstration of connected bank data.
            Select a step to open a workspace your account can access.
          </p>
        </div>

        <div className="grid border-b border-[#C7B8A7] sm:grid-cols-2">
          {journeys.map(({ number, title, description, href, action, Icon, allowed }, index) => {
            const content = (
              <>
                <div className="flex items-start justify-between gap-4">
                  <span className="font-mono text-[11px] font-semibold tracking-[0.08em] text-[#95502B]">{number} / 04</span>
                  <Icon size={21} strokeWidth={1.5} className="text-[#A65A2E]" aria-hidden="true" />
                </div>
                <h3 className="mt-11 max-w-[300px] text-[20px] font-bold leading-[1.3] tracking-[-0.035em]">{title}</h3>
                <p className="mt-3 max-w-[335px] text-[13px] leading-[1.85] text-[#62584E]">{description}</p>
                <span className="mt-auto inline-flex items-center gap-3 pt-8 text-[12px] font-bold text-[#95502B]">
                  {allowed ? action : "Not enabled for this account"}
                  {allowed && <ArrowUpRight size={16} aria-hidden="true" />}
                </span>
              </>
            );

            const baseClass = `flex min-h-[285px] flex-col border-t border-[#C7B8A7] px-5 py-7 sm:px-8 sm:py-9 ${index % 2 === 1 ? "sm:border-l" : ""}`;
            return allowed ? (
              <Link
                key={number}
                href={href}
                className={`group ${baseClass} bg-transparent transition-colors hover:bg-[#E9DFD2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#A65A2E]`}
              >
                {content}
              </Link>
            ) : (
              <div key={number} className={`${baseClass} bg-[#E9E4DC]/70 opacity-75`}>
                {content}
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-10 border-t border-[#BCAE9E] bg-[#E5E1D8] px-6 py-12 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-20 lg:px-14 lg:py-16" aria-labelledby="cortex-now-heading">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#95502B]">02 / What is usable now</p>
          <h2 id="cortex-now-heading" className="mt-4 font-display text-[32px] font-bold leading-tight tracking-[-0.05em]">
            A foundation you can explore.
          </h2>
          <p className="mt-5 max-w-xl text-[13px] leading-7 text-[#5E564E]">
            Document and knowledge workflows, permission-controlled AI analysis,
            action tracking and recorded value workflows exist today. Each journey
            shows only information your account is permitted to access.
          </p>
          {canReviewValue && (
            <Link href="/value-intelligence" className="mt-6 inline-flex items-center gap-3 border-b border-[#A65A2E] pb-2 text-[12px] font-bold text-[#95502B] hover:text-[#6F371E]">
              Explore Value &amp; Risk <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        <div className="border-l-2 border-[#A65A2E] pl-6 sm:pl-8">
          <div className="flex items-center gap-3 text-[#95502B]">
            <Target size={18} aria-hidden="true" />
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">Still being developed</h3>
          </div>
          <p className="mt-5 text-[17px] font-bold tracking-[-0.02em]">Verified financial-source connectivity</p>
          <p className="mt-3 text-[13px] leading-7 text-[#5E564E]">
            Live institution-approved bank feeds, authenticated settlement evidence,
            complete reconciliation investigations and independently verified financial
            recoveries are not available in this release. Internal matching and
            integrity engines are engineering foundations, not production findings.
          </p>
          <div className="mt-5 flex items-start gap-3 border-t border-[#BCAE9E] pt-5 text-[12px] leading-6 text-[#675C51]">
            <ShieldCheck className="mt-0.5 shrink-0 text-[#95502B]" size={18} aria-hidden="true" />
            <span>Stored records and AI summaries are not independently verified evidence.</span>
          </div>
        </div>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#C7B8A7] bg-[#F5F1E8] px-6 py-5 text-[10px] text-[#665D54] sm:px-10 lg:px-14">
        <span>QORVEX / CORTEX · Financial institution intelligence in development</span>
        <span>Authorized records only · No fabricated financial outcomes</span>
      </footer>
    </div>
  );
}
