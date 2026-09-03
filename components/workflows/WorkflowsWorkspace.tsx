"use client";

import { useEffect, useState } from "react";
import { Play, RefreshCw, Workflow as WorkflowIcon } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { workflowRepository } from "@/lib/data/repositories";
import type { WorkflowDef } from "@/lib/types";
import { useAuth } from "@/components/auth/AuthContext";

interface RunReceipt {
  runId: string;
  logs: string[];
}

export default function WorkflowsWorkspace() {
  const { hasPermission } = useAuth();
  const [workflows, setWorkflows] = useState<WorkflowDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<RunReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkflows(await workflowRepository.getWorkflows());
    } catch (cause) {
      setWorkflows([]);
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
    setError(null);
    try {
      const result = await workflowRepository.runWorkflow(workflowId);
      setReceipt({ runId: result.runId, logs: result.logs });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workflow execution failed");
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
            APEX ONE · Execution
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

              {hasPermission("workflow:execute") && (
                <button
                  onClick={() => run(workflow.id)}
                  disabled={runningId !== null}
                  className="mt-5 flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-xs font-bold text-matte disabled:opacity-50"
                >
                  <Play size={13} />
                  {runningId === workflow.id ? "Executing…" : "Run workflow"}
                </button>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {receipt && (
        <GlassCard className="p-6">
          <p className="font-display text-lg font-bold text-ivory">Execution receipt</p>
          <p className="mt-1 font-mono text-[11px] text-gold/70">Run ID: {receipt.runId}</p>
          <div className="mt-4 space-y-2">
            {receipt.logs.length === 0 ? (
              <p className="text-sm text-ivory/45">No step logs were returned.</p>
            ) : (
              receipt.logs.map((log, index) => (
                <p
                  key={`${receipt.runId}-${index}`}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-ivory/55"
                >
                  {log}
                </p>
              ))
            )}
          </div>
        </GlassCard>
      )}

      {error && <p className="text-sm text-crimson/80">{error}</p>}
    </div>
  );
}
