"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, RefreshCw, CircleAlert } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/components/auth/AuthContext";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";
import BankingCaseReviewPanel from "@/components/banking-cases/BankingCaseReviewPanel";
import type { BankingCaseRecord } from "@/lib/backend/database/schema";

function ReviewQueue() {
  const { user, hasPermission } = useAuth();
  const [cases, setCases] = useState<BankingCaseRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const result = await apiClient.requestCollection<BankingCaseRecord>("/api/v1/banking-cases?limit=50");
      setCases(result.data);
      setHasMore(result.pagination.hasMore);
      setError(false);
    } catch {
      setError(true);
      setCases([]);
      setHasMore(false);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const pending = cases.filter(item => item.decision?.state === "pending");
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12" id="cortex-independent-reviews">
      <header className="rounded-2xl border border-[#C58D5F]/25 bg-[#24231F] p-6 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D9A06F]">FINANCIAL OPERATIONS / 03</p>
        <div className="mt-4 flex items-center gap-3">
          <span className="rounded-lg bg-[#C58D5F]/10 p-3 text-[#D9A06F]"><ShieldCheck size={24}/></span>
          <h1 className="font-display text-3xl font-semibold text-[#F5F1E8]">Independent Reviews</h1>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#D3C9BD]">
          Examine investigation plans proposed by colleagues. Approval records an internal
          control decision—not confirmation of a financial discrepancy, loss or transfer.
          The server independently checks role permissions and the maker–checker boundary.
        </p>
      </header>

      <section className="rounded-xl border border-white/10 bg-[#292823] p-5 sm:p-7" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D9A06F]">IN YOUR INSTITUTION</p>
            <h2 className="mt-2 font-display text-xl font-semibold text-[#F5F1E8]">Pending investigation reviews</h2>
            <p className="mt-1 text-xs text-[#D3C9BD]/60">
              Showing pending plans among the first 50 authorized case records. Not an institution-wide total.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-[#D3C9BD] hover:border-[#C58D5F]/40 disabled:opacity-40">
            <RefreshCw size={14}/> Refresh
          </button>
        </div>
        {busy ? <p role="status" className="mt-6 text-sm text-[#D3C9BD]/60">Loading permitted review records…</p>
        : error ? <p role="alert" className="mt-6 flex items-center gap-2 text-sm text-amber-200"><CircleAlert size={16}/> Review records are unavailable. Please retry.</p>
        : pending.length === 0 ?
          <div className="mt-6 rounded-lg border border-dashed border-white/15 p-7 text-sm text-[#D3C9BD]/60">
            No pending plans found in the visible case records. New proposals appear here when they are recorded.
            <Link href="/work/cases" className="mt-3 flex items-center gap-2 text-[#D9A06F]">Open cases <ArrowRight size={14}/></Link>
          </div>
        : <div className="mt-6 space-y-3">
            {pending.map(record => {
              const independent = !!user?.id && record.createdByUserId !== user.id &&
                record.decision?.proposedByUserId !== user.id;
              return <article key={record.id} className="rounded-lg border border-white/[0.1] bg-[#24231F] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#F5F1E8]">{record.title}</h3>
                    <p className="mt-1 text-xs text-[#D3C9BD]/60">
                      {record.department} · {record.priority} priority · case remains {record.status} / {record.evidenceState}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#C58D5F]/35 px-3 py-1 text-[11px] text-[#D9A06F]">
                    {independent ? "Pending checker decision" : "Not eligible to check"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-[#D3C9BD]/80">{record.decision?.rationale}</p>
                <p className="mt-2 text-xs text-[#D3C9BD]/60">
                  Proposed action: {record.decision?.disposition.replaceAll("_", " ")}
                </p>
                <button type="button" onClick={() => setSelected(old => old===record.id ? null : record.id)}
                  aria-expanded={selected === record.id}
                  className="mt-4 rounded-lg border border-[#C58D5F]/40 px-4 py-2 text-xs font-semibold text-[#D9A06F] hover:bg-[#C58D5F]/10">
                  {selected === record.id ? "Close details" : "Inspect evidence and review"}
                </button>
                {selected === record.id && (
                  <BankingCaseReviewPanel record={record} currentUserId={user?.id}
                    canCreate={hasPermission("case:create")}
                    canApprove={hasPermission("case:approve")}
                    onUpdated={refresh} />
                )}
              </article>;
            })}
          </div>
        }
        {!busy && !error && hasMore && <p className="mt-5 text-xs text-amber-200">
          Additional cases exist beyond this page. Open Cases for the paginated queue; this review list is not complete.
        </p>}
      </section>
    </div>
  );
}
export default function ReviewsPage() {
  return <InternalOnlyShield requiredPermission="case:approve"><ReviewQueue /></InternalOnlyShield>;
}
