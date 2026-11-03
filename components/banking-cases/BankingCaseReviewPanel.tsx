"use client";

/** Task-oriented case controls; server authorization remains authoritative. */
import { FormEvent, useState } from "react";
import type { BankingCaseRecord, BankingCaseDecision } from "@/lib/backend/database/schema";
import { apiClient } from "@/lib/apiClient";
import { describeCaseAttention } from "@/lib/cortexCaseAttention";

type Props = {
  record: BankingCaseRecord;
  currentUserId?: string;
  canCreate: boolean;
  canApprove: boolean;
  onUpdated: () => Promise<void>;
};

const dispositionOptions: { value: BankingCaseDecision["disposition"]; label: string }[] = [
  { value: "request_source_review", label: "Request source verification" },
  { value: "continue_investigation", label: "Continue investigation" },
  { value: "escalate_for_control_review", label: "Escalate for internal control review" },
];

const inputClass = "mt-2 w-full rounded-lg border border-white/15 bg-[#24231F] px-3 py-2.5 text-sm text-[#F5F1E8]";
const buttonClass = "rounded-lg border border-[#C58D5F]/40 px-4 py-2.5 text-xs font-semibold text-[#D9A06F] disabled:opacity-40";

export default function BankingCaseReviewPanel({ record, currentUserId, canCreate, canApprove, onUpdated }: Props) {
  const [sourceType, setSourceType] = useState<"Document" | "ValueOpportunity">("Document");
  const [sourceId, setSourceId] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [disposition, setDisposition] = useState<BankingCaseDecision["disposition"]>("request_source_review");
  const [rationale, setRationale] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canMake = canCreate && currentUserId === record.ownerUserId;
  const mayCheck = canApprove && !!record.decision && record.decision.state === "pending" &&
    record.createdByUserId !== currentUserId && record.decision.proposedByUserId !== currentUserId;
  const hasBasis = !!(record.previewOrigin || record.sourceId || record.evidenceLinks?.length);
  const attention = describeCaseAttention(record, { userId: currentUserId, mayApprove: canApprove });

  async function submit(path: string, body: Record<string, unknown>, message: string) {
    if (working) return;
    setWorking(true);
    setProblem(null);
    setSuccess(null);
    try {
      await apiClient.postData<BankingCaseRecord>(
        `/api/v1/banking-cases/${encodeURIComponent(record.id)}/${path}`,
        { ...body, expectedRevision: record.revision ?? 1 }
      );
      setSuccess(message);
      setSourceId("");
      setSourceNote("");
      setRationale("");
      setReviewNote("");
      await onUpdated();
    } catch {
      setProblem("Change could not be confirmed. Check your permissions and current source records, then refresh before trying again.");
    } finally {
      setWorking(false);
    }
  }

  function linkEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit("evidence", { sourceType, sourceId, note: sourceNote },
      "Evidence reference linked for investigation. Its contents remain unverified.");
  }
  function proposePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit("proposal", { disposition, rationale },
      "Investigation plan sent for independent checker review.");
  }
  function reviewPlan(verdict: "approved" | "rejected") {
    if (!record.decision) return;
    void submit("decision", { decisionId: record.decision.id, verdict, note: reviewNote },
      "Checker response recorded. This did not verify financial facts or authorize a financial transaction.");
  }

  return (
    <div className="mt-5 space-y-5 border-t border-white/10 pt-5">
      <div>
        <h4 className="font-semibold text-[#F5F1E8]">Investigation evidence</h4>
        <p className="mt-1 text-xs leading-5 text-[#C6BBAF]">These are references to existing authorized records. A linked document is not certified financial proof.</p>
        {record.sourceType && record.sourceId && (
          <p className="mt-2 break-all text-xs text-[#D9A06F]">Initial source: {record.sourceType} · {record.sourceId}</p>
        )}
        {record.previewOrigin && (
          <p className="mt-2 rounded-md border border-[#C58D5F]/35 p-3 text-xs leading-5 text-[#D9A06F]">
            Preview candidate: {record.previewOrigin.comparisonStatus.replaceAll("_", " ")} · batch {record.previewOrigin.batchId}.
            No raw bank source was retained, completeness was not verified, and no loss was assessed.
          </p>
        )}
        {(record.evidenceLinks ?? []).length === 0 && !record.sourceId && !record.previewOrigin &&
          <p className="mt-2 text-xs text-[#C6BBAF]">No evidence references linked yet.</p>}
        {(record.evidenceLinks ?? []).map(link => (
          <p key={link.id} className="mt-2 break-all rounded-md border border-white/10 p-3 text-xs text-[#D3C9BD]">
            {link.sourceType}: {link.sourceId} · {link.note}
          </p>
        ))}
      </div>

      {canMake && record.decision?.state !== "pending" && (
        <form onSubmit={linkEvidence} className="grid gap-3 rounded-lg border border-white/10 p-4">
          <h4 className="text-sm font-semibold">Link another existing source</h4>
          <label className="text-xs text-[#D3C9BD]">Type
            <select value={sourceType} onChange={e => setSourceType(e.target.value as "Document" | "ValueOpportunity")} className={inputClass}>
              <option value="Document">Institution document</option>
              <option value="ValueOpportunity">Recorded value opportunity</option>
            </select>
          </label>
          <label className="text-xs text-[#D3C9BD]">Source record ID
            <input required value={sourceId} onChange={e => setSourceId(e.target.value)} className={inputClass}
              placeholder="Use the existing authorized record ID" maxLength={64} />
          </label>
          <label className="text-xs text-[#D3C9BD]">Reason this source matters
            <textarea required minLength={10} maxLength={300} value={sourceNote} onChange={e => setSourceNote(e.target.value)}
              rows={2} className={inputClass} />
          </label>
          <button disabled={working} className={buttonClass} type="submit">Link source reference</button>
        </form>
      )}

      <div className="rounded-lg border border-white/10 p-4">
        <h4 className="text-sm font-semibold">Independent investigation-plan review</h4>
        <p className="mt-2 text-xs leading-5 text-[#C6BBAF]">
          An approved plan allows internal investigative follow-up only. It does not authorize transfers, ledger entries, recoveries or case closure.
        </p>
        {record.decision ? (
          <div className="mt-3 space-y-2 text-xs text-[#D3C9BD]">
            <p className="font-semibold text-[#D9A06F]">Plan status: {record.decision.state}</p>
            <p>Requested action: {record.decision.disposition.replaceAll("_", " ")}</p>
            <p>Proposed rationale: {record.decision.rationale}</p>
            {record.decision.reviewNote && <p>Checker note: {record.decision.reviewNote}</p>}
          </div>
        ) : (
          <p className="mt-3 text-xs text-[#C6BBAF]">No investigation plan proposed.</p>
        )}
        {canMake && !record.decision && (
          <form onSubmit={proposePlan} className="mt-4 grid gap-3">
            <label className="text-xs text-[#D3C9BD]">Proposed next step
              <select value={disposition} onChange={e => setDisposition(e.target.value as BankingCaseDecision["disposition"])}
                className={inputClass}>
                {dispositionOptions.filter(option => !record.previewOrigin || record.evidenceLinks?.length ||
                  record.sourceId || option.value === "request_source_review").map(option =>
                  <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-[#D3C9BD]">Reason and evidence limitations
              <textarea required minLength={15} maxLength={600} rows={3} value={rationale}
                onChange={e => setRationale(e.target.value)} className={inputClass} />
            </label>
            <button type="submit" disabled={working || !hasBasis} className={buttonClass}>Request independent review</button>
            {!hasBasis && <p className="text-xs text-[#D9A06F]">Link a source record before requesting review.</p>}
          </form>
        )}
        {mayCheck && record.decision?.state === "pending" && (
          <form onSubmit={e => { e.preventDefault(); reviewPlan("approved"); }} className="mt-4 grid gap-3">
            <label className="text-xs text-[#D3C9BD]">Independent checker note
              <textarea required minLength={10} maxLength={600} rows={3} value={reviewNote}
                onChange={e => setReviewNote(e.target.value)} className={inputClass} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button disabled={working} className={buttonClass} type="submit">Approve internal plan</button>
              <button type="button" disabled={working || reviewNote.trim().length < 10}
                className={buttonClass} onClick={() => reviewPlan("rejected")}>
                Reject plan
              </button>
            </div>
          </form>
        )}
        {record.decision?.state === "pending" && !mayCheck &&
          <p className="mt-3 text-xs text-[#D9A06F]">Awaiting an eligible, independent institution checker.</p>}
      </div>

      <section aria-label="Outcome confirmation checkpoint"
        className="rounded-lg border border-[#C58D5F]/30 bg-[#C58D5F]/[0.05] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D9A06F]">
          Outcome checkpoint · Confirmation still missing
        </p>
        <h4 className="mt-2 text-sm font-semibold text-[#F5F1E8]">{attention.heading}</h4>
        <p className="mt-2 text-xs leading-6 text-[#D3C9BD]">
          <strong>Next accountable step:</strong> {attention.nextAction} · {attention.actionOwner}.
        </p>
        <p className="mt-2 text-xs leading-6 text-[#D3C9BD]">
          <strong>Permitted status update:</strong> {attention.customerSafeUpdate}
        </p>
        <p className="mt-3 border-t border-[#C58D5F]/20 pt-3 text-xs leading-6 text-[#D3C9BD]/80">
          Internal approval and linked references do not certify that a reversal posted,
          a disbursement arrived, or any requested real-world outcome occurred.
          No authoritative outcome-confirmation feed is connected in this release.
          This case remains open and unverified.
        </p>
      </section>

      <section aria-label="Case activity history">
        <h4 className="text-sm font-semibold">Accountability timeline</h4>
        {(record.timeline ?? []).length === 0 ?
          <p className="mt-2 text-xs text-[#C6BBAF]">Older case: creation is present in audit logs; no structured timeline was recorded yet.</p> :
          <ol className="mt-3 space-y-2">
            {(record.timeline ?? []).map(event => (
              <li key={event.id} className="rounded-md border border-white/10 p-3 text-xs text-[#D3C9BD]">
                <span className="font-semibold text-[#D9A06F]">{event.type.replaceAll("_", " ")}</span>
                <span className="ml-2 text-[#C6BBAF]">{new Date(event.occurredAt).toLocaleString()}</span>
                <p className="mt-1 break-words">{event.note}</p>
                <p className="mt-1 text-[#C6BBAF]">Actor {event.actorUserId} · revision {event.revision}</p>
              </li>
            ))}
          </ol>}
      </section>
      {problem && <p role="alert" className="text-xs text-red-300">{problem}</p>}
      {success && <p role="status" className="text-xs text-[#D9A06F]">{success}</p>}
    </div>
  );
}
