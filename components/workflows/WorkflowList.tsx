"use client";

import clsx from "clsx";
import { WorkflowDef } from "@/lib/types";

interface WorkflowListProps {
  workflows: WorkflowDef[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const statusStyle: Record<WorkflowDef["status"], string> = {
  active: "text-emerald bg-emerald/10 border-emerald/25",
  draft: "text-amber bg-amber/10 border-amber/25",
  paused: "text-ivory/50 bg-white/[0.05] border-white/[0.1]",
};

export default function WorkflowList({ workflows, selectedId, onSelect }: WorkflowListProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-charcoal/40 shadow-glass">
      <div className="border-b border-white/[0.06] p-4">
        <p className="font-display text-[14px] font-bold text-ivory">Workflow Library</p>
        <p className="mt-0.5 text-[11.5px] text-ivory/40">{workflows.length} automations</p>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
        {workflows.map((wf) => (
          <button
            key={wf.id}
            onClick={() => onSelect(wf.id)}
            className={clsx(
              "w-full rounded-xl px-3.5 py-3 text-left transition-colors duration-200",
              selectedId === wf.id ? "border border-gold/25 bg-white/[0.06]" : "border border-transparent hover:bg-white/[0.03]"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12.5px] font-medium leading-snug text-ivory/90">{wf.name}</p>
              <span className={clsx("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize", statusStyle[wf.status])}>
                {wf.status}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-ivory/40">{wf.subsidiary}</p>
            <div className="mt-2 flex items-center gap-3 text-[10.5px] text-ivory/35">
              <span>{wf.successRate.toFixed(1)}% success</span>
              <span>·</span>
              <span>{wf.runsPerWeek}/wk</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
