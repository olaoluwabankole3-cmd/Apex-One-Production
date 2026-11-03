"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowLeftRight, ClipboardList, ShieldCheck,
  FileStack, RefreshCw, LockKeyhole, CircleAlert,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { apiClient } from "@/lib/apiClient";
import type { BankingCaseRecord } from "@/lib/backend/database/schema";
import { describeCaseAttention } from "@/lib/cortexCaseAttention";
import { BankingTaskWorkspace } from "@/components/banking-cases/BankingTaskWorkspace";
import { BankingCaseTransferInbox } from "@/components/banking-cases/BankingCaseTransferInbox";

const journeys = [
  {
    href: "/reconciliation", title: "Review reconciliation",
    description: "Compare approved-format synthetic settlement and fee records in controlled staging.",
    permission: "financial:read", icon: ArrowLeftRight, number: "01",
  },
  {
    href: "/work/cases", title: "Investigate cases",
    description: "Create, assign and hand off operational issues with an accountable case history.",
    permission: "case:read", icon: ClipboardList, number: "02",
  },
  {
    href: "/documents", title: "Check supporting evidence",
    description: "Find authorized institutional documents and examine their available source status.",
    permission: "document:read", icon: FileStack, number: "03",
  },
  {
    href: "/reviews", title: "Independently review a plan",
    description: "As an eligible checker, approve or reject a colleague's internal investigation proposal.",
    permission: "case:approve", icon: ShieldCheck, number: "04",
  },
  {
    href: "/reports", title: "Inspect the accountability trail",
    description: "Read the authorized case register and any audit events your role permits.",
    permission: "case:read", icon: ClipboardList, number: "05",
  },
];

