"use client";

import { Play, Loader2, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { WorkflowDef } from "@/lib/types";

const statusStyle: Record<WorkflowDef["status"], string> = {
  active: "text-emerald bg-emerald/10 border-emerald/25",
  draft: "text-amber bg-amber/10 border-amber/25",
  paused: "text-ivory/50 bg-white/[0.05] border-white/[0.1]",
};

interface WorkflowToolbarProps {
  workflow: WorkflowDef;
  running: boolean;
  ranJustNow: boolean;
  onRun: () => void;
}

export default function WorkflowToolbar({ workflow, running, ranJustNow, onRun }: WorkflowToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass lg:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-[16px] font-bold text-ivory">{workflow.name}</h2>
          <span className={clsx("rounded-full border px-2 py-0.5 text-[10.5px] font-semibold capitalize", statusStyle[workflow.status])}>
            {workflow.status}
          </span>
        </div>
        <p className="mt-1 text-[12px] text-ivory/45">{workflow.description}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden text-right text-[11.5px] text-ivory/40 sm:block">
          <p>{workflow.successRate.toFixed(1)}% success · {workflow.runsPerWeek}/wk</p>
          <p>Last run {workflow.lastRun}</p>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-semibold transition-all duration-200",
            running
              ? "cursor-not-allowed bg-white/[0.06] text-ivory/40"
              : ranJustNow
                ? "bg-emerald/15 text-emerald"
                : "bg-gold-gradient text-matte hover:shadow-gold-glow"
          )}
        >
          {running ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Running…
            </>
          ) : ranJustNow ? (
            <>
              <CheckCircle2 size={14} />
              Success
            </>
          ) : (
            <>
              <Play size={14} />
              Run Workflow
            </>
          )}
        </button>
      </div>
    </div>
  );
}
