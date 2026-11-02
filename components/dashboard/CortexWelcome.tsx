"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileSearch, ListChecks, MessageSquareText, SearchCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { useOrganization } from "@/components/layout/OrganizationContext";

/**
 * Give a first-time financial operator one clear task before exposing details.
 * All destinations are real, permission-checked routes. This is not a claim
 * that CORTEX currently ingests live bank feeds or has verified recoveries.
 */
export default function CortexWelcome() {
  const { hasPermission } = useAuth();
  const { organization, isFeatureEnabled } = useOrganization();

  const canReadDocuments = hasPermission("document:read");
  const canReviewIssues = hasPermission("value:read") && isFeatureEnabled("valueIntelligence");
  const canReviewActions = hasPermission("workflow:read") && isFeatureEnabled("workflowIntelligence");
  const canAsk = hasPermission("ai:execute") && isFeatureEnabled("aiWorkspace");
  const canReadKnowledge = hasPermission("knowledge:read");

  const tasks = [
    {
      number: "01",
      title: "Review the records",
      description: "See the documents your institution has made available.",
      href: "/documents",
      label: "Open documents",
      Icon: FileSearch,
      allowed: canReadDocuments,
    },
    {
      number: "02",
      title: "Look into possible issues",
      description: "Explore recorded opportunities and risks, with their evidence limits.",
      href: "/value-intelligence",
      label: "Review value & risk",
      Icon: SearchCheck,
      allowed: canReviewIssues,
    },
    {
      number: "03",
      title: "Follow up",
      description: "See who is responsible for the next permitted action.",
      href: "/workflows",
      label: "View actions",
      Icon: ListChecks,
      allowed: canReviewActions,
    },
  ];
  const firstTask = tasks.find((task) => task.allowed);

  return (
    <div id="cortex-executive-command-center" className="cortex-welcome mx-auto max-w-[1180px] overflow-hidden rounded-[24px] border border-[#CFC4B5] bg-[#F5F1E8] text-[#24231F] shadow-[0_24px_65px_rgba(0,0,0,0.12)]">
      <header className="relative overflow-hidden bg-[#24231F] px-6 pb-12 pt-7 text-[#F5F1E8] sm:px-10 lg:px-14 lg:pb-16 lg:pt-10">
        <div className="cortex-welcome-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/qorvex-emblem.svg" width={34} height={30} alt="" />
            <p className="text-xs font-bold tracking-[0.12em]">QORVEX <span className="font-normal text-[#B3A698]">/</span> CORTEX</p>
          </div>
          <span className="text-xs text-[#BFB3A7]">Financial intelligence · In development</span>
        </div>

        <div className="relative mt-12 max-w-3xl lg:mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D9A06F]">What CORTEX is for</p>
          <h1 className="mt-4 font-display text-[clamp(35px,5vw,62px)] font-bold leading-[1.1] tracking-[-0.045em]">
            Find what needs attention.<br />
            <span className="text-[#D9A06F]">Know what to do next.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[#E2DAD1]">
            CORTEX is being built to help financial institutions investigate possible
            settlement and fee discrepancies, check supporting records, and track how
            issues are resolved.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            {firstTask ? (
              <Link href={firstTask.href} className="inline-flex min-h-12 items-center gap-3 rounded-lg bg-[#C58D5F] px-6 py-3 text-sm font-bold text-[#171715] transition-colors hover:bg-[#D9A06F]">
                {firstTask.label} <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ) : (
              <p className="text-sm text-[#E2DAD1]">Ask your administrator to enable an authorized workspace.</p>
            )}
            {canAsk && (
              <Link href="/ai-workspace" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#F5F1E8] underline decoration-[#C58D5F] underline-offset-4 hover:text-[#D9A06F]">
                <MessageSquareText size={17} aria-hidden="true" /> Ask CORTEX
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="px-6 py-10 sm:px-10 lg:px-14 lg:py-12" aria-labelledby="cortex-start-heading">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#95502B]">A simple way to begin</p>
        <h2 id="cortex-start-heading" className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Three steps. One investigation.
        </h2>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {tasks.map(({ number, title, description, href, label, Icon, allowed }) => {
            const body = (
              <>
                <div className="flex items-center justify-between text-[#95502B]">
                  <span className="text-sm font-bold">{number}</span>
                  <Icon size={21} aria-hidden="true" />
                </div>
                <h3 className="mt-6 text-lg font-bold leading-snug">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-[#635A51]">{description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#95502B]">
                  {allowed ? label : "Not available to this account"}
                  {allowed && <ArrowRight size={15} aria-hidden="true" />}
                </span>
              </>
            );
            return allowed ? (
              <Link key={number} href={href} className="flex min-h-[220px] flex-col rounded-xl border border-[#D4C6B7] bg-[#FFFCF8] p-5 transition-colors hover:border-[#A65A2E] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A65A2E]">
                {body}
              </Link>
            ) : (
              <div key={number} className="flex min-h-[220px] flex-col rounded-xl border border-[#D9D0C5] bg-[#ECE8E1] p-5 opacity-75">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-[#D5C8B8] bg-[#EAE4DA] px-6 py-6 sm:px-10 lg:px-14">
        <p className="text-sm font-semibold text-[#332D27]">What can CORTEX do today?</p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#635A51]">
          You can explore permitted records, ask evidence-limited questions, and review existing follow-up work.
          Live bank feeds, automatic discrepancy detection on real transaction streams, and verified recoveries
          are not yet available. Nothing here is a confirmed financial loss.
        </p>
        {(canReadKnowledge || canReviewIssues) && (
          <details className="mt-5 text-sm text-[#635A51]">
            <summary className="cursor-pointer font-semibold text-[#95502B]">Other available workspaces</summary>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {canReadKnowledge && <Link className="underline underline-offset-4 hover:text-[#95502B]" href="/knowledge-hub">Institutional knowledge</Link>}
              {canReviewIssues && <Link className="underline underline-offset-4 hover:text-[#95502B]" href="/value-intelligence/captured">Recorded outcomes (not independently verified)</Link>}
            </div>
          </details>
        )}
        <p className="mt-5 text-xs text-[#776B5F]">Workspace: {organization.displayName}</p>
      </footer>
    </div>
  );
}