export default function FinancialOperationsOverview() {
  const { user, organization, hasPermission } = useAuth();
  const canReadCases = hasPermission("case:read");
  const [cases, setCases] = useState<BankingCaseRecord[]>([]);
  const [loading, setLoading] = useState(canReadCases);
  const [error, setError] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (!canReadCases) return;
    let active = true;
    apiClient.requestCollection<BankingCaseRecord>("/api/v1/banking-cases?limit=5")
      .then(result => {
        if (active) {
          setCases(result.data);
          setError(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setCases([]);
          setError(true);
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [canReadCases, refreshCount]);

  const pending = cases.filter(item => item.decision?.state === "pending");
  const allowedJourneys = journeys.filter(item => hasPermission(item.permission));

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12" id="cortex-financial-operations-overview">
      <header className="relative overflow-hidden rounded-2xl border border-[#C58D5F]/25 bg-[#24231F] px-6 py-8 sm:px-10 sm:py-11">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border border-[#C58D5F]/15 bg-[#C58D5F]/[0.035]" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.23em] text-[#D9A06F]">
            QORVEX / CORTEX / FINANCIAL OPERATIONS
          </p>
          <h1 className="mt-5 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight text-[#F5F1E8] sm:text-4xl">
            Make the next decision. <span className="text-[#D9A06F]">Keep the evidence.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#D3C9BD]">
            {user?.name ? `Welcome, ${user.name}. ` : ""}
            Your institution’s workspace for investigating exceptions, coordinating responsibility
            and reviewing decisions. Every financial conclusion must be grounded in authorized records.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-[#D3C9BD]/80">
            <span className="rounded-full border border-[#C58D5F]/25 px-3 py-1.5">
              {organization?.name ?? "Your institution"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LockKeyhole size={13} /> Role-based access
            </span>
            <span>Financial source integrations are not yet certified</span>
          </div>
        </div>
      </header>

      {canReadCases && <BankingCaseTransferInbox />}
      {canReadCases && <BankingTaskWorkspace />}

      {canReadCases && (
        <section className="rounded-xl border border-[#C58D5F]/25 bg-[#24231F] p-5 sm:p-7"
          aria-labelledby="cortex-current-work" id="cortex-my-work">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D9A06F]">
                01 / What needs attention
              </p>
              <h2 id="cortex-current-work" className="mt-2 font-display text-2xl font-semibold text-[#F5F1E8]">
                {hasPermission("org:admin") ? "Work requiring attention" : "My Work"}
              </h2>
              <p className="mt-2 max-w-2xl text-xs leading-6 text-[#D3C9BD]/70">
                The first five cases visible to this account, not an institution-wide total.
                Each item shows the next accountable step and what has not been confirmed.
                There are no invented due dates, completion totals or banking outcomes.
              </p>
            </div>
            <button type="button" disabled={loading} onClick={() => { setLoading(true); setRefreshCount(n => n + 1); }}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-ivory/70 hover:border-[#C58D5F]/40 disabled:opacity-40">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {loading ? (
            <p className="mt-6 text-sm text-ivory/50" role="status">Loading your permitted cases…</p>
          ) : error ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-amber-200" role="alert">
              <CircleAlert size={16} /> Cases are unavailable. No counts have been inferred.
            </p>
          ) : cases.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-white/10 p-6 text-sm text-ivory/50">
              No cases are visible to this account yet. Open Cases to record an issue if your role permits it.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {cases.map(item => {
                const attention = describeCaseAttention(item, {
                  userId: user?.id,
                  mayApprove: hasPermission("case:approve"),
                });
                return (
                  <Link href={attention.link} key={item.id}
                    className="group block rounded-lg border border-white/[0.09] bg-white/[0.025] px-4 py-4 transition-colors hover:border-[#C58D5F]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D9A06F]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#F5F1E8]">{item.title}</p>
                        <p className="mt-1 text-xs text-ivory/45">{item.department} · {item.priority} priority · {item.evidenceState} evidence</p>
                      </div>
                      <span className="rounded-full border border-[#C58D5F]/30 bg-[#C58D5F]/[0.07] px-3 py-1.5 text-[11px] font-medium text-[#D9A06F]">
                        {attention.heading}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[#D9A06F]/80">Next action</p>
                        <p className="mt-1 text-sm leading-6 text-[#F5F1E8]/90">{attention.nextAction}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[#D9A06F]/80">Accountable next actor</p>
                        <p className="mt-1 text-sm leading-6 text-[#F5F1E8]/90">{attention.actionOwner}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
                      <p className="max-w-[720px] text-xs leading-5 text-[#D3C9BD]/65">
                        Outcome not confirmed · {attention.customerSafeUpdate}
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#D9A06F]">
                        {attention.link === "/reviews" ? "Review plan" : "Inspect case"}
                        <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                );
              })}
              {pending.length > 0 && hasPermission("case:approve") && (
                <Link href="/reviews" className="inline-flex items-center gap-2 text-xs font-medium text-[#D9A06F]">
                  View visible cases awaiting review <ArrowRight size={14} />
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="cortex-start-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D9A06F]">YOUR WORKSPACE</p>
            <h2 id="cortex-start-heading" className="mt-1.5 font-display text-2xl font-semibold text-[#F5F1E8]">
              02 / Find a specialist workspace
            </h2>
          </div>
          <span className="hidden text-xs text-ivory/40 sm:block">Follow the investigation from comparison to audit · Authorized tasks only</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {allowedJourneys.map(({ href, title, description, icon: Icon, number }) => (
            <Link href={href} key={href}
              className="group rounded-xl border border-white/[0.09] bg-[#292823] p-5 transition-colors hover:border-[#C58D5F]/50 hover:bg-[#302D28] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D9A06F]">
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#C58D5F]/25 bg-[#C58D5F]/[0.08] text-[#D9A06F]">
                  <Icon size={20} strokeWidth={1.7} />
                </span>
                <span className="font-mono text-xs text-ivory/25">{number}</span>
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-[#F5F1E8]">{title}</h3>
              <p className="mt-1.5 min-h-12 text-sm leading-6 text-[#D3C9BD]/70">{description}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#D9A06F]">
                Open workspace <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
          {allowedJourneys.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-[#D3C9BD]">
              No financial operations journeys are assigned to this role. Contact your institution administrator.
            </div>
          )}
        </div>
      </section>

      <p className="border-t border-white/[0.07] pt-5 text-xs leading-5 text-ivory/40">
        CORTEX supports accountable investigation. A case, preview, linked document or reviewer decision
        is not by itself proof of financial loss, verified recovery, or authorization to move money.
      </p>
    </div>
  );
}
