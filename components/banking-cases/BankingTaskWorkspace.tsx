"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowRightLeft, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/components/auth/AuthContext";
import type { BankingWorkTaskRecord, BankingCaseRecord } from "@/lib/backend/database/schema";
import type { BankingCaseAssigneeList } from "@/lib/backend/domains/banking-cases/bankingCaseService";

/** Target dates are staff-defined; no deadline or automatic escalation is inferred. */
function TaskDeadline({ task }: { task: BankingWorkTaskRecord }) {
  if (!task.dueAt) return null;
  const pending = task.status === "requested" || task.status === "accepted";
  const overdue = pending && Date.parse(task.dueAt) <= Date.now();
  const utcTime = task.dueAt.slice(0, 16).replace("T", " ") + " UTC";
  return (
    <p className={overdue ? "mt-2 text-xs font-semibold text-amber-200" :
      "mt-2 text-xs text-[#D3C9BD]/70"}>
      {overdue ? "Overdue response target" : "Response target"}: {utcTime}
      {overdue ? " — needs follow-up" : ""}
    </p>
  );
}

/**
 * One case, two kinds of responsibility: the case owner retains accountability,
 * while the named recipient owns only a bounded request. No case/financial
 * detail is fetched for the task recipient without separate case permission.
 */
export function BankingTaskWorkspace() {
  const { hasPermission, user } = useAuth();
  const permitted = hasPermission("case:read");
  const eligibleTeam = permitted && (user?.role === "Operations" || user?.role === "Finance");
  const [team, setTeam] = useState<BankingWorkTaskRecord[]>([]);
  const [teamError, setTeamError] = useState(false);
  const [moreTeam, setMoreTeam] = useState(false);
  const [cursorTeam, setCursorTeam] = useState<string | null>(null);
  const [received, setReceived] = useState<BankingWorkTaskRecord[]>([]);
  const [requested, setRequested] = useState<BankingWorkTaskRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [operating, setOperating] = useState<string | null>(null);
  const [responseNote, setResponseNote] = useState("");
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [moreReceived, setMoreReceived] = useState(false);
  const [moreRequested, setMoreRequested] = useState(false);
  const [cursorReceived, setCursorReceived] = useState<string | null>(null);
  const [cursorRequested, setCursorRequested] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!permitted) return;
    setBusy(true);
    setError(false);
    try {
      const [inbox, waiting] = await Promise.all([
        apiClient.requestCollection<BankingWorkTaskRecord>("/api/v1/banking-tasks?view=received&limit=25"),
        apiClient.requestCollection<BankingWorkTaskRecord>("/api/v1/banking-tasks?view=requested&limit=25"),
      ]);
      setReceived(inbox.data);
      setRequested(waiting.data);
      setMoreReceived(inbox.pagination.hasMore);
      setMoreRequested(waiting.pagination.hasMore);
      setCursorReceived(inbox.pagination.nextCursor);
      setCursorRequested(waiting.pagination.nextCursor);
    } catch {
      setReceived([]); setRequested([]); setError(true);
    }
    // Team read failure never hides the user's own named tasks. Only explicit
    // Operations/Finance membership is eligible; the server checks membership
    // and department again rather than trusting this frontend role hint.
    if (eligibleTeam) {
      try {
        const queue = await apiClient.requestCollection<BankingWorkTaskRecord>(
          "/api/v1/banking-tasks?view=team&limit=25"
        );
        setTeam(queue.data);
        setMoreTeam(queue.pagination.hasMore);
        setCursorTeam(queue.pagination.nextCursor);
        setTeamError(false);
      } catch {
        setTeam([]); setMoreTeam(false); setCursorTeam(null); setTeamError(true);
      }
    } else {
      setTeam([]); setMoreTeam(false); setCursorTeam(null); setTeamError(false);
    }
    setBusy(false);
  }, [permitted, eligibleTeam]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function more(view: "received" | "requested" | "team") {
    const cursor = view === "received" ? cursorReceived :
      view === "requested" ? cursorRequested : cursorTeam;
    if (!cursor || operating) return;
    setOperating("page-" + view);
    try {
      const result = await apiClient.requestCollection<BankingWorkTaskRecord>(
        "/api/v1/banking-tasks?view=" + view + "&limit=25&cursor=" + encodeURIComponent(cursor)
      );
      if (view === "received") {
        setReceived(previous => [...previous, ...result.data.filter(x => !previous.some(p => p.id === x.id))]);
        setCursorReceived(result.pagination.nextCursor);
        setMoreReceived(result.pagination.hasMore);
      } else if (view === "requested") {
        setRequested(previous => [...previous, ...result.data.filter(x => !previous.some(p => p.id === x.id))]);
        setCursorRequested(result.pagination.nextCursor);
        setMoreRequested(result.pagination.hasMore);
      } else {
        setTeam(previous => [...previous, ...result.data.filter(x => !previous.some(p => p.id === x.id))]);
        setCursorTeam(result.pagination.nextCursor);
        setMoreTeam(result.pagination.hasMore);
      }
    } catch { setNotice("A later page could not be loaded; the tasks already shown are unchanged."); }
    finally { setOperating(null); }
  }

  async function transition(task: BankingWorkTaskRecord, action: "accept" | "respond" | "decline") {
    if (operating) return;
    setOperating(task.id);
    setNotice(null);
    try {
      await apiClient.postData<BankingWorkTaskRecord>(
        "/api/v1/banking-tasks/" + encodeURIComponent(task.id) + "/" + action,
        action === "accept"
          ? { expectedRevision: task.revision }
          : { expectedRevision: task.revision, note: responseNote }
      );
      setDraftFor(null);
      setResponseNote("");
      setNotice(action === "respond"
        ? "Task response recorded. This does not close the parent case or verify a banking outcome."
        : action === "accept" ? "Task accepted. The original case owner is unchanged."
          : "Task declined and available for the requester to review.");
      await refresh();
    } catch {
      setNotice("Task update was not confirmed; refresh and check its latest state before trying again.");
    } finally {
      setOperating(null);
    }
  }

  if (!permitted) return null;
  return (
    <section id="cortex-banking-task-workspace" className="rounded-xl border border-[#C58D5F]/30 bg-[#24231F] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-[#D9A06F]">Department collaboration</p>
          <h2 className="mt-2 font-display text-xl font-semibold text-[#F5F1E8]">My Tasks · Team Queue · Waiting on Others</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[#D3C9BD]/75">
            Work is routed either privately to a named employee or explicitly to your permitted department queue.
            Claiming a shared task does not transfer its parent case or reveal confidential case records.
            Task replies and internal approvals do not verify external banking outcomes.
          </p>
        </div>
        <button type="button" disabled={busy || Boolean(operating)} onClick={() => void refresh()}
          className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-[#D9A06F] disabled:opacity-40">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {error && <p role="alert" className="mt-4 text-xs text-amber-200">Task inbox is unavailable. No results have been inferred.</p>}
      {notice && <p role="status" className="mt-4 rounded-lg border border-[#C58D5F]/20 p-3 text-xs text-[#D9A06F]">{notice}</p>}
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F5F1E8]"><ArrowRightLeft size={15}/> My assigned requests</h3>
          <p className="mt-1 text-[11px] text-[#D3C9BD]/50">Up to 25 on the current page</p>
          <div className="mt-3 space-y-3">
            {!busy && received.length === 0 && !error && <p className="rounded-lg border border-dashed border-white/10 p-4 text-xs text-[#D3C9BD]/65">No assigned task requests are currently visible.</p>}
            {received.map(task => (
              <article key={task.id} className="rounded-lg border border-white/[0.09] bg-[#2E2B26] p-4">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-medium text-[#F5F1E8]">{task.title}</h4>
                  <span className="rounded-full border border-[#C58D5F]/30 px-2 py-1 text-[10px] text-[#D9A06F]">{task.status}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#D3C9BD]/80">{task.question}</p>
                <p className="mt-2 text-xs leading-5 text-[#D3C9BD]/55"><strong>Requested output:</strong> {task.expectedResponse}</p>
                <TaskDeadline task={task} />
                {task.responseNote && <p className="mt-2 text-xs leading-5 text-[#D3C9BD]/75">Recorded response: {task.responseNote}</p>}
                {task.status === "requested" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" disabled={Boolean(operating)} onClick={() => void transition(task, "accept")}
                      className="flex items-center gap-1.5 rounded-lg border border-[#C58D5F]/40 px-3 py-2 text-xs text-[#D9A06F] disabled:opacity-40">
                      <CheckCircle2 size={13}/> Accept task
                    </button>
                    <button type="button" disabled={Boolean(operating)} onClick={() => { setDraftFor(task.id); setResponseNote(""); }}
                      className="rounded-lg border border-white/15 px-3 py-2 text-xs text-[#D3C9BD] disabled:opacity-40">Decline with reason</button>
                  </div>
                )}
                {task.status === "accepted" &&
                  <button type="button" disabled={Boolean(operating)} onClick={() => { setDraftFor(task.id); setResponseNote(""); }}
                    className="mt-4 rounded-lg border border-[#C58D5F]/40 px-3 py-2 text-xs text-[#D9A06F] disabled:opacity-40">
                    Record response
                  </button>}
                {draftFor === task.id && (task.status === "accepted" || task.status === "requested") &&
                  <div className="mt-3 space-y-2">
                    <label className="block text-xs text-[#D3C9BD]">Your {task.status === "accepted" ? "response" : "decline reason"}
                      <textarea value={responseNote} onChange={event => setResponseNote(event.target.value)}
                        minLength={15} maxLength={600} rows={3}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#24231F] p-3 text-xs text-[#F5F1E8]"
                        placeholder="State findings or next action. Do not paste account data or confidential source records." />
                    </label>
                    <button type="button" disabled={Boolean(operating) || responseNote.trim().length < 15}
                      onClick={() => void transition(task, task.status === "accepted" ? "respond" : "decline")}
                      className="rounded-lg border border-[#C58D5F]/40 px-3 py-2 text-xs text-[#D9A06F] disabled:opacity-40">
                      Record {task.status === "accepted" ? "response" : "decline"}
                    </button>
                  </div>
                }
              </article>
            ))}
            {moreReceived && <button type="button" disabled={Boolean(operating)} onClick={() => void more("received")}
              className="text-xs text-[#D9A06F] disabled:opacity-40">Load more assigned requests</button>}
          </div>
        </div>
        {eligibleTeam && (
          <div aria-label="Team Queue" id="cortex-department-team-queue">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F5F1E8]">
              <ArrowRightLeft size={15}/> Team Queue
            </h3>
            <p className="mt-1 text-[11px] text-[#D3C9BD]/50">
              Unclaimed requests explicitly shared with your department; up to 25 on the current page
            </p>
            {teamError && (
              <p role="alert" className="mt-3 rounded-lg border border-amber-300/20 p-3 text-xs text-amber-200">
                Team Queue cannot be loaded. Your own tasks remain available.
              </p>
            )}
            <div className="mt-3 space-y-3">
              {!busy && team.length === 0 && !teamError && (
                <p className="rounded-lg border border-dashed border-white/10 p-4 text-xs text-[#D3C9BD]/65">
                  No unclaimed department requests are currently visible.
                </p>
              )}
              {team.map(task => (
                <article key={task.id} className="rounded-lg border border-[#C58D5F]/20 bg-[#2E2B26] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-medium text-[#F5F1E8]">{task.title}</h4>
                    <span className="rounded-full border border-[#C58D5F]/30 px-2 py-1 text-[10px] text-[#D9A06F]">
                      Unclaimed
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#D3C9BD]/80">{task.question}</p>
                  <p className="mt-2 text-xs leading-5 text-[#D3C9BD]/55">
                    <strong>Requested output:</strong> {task.expectedResponse}
                  </p>
                  <TaskDeadline task={task} />
                  <p className="mt-3 text-[11px] leading-5 text-[#D3C9BD]/55">
                    This task is shared only with eligible members of {task.targetDepartment}.
                    The parent case and documents are not shared.
                  </p>
                  <button type="button" disabled={Boolean(operating)}
                    onClick={() => void transition(task, "accept")}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#C58D5F]/40 px-3 py-2 text-xs text-[#D9A06F] disabled:opacity-40">
                    <CheckCircle2 size={13}/> Accept for me
                  </button>
                </article>
              ))}
              {moreTeam && (
                <button type="button" disabled={Boolean(operating)} onClick={() => void more("team")}
                  className="text-xs text-[#D9A06F] disabled:opacity-40">Load more team requests</button>
              )}
            </div>
          </div>
        )}
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F5F1E8]"><Clock3 size={15}/> Waiting on Others</h3>
          <p className="mt-1 text-[11px] text-[#D3C9BD]/50">Requests you initiated; up to 25 on the current page</p>
          <div className="mt-3 space-y-3">
            {!busy && requested.length === 0 && !error && <p className="rounded-lg border border-dashed border-white/10 p-4 text-xs text-[#D3C9BD]/65">No requests you created are currently visible.</p>}
            {requested.map(task => (
              <article key={task.id} className="rounded-lg border border-white/[0.09] bg-[#2E2B26] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-medium text-[#F5F1E8]">{task.title}</h4>
                  <span className="rounded-full border border-[#C58D5F]/30 px-2 py-1 text-[10px] text-[#D9A06F]">{task.status}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#D3C9BD]/75">Sent to {task.targetDepartment} · {task.deliveryMode === "department"
                  ? (task.recipientUserId ? "Claimed by colleague" : "Team Queue — awaiting acceptance")
                  : "Named colleague"}</p>
                <p className="mt-2 text-xs text-[#D3C9BD]/65">{task.expectedResponse}</p>
                <TaskDeadline task={task} />
                {task.responseNote && <p className="mt-3 text-xs leading-5 text-[#D3C9BD]/90">Response: {task.responseNote}</p>}
                <p className="mt-3 text-[11px] text-[#D3C9BD]/50">Case remains open and unverified until independent outcome confirmation.</p>
              </article>
            ))}
            {moreRequested && <button type="button" disabled={Boolean(operating)} onClick={() => void more("requested")}
              className="text-xs text-[#D9A06F] disabled:opacity-40">Load more sent requests</button>}
          </div>
        </div>
      </div>
    </section>
  );
}

