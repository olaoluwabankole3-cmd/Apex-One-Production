"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileBarChart2, RefreshCw, Printer, CircleAlert } from "lucide-react";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";
import { useAuth } from "@/components/auth/AuthContext";
import { apiClient } from "@/lib/apiClient";
import type { BankingCaseRecord, AuditLogRecord } from "@/lib/backend/database/schema";

function ReportsWorkspace() {
  const { hasPermission } = useAuth();
  const canSeeAudit = hasPermission("audit:read");
  const [cases, setCases] = useState<BankingCaseRecord[]>([]);
  const [audit, setAudit] = useState<AuditLogRecord[]>([]);
  const [caseError, setCaseError] = useState(false);
  const [auditError, setAuditError] = useState(false);
  const [caseMore, setCaseMore] = useState(false);
  const [auditMore, setAuditMore] = useState(false);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const caseRequest = apiClient.requestCollection<BankingCaseRecord>("/api/v1/banking-cases?limit=50");
    const auditRequest = canSeeAudit
      ? apiClient.requestCollection<AuditLogRecord>("/api/v1/audit?limit=25")
      : Promise.resolve(null);
    const [caseResult, auditResult] = await Promise.allSettled([caseRequest, auditRequest]);
    if (caseResult.status === "fulfilled") {
      setCases(caseResult.value.data);
      setCaseMore(caseResult.value.pagination.hasMore);
      setCaseError(false);
    } else {
      setCases([]);
      setCaseMore(false);
      setCaseError(true);
    }
    if (canSeeAudit) {
      if (auditResult.status === "fulfilled" && auditResult.value) {
        setAudit(auditResult.value.data);
        setAuditMore(auditResult.value.pagination.hasMore);
        setAuditError(false);
      } else {
        setAudit([]);
        setAuditMore(false);
        setAuditError(true);
      }
    }
    setBusy(false);
  }, [canSeeAudit]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12" id="cortex-reports-workspace">
      <header className="rounded-2xl border border-[#C58D5F]/25 bg-[#24231F] p-6 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D9A06F]">FINANCIAL OPERATIONS / 06</p>
        <div className="mt-4 flex items-center gap-3">
          <span className="rounded-lg bg-[#C58D5F]/10 p-3 text-[#D9A06F]"><FileBarChart2 size={24}/></span>
          <h1 className="font-display text-3xl font-semibold text-[#F5F1E8]">Case & Audit Reports</h1>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#D3C9BD]">
          Review actual case disposition and available institutional activity records.
          These are operational reports, not independently certified monetary losses,
          settlement confirmations or recovered amounts.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 print:hidden">
          <button onClick={() => void load()} disabled={busy} type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-xs text-[#D3C9BD] hover:border-[#C58D5F]/40 disabled:opacity-40">
            <RefreshCw size={14}/> Refresh
          </button>
          <button type="button" onClick={() => window.print()} disabled={busy || caseError}
            className="inline-flex items-center gap-2 rounded-lg border border-[#C58D5F]/50 px-4 py-2 text-xs font-semibold text-[#D9A06F] disabled:opacity-40">
            <Printer size={14}/> Print current view
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-white/10 bg-[#292823] p-5 sm:p-7">
        <div>
          <h2 className="font-display text-xl font-semibold text-[#F5F1E8]">Visible case register</h2>
          <p className="mt-1 text-xs text-[#D3C9BD]/65">
            First 50 cases authorized for your role. No organization-wide totals are inferred.
          </p>
        </div>
        {busy ? <p role="status" className="mt-6 text-sm text-[#D3C9BD]/65">Loading case records…</p>
        : caseError ? <p role="alert" className="mt-6 flex items-center gap-2 text-sm text-amber-200"><CircleAlert size={16}/> Case records unavailable; this report is incomplete.</p>
        : cases.length === 0 ? <p className="mt-6 rounded-lg border border-dashed border-white/15 p-6 text-sm text-[#D3C9BD]/65">No case records are currently visible.</p>
        : <div className="mt-5 overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-[660px] w-full text-left text-xs text-[#D3C9BD]">
            <thead className="bg-white/[0.04] text-[#D9A06F]">
              <tr><th className="px-4 py-3">Case</th><th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Evidence links</th><th className="px-4 py-3">Plan review</th>
                <th className="px-4 py-3">Verification</th></tr>
            </thead>
            <tbody>
              {cases.map(item => <tr key={item.id} className="border-t border-white/[0.06]">
                <td className="px-4 py-3"><p className="font-medium text-[#F5F1E8]">{item.title}</p>
                  <span className="mt-1 block text-[#D3C9BD]/50">{item.id}</span></td>
                <td className="px-4 py-3">{item.department}</td>
                <td className="px-4 py-3">{item.evidenceLinks?.length ?? 0}</td>
                <td className="px-4 py-3">{item.decision?.state ?? "Not proposed"}</td>
                <td className="px-4 py-3 text-[#D9A06F]">{item.evidenceState}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
        {!busy && !caseError && caseMore && (
          <p className="mt-4 text-xs text-amber-200">More than 50 cases exist in the authorized view. This printed register is partial.</p>
        )}
        <Link href="/work/cases" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#D9A06F] print:hidden">
          View full paginated case queue <ArrowRight size={14}/>
        </Link>
      </section>

      {canSeeAudit && <section className="rounded-xl border border-white/10 bg-[#292823] p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold text-[#F5F1E8]">Recent authorized audit activity</h2>
        <p className="mt-1 text-xs text-[#D3C9BD]/65">
          Up to 25 tenant-authorized audit events; not a complete or externally certified evidence history.
        </p>
        {busy ? <p role="status" className="mt-5 text-sm text-[#D3C9BD]/65">Loading audit events…</p>
        : auditError ? <p role="alert" className="mt-5 text-sm text-amber-200">Audit events unavailable. Do not treat this report as complete.</p>
        : audit.length === 0 ? <p className="mt-5 text-sm text-[#D3C9BD]/65">No audit activity available in the current view.</p>
        : <div className="mt-5 space-y-2">
          {audit.map(event => <div key={event.id} className="flex flex-wrap justify-between gap-3 rounded-lg border border-white/[0.07] px-4 py-3 text-xs text-[#D3C9BD]">
            <div className="min-w-0">
              <p className="font-medium text-[#F5F1E8]">{event.action}</p>
              <p className="mt-1 break-all text-[#D3C9BD]/50">{event.resource} · {event.resourceId}</p>
            </div>
            <div className="text-right">
              <p className="text-[#D9A06F]">{event.status}</p>
              <p className="mt-1 text-[#D3C9BD]/50">{new Date(event.timestamp).toLocaleString()}</p>
            </div>
          </div>)}
        </div>}
        {!busy && !auditError && auditMore && <p className="mt-4 text-xs text-amber-200">
          Additional audit records exist beyond the 25 displayed here.
        </p>}
      </section>}

      <p className="border-t border-white/10 pt-5 text-xs leading-6 text-[#D3C9BD]/60">
        Records shown here reflect the active authenticated organization and available permissions.
        Case review approval is an internal investigation-plan decision, never authorization to transfer funds.
      </p>
    </div>
  );
}
export default function ReportsPage() {
  return <InternalOnlyShield requiredPermission="case:read"><ReportsWorkspace /></InternalOnlyShield>;
}
