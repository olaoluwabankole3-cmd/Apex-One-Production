"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/components/auth/AuthContext";
import type { BankingCaseTransferInvitation } from "@/lib/backend/database/schema";

/**
 * A transfer invitation is NOT case access. No case title, description,
 * evidence or financial record is fetched/displayed until acceptance succeeds.
 */
export function BankingCaseTransferInbox() {
  const { user, hasPermission } = useAuth();
  const eligible = hasPermission("case:read") && hasPermission("case:assign") &&
    (user?.role === "Operations" || user?.role === "Finance");
  const [invitations, setInvitations] = useState<BankingCaseTransferInvitation[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [operating, setOperating] = useState<string | null>(null);
  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!eligible) return;
    setBusy(true);
    setError(false);
    try {
      const response = await apiClient.getData<{
        items: BankingCaseTransferInvitation[]; hasMore: boolean;
      }>("/api/v1/banking-case-transfers");
      setInvitations(response.items);
      setHasMore(response.hasMore);
    } catch {
      setInvitations([]);
      setError(true);
    } finally { setBusy(false); }
  }, [eligible]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function respond(item: BankingCaseTransferInvitation, action: "accept" | "decline") {
    if (operating) return;
    setOperating(item.transferId);
    setNotice(null);
    try {
      await apiClient.postData(
        "/api/v1/banking-cases/" + encodeURIComponent(item.caseId) + "/transfer",
        {
          action, transferId: item.transferId, expectedRevision: item.revision,
          ...(action === "decline" ? { note: declineNote } : {}),
        }
      );
      setDeclineFor(null);
      setDeclineNote("");
      setNotice(action === "accept"
        ? "Case responsibility accepted. Your Cases queue now includes the full case; bank outcome remains unverified."
        : "Transfer declined. The originating case owner remains accountable.");
      await refresh();
    } catch {
      setNotice("Transfer decision was not confirmed. Refresh to check whether the offer changed before retrying.");
      await refresh();
    } finally { setOperating(null); }
  }

  if (!eligible) return null;
  return (
    <section id="cortex-case-transfer-inbox"
      className="rounded-xl border border-[#C58D5F]/30 bg-[#24231F] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-[#D9A06F]">
            Accountable ownership
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold text-[#F5F1E8]">
            Incoming Case Transfers
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[#D3C9BD]/75">
            A case stays with its original owner until you explicitly accept.
            Invitations show only the originating department, priority and request time.
            Case details and evidence remain private until acceptance.
          </p>
        </div>
        <button type="button" disabled={busy || Boolean(operating)}
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-[#D9A06F] disabled:opacity-40">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-amber-300/20 p-3 text-xs text-amber-200">
          Transfer invitations could not be verified. No invitations have been inferred.
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 rounded-lg border border-[#C58D5F]/25 p-3 text-xs text-[#D9A06F]">
          {notice} <Link href="/work/cases" className="underline underline-offset-2">Open Cases</Link>
        </p>
      )}
      {!busy && !error && invitations.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-white/10 p-4 text-xs text-[#D3C9BD]/65">
          No case ownership invitations are awaiting your response.
        </p>
      )}
      {hasMore && (
        <p role="status" className="mt-3 text-xs text-amber-200">
          More than 50 invitations are pending. The queue is limited; contact a supervisor to clear the backlog.
        </p>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {invitations.map(item => (
          <article key={item.transferId} className="rounded-lg border border-white/10 bg-[#302D29] p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#F5F1E8]">
                {item.fromDepartment} → {item.targetDepartment}
              </h3>
              <span className="rounded-full border border-[#C58D5F]/35 px-2 py-1 text-[10px] text-[#D9A06F]">
                Awaiting your decision
              </span>
            </div>
            <p className="mt-3 text-xs text-[#D3C9BD]/75">
              {item.priority === "high" ? "High" : "Normal"} priority
              · Requested {new Date(item.requestedAt).toLocaleDateString()}
            </p>
            <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[#D3C9BD]/65">
              <ShieldAlert size={15} className="mt-0.5 shrink-0"/>
              Accepting transfers responsibility for the full confidential case to your account.
              It does not verify any external financial result.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={Boolean(operating)}
                onClick={() => void respond(item, "accept")}
                className="inline-flex items-center gap-2 rounded-lg border border-[#C58D5F]/45 px-3 py-2 text-xs font-semibold text-[#D9A06F] disabled:opacity-40">
                <CheckCircle2 size={13}/> Accept case ownership
              </button>
              <button type="button" disabled={Boolean(operating)}
                onClick={() => { setDeclineFor(item.transferId); setDeclineNote(""); }}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs text-[#D3C9BD] disabled:opacity-40">
                Decline with reason
              </button>
            </div>
            {declineFor === item.transferId && (
              <div className="mt-3 space-y-2">
                <label className="block text-xs text-[#D3C9BD]">
                  Decline reason (audited; do not enter private customer details)
                  <textarea value={declineNote} onChange={event => setDeclineNote(event.target.value)}
                    minLength={15} maxLength={400} rows={2}
                    className="mt-2 w-full rounded-lg border border-white/15 bg-[#24231F] p-3 text-xs text-[#F5F1E8]" />
                </label>
                <button type="button" disabled={Boolean(operating) || declineNote.trim().length < 15}
                  onClick={() => void respond(item, "decline")}
                  className="rounded-lg border border-[#C58D5F]/45 px-3 py-2 text-xs text-[#D9A06F] disabled:opacity-40">
                  Record decline
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