export function BankingCaseTaskRequest({
  record, assignees, onCreated,
}: {
  record: BankingCaseRecord;
  assignees: BankingCaseAssigneeList;
  onCreated: () => void;
}) {
  const { user, hasPermission } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [recipientUserId, setRecipientUserId] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"named" | "department">("named");
  const [targetDepartment, setTargetDepartment] = useState<"Finance" | "Operations">(
    record.department === "Operations" ? "Finance" : "Operations"
  );
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [expectedResponse, setExpectedResponse] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState(false);
  const mayRequest = hasPermission("case:assign") &&
    (record.ownerUserId === user?.id || hasPermission("org:admin")) &&
    record.status === "open" && record.decision?.state !== "pending";
  const recipients = assignees.members.filter(member =>
    member.userId !== user?.id && member.department !== record.department
  );
  if (!mayRequest) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(false); setNotice(false);
    try {
      await apiClient.postData<BankingWorkTaskRecord>("/api/v1/banking-tasks", {
        caseId: record.id,
        ...(deliveryMode === "department" ? { deliveryMode: "department", targetDepartment } : { recipientUserId }),
        title, question, expectedResponse,
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
        expectedCaseRevision: record.revision ?? 1,
      });
      setExpanded(false); setRecipientUserId(""); setDeliveryMode("named"); setTitle("");
      setQuestion(""); setExpectedResponse(""); setDueAt(""); setNotice(true);
      onCreated();
    } catch { setError(true); }
    finally { setSaving(false); }
  }

  return (
    <section className="mt-4 border-t border-white/10 pt-4" aria-label="Cross-department task request">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[#F5F1E8]">Ask another department to help</p>
          <p className="mt-1 text-xs text-[#D3C9BD]/65">Request a specific answer without transferring ownership or sharing this full case.</p>
        </div>
        <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}
          className="rounded-lg border border-[#C58D5F]/40 px-3 py-2 text-xs text-[#D9A06F]">
          {expanded ? "Close request" : "Request department task"}
        </button>
      </div>
      {notice && <p role="status" className="mt-3 text-xs text-[#D9A06F]">Task requested. The case owner remains unchanged; check Waiting on Others for progress.</p>}
      {error && <p role="alert" className="mt-3 text-xs text-amber-200">Task request not confirmed. Review the case and retry; do not duplicate requests.</p>}
      {expanded && <form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-3">
        <label className="text-xs text-[#D3C9BD]">How to send this task
          <select value={deliveryMode}
            onChange={event => setDeliveryMode(event.target.value as "named" | "department")}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#24231F] p-3 text-sm text-[#F5F1E8]">
            <option value="named">Private request to a named employee</option>
            <option value="department">Share request with the receiving department queue</option>
          </select>
        </label>
        {deliveryMode === "named" ? (
          <label className="text-xs text-[#D3C9BD]">Named recipient
            <select required value={recipientUserId} onChange={event => setRecipientUserId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#24231F] p-3 text-sm text-[#F5F1E8]">
              <option value="">Select an authorized employee in the other department</option>
              {recipients.map(member =>
                <option key={member.userId} value={member.userId}>{member.name} · {member.department}</option>
              )}
            </select>
          </label>
        ) : (
          <>
            <label className="text-xs text-[#D3C9BD]">Receiving department
              <select required value={targetDepartment}
                onChange={event => setTargetDepartment(event.target.value as "Finance" | "Operations")}
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#24231F] p-3 text-sm text-[#F5F1E8]">
                {(["Finance", "Operations"] as const)
                  .filter(department => department !== record.department)
                  .map(department => <option key={department} value={department}>{department} Team Queue</option>)}
              </select>
            </label>
            <p className="rounded-lg border border-amber-300/25 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100/80">
              Department sharing is explicit: every eligible employee in the receiving team
              may read the task title, question and requested output before someone claims it.
              Never include customer names, account numbers, transaction details, case documents
              or restricted information. The parent case stays private.
            </p>
          </>
        )}
        <label className="text-xs text-[#D3C9BD]">Task title
          <input required minLength={8} maxLength={120} value={title} onChange={event => setTitle(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#24231F] p-3 text-sm text-[#F5F1E8]"
            placeholder="E.g. Confirm settlement investigation status" />
        </label>
        <label className="text-xs text-[#D3C9BD]">Specific question (no confidential account details)
          <textarea required minLength={15} maxLength={600} rows={2} value={question} onChange={event => setQuestion(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#24231F] p-3 text-sm text-[#F5F1E8]"
            placeholder="What do you need this department to investigate?" />
        </label>
        <label className="text-xs text-[#D3C9BD]">Expected response or proof
          <textarea required minLength={15} maxLength={300} rows={2} value={expectedResponse} onChange={event => setExpectedResponse(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#24231F] p-3 text-sm text-[#F5F1E8]"
            placeholder="Describe the response needed; do not paste bank feeds." />
        </label>
        <label className="text-xs text-[#D3C9BD]">Response target (optional)
          <input type="datetime-local" value={dueAt}
            onChange={event => setDueAt(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#24231F] p-3 text-sm text-[#F5F1E8]" />
          <span className="mt-1 block text-[11px] text-[#D3C9BD]/55">
            Choose between 5 minutes and 30 days ahead. Overdue tasks are highlighted, not automatically escalated.
          </span>
        </label>
        <button type="submit" disabled={saving}
          className="justify-self-start rounded-lg border border-[#C58D5F]/50 bg-[#C58D5F]/10 px-4 py-2.5 text-xs font-semibold text-[#D9A06F] disabled:opacity-40">
          {saving ? "Requesting…" : "Send task request"}
        </button>
      </form>}
    </section>
  );
}
