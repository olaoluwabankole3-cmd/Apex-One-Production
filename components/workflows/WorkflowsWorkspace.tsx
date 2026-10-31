"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, Play, RefreshCw, ShieldCheck, Workflow as WorkflowIcon, XCircle } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { workflowRepository } from "@/lib/data/repositories";
import type { WorkflowDef } from "@/lib/types";
import type { WorkflowRunRecord } from "@/lib/backend/database/schema";
import { useAuth } from "@/components/auth/AuthContext";

interface RunReceipt {
  workflowId: string;
  run: WorkflowRunRecord;
}

export default function WorkflowsWorkspace() {
  const { hasPermission } = useAuth();
  const [workflows, setWorkflows] = useState<WorkflowDef[]>([]);
  const [runsByWorkflow, setRunsByWorkflow] = useState<Record<string, WorkflowRunRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [advancingStep, setAdvancingStep] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [receipt, setReceipt] = useState<RunReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedWorkflows = await workflowRepository.getWorkflows();
      setWorkflows(loadedWorkflows);
      const runEntries = await Promise.all(
        loadedWorkflows.map(async (workflow) => {
          try {
            const runs = await workflowRepository.getWorkflowRuns(workflow.id);
            return [workflow.id, runs] as const;
          } catch {
            return [workflow.id, [] as WorkflowRunRecord[]] as const;
          }
        })
      );
      setRunsByWorkflow(Object.fromEntries(runEntries));
    } catch (cause) {
      setWorkflows([]);
      setRunsByWorkflow({});
      setError(cause instanceof Error ? cause.message : "Workflow request failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (workflowId: string) => {
    setRunningId(workflowId);
    setReceipt(null);
    setReviewNote("");
    setError(null);
    try {
      const result = await workflowRepository.runWorkflow(workflowId);
      setReceipt({ workflowId, run: result });
      setRunsByWorkflow((current) => ({
        ...current,
        [workflowId]: [
          result,
          ...(current[workflowId] || []).filter((existing) => existing.id !== result.id),
        ],
      }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workflow execution failed");
    } finally {
      setRunningId(null);
    }
  };

  const openRun = (workflowId: string, run: WorkflowRunRecord) => {
    setReceipt({ workflowId, run });
    setReviewNote("");
    setError(null);
  };

  const advanceActiveStep = async (
    decision: "approved" | "rejected" | "completed"
  ) => {
    if (!receipt || advancingStep) return;
    const activeStep = receipt.run.steps.find((step) => step.status === "executing");
    if (!activeStep) {
      setError("This run has no active step to advance.");
      return;
    }

    setAdvancingStep(true);
    setError(null);
    try {
      const updated = await workflowRepository.advanceWorkflowStep(
        receipt.run.id,
        activeStep.stepId,
        decision,
        reviewNote.trim() || undefined
      );
      setReceipt({ workflowId: receipt.workflowId, run: updated });
      setRunsByWorkflow((current) => ({
        ...current,
        [receipt.workflowId]: [
          updated,
          ...(current[receipt.workflowId] || []).filter((existing) => existing.id !== updated.id),
        ],
      }));
      setReviewNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workflow step advancement failed");
    } finally {
      setAdvancingStep(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
            CORTEX · Execution
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ivory">
            Workflows
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
            Workflow status and execution receipts come from the backend workflow service.
            The frontend no longer simulates AI reasoning, approvals, integration steps or
            successful outcomes.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-ivory/70 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {loading ? (
        <GlassCard className="p-8 text-center text-sm text-ivory/45">
          Loading authorized workflows…
        </GlassCard>
      ) : workflows.length === 0 ? (
        <GlassCard className="border-dashed p-8 text-center">
          <WorkflowIcon size={24} className="mx-auto text-gold/70" />
          <h2 className="mt-4 font-display text-xl font-bold text-ivory">
            No workflow records
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ivory/45">
            Create and configuration experiences will be completed against the authoritative
            workflow API. No example workflows are injected into this production surface.
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {workflows.map((workflow) => (
            <GlassCard key={workflow.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-base font-bold text-ivory">{workflow.name}</p>
                  <p className="mt-1 text-sm leading-6 text-ivory/45">{workflow.description}</p>
                </div>
                <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-wider text-ivory/45">
                  {workflow.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-ivory/35">
                <span>Business unit: {workflow.subsidiary || "Not specified"}</span>
                <span>Nodes: {workflow.nodes?.length || 0}</span>
              </div>

              {(() => {
                const latestRun = [...(runsByWorkflow[workflow.id] || [])].sort(
                  (a, b) => b.startedAt.localeCompare(a.startedAt)
                )[0];
                const canResume = latestRun && (latestRun.status === "running" || latestRun.status === "waiting_approval");
                return latestRun ? (
                  <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-ivory/35">Latest execution</span>
                      <span className={`text-[10px] uppercase tracking-wider ${canResume ? "text-gold" : latestRun.status === "completed" ? "text-emerald" : latestRun.status === "failed" ? "text-crimson" : "text-ivory/45"}`}>
                        {latestRun.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-ivory/35">
                      Started {new Date(latestRun.startedAt).toLocaleString()}
                    </p>
                    {canResume && (
                      <button
                        onClick={() => openRun(workflow.id, latestRun)}
                        className="mt-2 text-xs font-semibold text-gold/80 transition-colors hover:text-gold"
                      >
                        Resume this run →
                      </button>
                    )}
                  </div>
                ) : null;
              })()}

              {hasPermission("workflow:execute") && (
                <button
                  onClick={() => run(workflow.id)}
                  disabled={runningId !== null}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-xs font-bold text-matte disabled:opacity-50"
                >
                  <Play size={13} />
                  {runningId === workflow.id ? "Starting…" : "Start a new run"}
                </button>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {receipt && (() => {
        const activeStep = receipt.run.steps.find((step) => step.status === "executing");
        const workflow = workflows.find((item) => item.id === receipt.workflowId);
        const activeNode = activeStep
          ? workflow?.nodes.find((node) => node.id === activeStep.nodeId)
          : undefined;
        const isHumanApproval = activeNode?.type === "human_approval";
        const isTerminal = receipt.run.status === "completed" || receipt.run.status === "failed" || receipt.run.status === "cancelled";

        return (
          <GlassCard className="p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="font-display text-lg font-bold text-ivory">Execution receipt</p>
                <p className="mt-1 font-mono text-[11px] text-gold/70">Run ID: {receipt.run.id}</p>
              </div>
              <span className="rounded-full border border-white/[0.1] bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ivory/60">
                {receipt.run.status.replace("_", " ")}
              </span>
            </div>

            <div className="mt-5 space-y-2">
              {receipt.run.steps.map((step, index) => {
                const StepIcon = step.status === "completed"
                  ? CheckCircle2
                  : step.status === "failed"
                    ? XCircle
                    : step.status === "executing"
                      ? Loader2
                      : Circle;
                const statusClass = step.status === "completed"
                  ? "text-emerald"
                  : step.status === "failed"
                    ? "text-crimson"
                    : step.status === "executing"
                      ? "text-gold"
                      : "text-ivory/30";

                return (
                  <div
                    key={step.stepId}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"
                  >
                    <StepIcon size={16} className={`mt-0.5 shrink-0 ${statusClass} ${step.status === "executing" && !advancingStep ? "animate-pulse" : ""}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ivory/85">{step.nodeTitle}</p>
                      <p className="mt-0.5 text-[11px] text-ivory/40">Step {index + 1} of {receipt.run.steps.length}</p>
                      {step.errorMessage && <p className="mt-2 text-xs text-crimson/80">{step.errorMessage}</p>}
                    </div>
                    <span className={`shrink-0 text-[10px] uppercase tracking-wider ${statusClass}`}>
                      {step.status}
                    </span>
                  </div>
                );
              })}
            </div>

            {activeStep && !isTerminal && hasPermission("workflow:execute") && (
              <div className="mt-5 rounded-xl border border-gold/20 bg-gold/[0.035] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/20 bg-gold/10 text-gold">
                    {isHumanApproval ? <ShieldCheck size={17} /> : <Play size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ivory">
                      {isHumanApproval ? "Human decision required" : "Active workflow step"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ivory/45">
                      {isHumanApproval
                        ? "Review this step and record an explicit approval decision. Your choice advances or rejects the workflow and is written to the audit trail."
                        : "When the work represented by this step is complete, record its completion to advance the workflow. This does not claim that an external system action happened automatically."}
                    </p>
                  </div>
                </div>

                <label className="mt-4 block text-xs font-medium text-ivory/55">
                  Decision note <span className="text-ivory/30">(optional; recorded with the step)</span>
                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    maxLength={2000}
                    rows={2}
                    placeholder={isHumanApproval ? "Add context for this decision…" : "Add a completion note…"}
                    className="mt-2 w-full resize-y rounded-lg border border-white/[0.09] bg-black/15 px-3 py-2.5 text-sm text-ivory outline-none placeholder:text-ivory/25 focus:border-gold/35"
                    disabled={advancingStep}
                  />
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  {isHumanApproval ? (
                    <>
                      <button
                        onClick={() => advanceActiveStep("approved")}
                        disabled={advancingStep}
                        className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-xs font-bold text-matte disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {advancingStep ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Approve step
                      </button>
                      <button
                        onClick={() => advanceActiveStep("rejected")}
                        disabled={advancingStep}
                        className="flex items-center gap-2 rounded-lg border border-crimson/25 bg-crimson/[0.08] px-4 py-2.5 text-xs font-semibold text-crimson disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <XCircle size={14} />
                        Reject step
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => advanceActiveStep("completed")}
                      disabled={advancingStep}
                      className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-xs font-bold text-matte disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {advancingStep ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Mark step complete
                    </button>
                  )}
                </div>
              </div>
            )}

            {receipt.run.status === "completed" && (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald/20 bg-emerald/[0.04] p-4">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald" />
                <div>
                  <p className="text-sm font-semibold text-emerald">Workflow run completed</p>
                  <p className="mt-1 text-xs leading-5 text-ivory/45">Every recorded workflow step is marked complete. Any business outcome still needs its own evidence-backed result record.</p>
                </div>
              </div>
            )}
            {receipt.run.status === "failed" && (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-crimson/20 bg-crimson/[0.04] p-4">
                <XCircle size={17} className="mt-0.5 shrink-0 text-crimson" />
                <div>
                  <p className="text-sm font-semibold text-crimson">Workflow run rejected or failed</p>
                  <p className="mt-1 text-xs leading-5 text-ivory/45">The run is terminal. Review the step statuses and start a new run only after addressing the rejection or failure.</p>
                </div>
              </div>
            )}
          </GlassCard>
        );
      })()}

      {error && <p className="text-sm text-crimson/80">{error}</p>}
    </div>
  );
}
