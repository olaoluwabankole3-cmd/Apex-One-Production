"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, FileWarning, RefreshCw } from "lucide-react";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";
import { useAuth } from "@/components/auth/AuthContext";
import { apiClient } from "@/lib/apiClient";
import type { BankingCaseRecord } from "@/lib/backend/database/schema";
import type { BankingCaseAssigneeList } from "@/lib/backend/domains/banking-cases/bankingCaseService";

function CaseInbox() {
  const { hasPermission, user } = useAuth();
  const [cases, setCases] = useState<BankingCaseRecord[]>([]);
  const [assignees, setAssignees] = useState<BankingCaseAssigneeList | null>(null);
  const [assigneeError, setAssigneeError] = useState(false);
  const [handoffCaseId, setHandoffCaseId] = useState<string | null>(null);
  const [handoffRecipientId, setHandoffRecipientId] = useState("");
  const [handoffReason, setHandoffReason] = useState("");
  const [sendingHandoff, setSendingHandoff] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState<"Operations" | "Finance">("Operations");
  const [priority, setPriority] = useState<"normal" | "high">("normal");
  const mayCreate = hasPermission("workflow:write");
  const administrator = hasPermission("org:admin");

  const refresh = useCallback(async (nextCursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const path = "/api/v1/banking-cases?limit=25" + (nextCursor ? "&cursor=" + encodeURIComponent(nextCursor) : "");
      const response = await apiClient.requestCollection<BankingCaseRecord>(path);
      setCases((old) => nextCursor ? [...old, ...response.data.filter((item) => !old.some((v) => v.id === item.id))] : response.data);
      setCursor(response.pagination.nextCursor);
      setHasMore(response.pagination.hasMore);
    } catch {
      if (!nextCursor) setCases([]);
      setError("The case inbox could not be loaded. Check access or retry; no case was changed.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!mayCreate) return;
    let mounted = true;
    void apiClient.getData<BankingCaseAssigneeList>("/api/v1/banking-cases/assignees")
      .then((directory) => { if (mounted) setAssignees(directory); })
      .catch(() => { if (mounted) setAssigneeError(true); });
    return () => { mounted = false; };
  }, [mayCreate]);

  async function sendHandoff(event: FormEvent<HTMLFormElement>, record: BankingCaseRecord) {
    event.preventDefault();
    if (sendingHandoff || !mayCreate || !handoffRecipientId) return;
    setSendingHandoff(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.postData<BankingCaseRecord>(
        `/api/v1/banking-cases/${encodeURIComponent(record.id)}/handoff`,
        { recipientUserId: handoffRecipientId, expectedRevision: record.revision ?? 1,
          reason: handoffReason }
      );
      setHandoffCaseId(null);
      setHandoffRecipientId("");
      setHandoffReason("");
      setNotice("Ownership handoff recorded. The case remains open and unverified; no approval or financial result was recorded.");
      await refresh();
    } catch {
      setError("Handoff was not confirmed. Case ownership may have changed; refresh the queue before retrying.");
    } finally {
      setSendingHandoff(false);
    }
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !mayCreate) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.postData<BankingCaseRecord>("/api/v1/banking-cases", {
        title, description, department, priority,
      });
      setTitle("");
      setDescription("");
      setNotice("Case recorded as open and unverified. No financial discrepancy has been confirmed.");
      await refresh();
    } catch {
      setError("The case could not be created. No successful creation was confirmed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header className="rounded-xl border border-[#775A43]/35 bg-[#24231F] p-7 text-[#F5F1E8]">
        <Link href="/workflows" className="inline-flex items-center gap-2 text-xs text-[#D9A06F]"><ArrowLeft size={13} /> Action Center</Link>
        <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.17em] text-[#D9A06F]">QORVEX / CORTEX / BANKING OPERATIONS</p>
        <h1 className="mt-2 font-display text-3xl font-bold">My Cases</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#D3C9BD]">
          This is the first shared banking-case foundation. Staff can record and inspect their own open
          financial-operations cases. Administrators can review the institution-wide queue.
          Handoffs are now available to active Operations and Finance colleagues. Investigation decisions, approvals and financial recoveries are not enabled yet.
        </p>
      </header>
      {mayCreate && (
        <form onSubmit={(event) => void createCase(event)} className="space-y-4 rounded-xl border border-[#785D46]/30 bg-[#302D29] p-6 text-[#F5F1E8]">
          <h2 className="text-lg font-semibold">Record an operational issue</h2>
          <p className="text-xs text-[#D3C9BD]">Creating a case does not verify a loss or execute an external banking action.</p>
          <label className="block text-sm">Issue title
            <input required minLength={8} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/15 bg-[#24231F] px-4 py-3" placeholder="For example: settlement report requires review" />
          </label>
          <label className="block text-sm">What needs investigating?
            <textarea required minLength={10} maxLength={1200} rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/15 bg-[#24231F] px-4 py-3" placeholder="Describe the issue without entering sensitive transaction or customer identifiers." />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">Department
              <select value={department} onChange={(e) => setDepartment(e.target.value as "Operations" | "Finance")} className="mt-2 w-full rounded-lg border border-white/15 bg-[#24231F] p-3">
                <option value="Operations">Operations</option><option value="Finance">Finance</option>
              </select>
            </label>
            <label className="block text-sm">Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value as "normal" | "high")} className="mt-2 w-full rounded-lg border border-white/15 bg-[#24231F] p-3">
                <option value="normal">Normal</option><option value="high">High</option>
              </select>
            </label>
          </div>
          <button type="submit" disabled={saving} className="rounded-lg bg-[#C58D5F] px-5 py-3 text-sm font-bold text-[#171715] disabled:opacity-40">
            {saving ? "Recording…" : "Create case"}
          </button>
        </form>
      )}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ivory">{administrator ? "Institution cases" : "Cases assigned to me"}</h2>
            <p className="text-xs text-ivory/50">Backend records · open and unverified · your authenticated institution</p>
          </div>
          <button type="button" disabled={loading} onClick={() => void refresh()} className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-ivory/70">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
        {assigneeError && mayCreate && <p className="rounded-lg border border-white/10 p-3 text-sm text-ivory/60">The institution assignment list is unavailable. Your existing cases remain readable.</p>}
        {assignees?.hasMore && <p className="rounded-lg border border-white/10 p-3 text-xs text-ivory/60">The assignment list is limited to the first 100 eligible employees; contact your administrator if the recipient is not shown.</p>}
        {notice && <p role="status" className="rounded-lg border border-white/10 p-3 text-sm text-[#D9A06F]">{notice}</p>}
        {error && <p role="alert" className="rounded-lg border border-red-400/30 p-3 text-sm text-red-300">{error}</p>}
        {loading && cases.length === 0 ? <p className="text-sm text-ivory/55">Loading permitted cases…</p> :
         cases.length === 0 ? <div className="rounded-xl border border-dashed border-white/15 p-9 text-center text-ivory/60">
          <ClipboardList className="mx-auto mb-3" /><p>No cases currently visible to your account.</p>
         </div> : (
          <div className="grid gap-3">
            {cases.map((item) => (
              <article key={item.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-5 text-ivory">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{item.title}</h3>
                  <span className="rounded-full border border-[#C58D5F]/30 px-2.5 py-1 text-[10px] text-[#D9A06F]">OPEN · UNVERIFIED</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-ivory/60">{item.description}</p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-ivory/40">
                  <span>{item.department}</span><span>Priority: {item.priority}</span>
                  <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>
                  <span>Case ID: {item.id}</span>
                  <span>Revision: {item.revision ?? 1}</span>
                </div>
                <p className="mt-3 text-xs text-ivory/45">
                  Assigned to: {assignees?.members.find((candidate) => candidate.userId === item.ownerUserId)?.name || (item.ownerUserId === user?.id ? "You" : "Institution staff")}
                </p>
                {!item.sourceId && <p className="mt-3 flex items-center gap-2 text-xs text-ivory/40"><FileWarning size={13} /> No source evidence linked yet</p>}
                {mayCreate && (administrator || item.ownerUserId === user?.id) && assignees && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    {handoffCaseId !== item.id ? (
                      <button type="button" disabled={sendingHandoff} onClick={() => {
                        setHandoffCaseId(item.id); setHandoffRecipientId(""); setHandoffReason("");
                      }} className="rounded-lg border border-[#C58D5F]/40 px-3 py-2 text-xs font-semibold text-[#D9A06F]">
                        Hand off to a colleague
                      </button>
                    ) : (
                      <form onSubmit={(event) => void sendHandoff(event, item)} className="space-y-3">
                        <p className="text-sm font-semibold">Record an accountable handoff</p>
                        <label className="block text-xs text-ivory/65">Recipient
                          <select required value={handoffRecipientId} onChange={(event) => setHandoffRecipientId(event.target.value)}
                            className="mt-2 w-full rounded-lg border border-white/15 bg-[#24231F] p-3 text-sm text-ivory">
                            <option value="">Select an active employee…</option>
                            {assignees.members.filter((candidate) => candidate.userId !== item.ownerUserId).map((candidate) => (
                              <option key={candidate.userId} value={candidate.userId}>{candidate.name} · {candidate.department}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-xs text-ivory/65">Reason for handoff
                          <textarea required minLength={10} maxLength={500} rows={2} value={handoffReason}
                            onChange={(event) => setHandoffReason(event.target.value)}
                            placeholder="Explain what the receiving department needs to investigate…"
                            className="mt-2 w-full rounded-lg border border-white/15 bg-[#24231F] p-3 text-sm text-ivory" />
                        </label>
                        <p className="text-xs text-ivory/45">Ownership transfers only after server validation. This does not approve or close the case.</p>
                        <div className="flex gap-2">
                          <button type="submit" disabled={sendingHandoff || !handoffRecipientId}
                            className="rounded-lg bg-[#C58D5F] px-4 py-2 text-xs font-bold text-[#171715] disabled:opacity-40">
                            {sendingHandoff ? "Submitting…" : "Confirm handoff"}
                          </button>
                          <button type="button" disabled={sendingHandoff} onClick={() => setHandoffCaseId(null)}
                            className="rounded-lg border border-white/15 px-4 py-2 text-xs text-ivory/70">Cancel</button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
         )}
        {hasMore && <button type="button" disabled={loading || !cursor} onClick={() => cursor && void refresh(cursor)}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-ivory/70">Load more</button>}
      </section>
    </div>
  );
}

export default function BankingCasesPage() {
  return <InternalOnlyShield requiredPermission="workflow:read"><CaseInbox /></InternalOnlyShield>;
}
