"use client";

import { WorkflowNodeType } from "@/lib/types";
import { nodeMeta } from "./WorkflowNodeCard";

interface NodePaletteProps {
  onAddNode: (type: WorkflowNodeType) => void;
}

const types: WorkflowNodeType[] = [
  "trigger",
  "context",
  "condition",
  "ai_analyze",
  "ai_classify",
  "ai_predict",
  "ai_recommend",
  "ai_generate",
  "ai_decide_approval",
  "action",
  "integration"
];

export default function NodePalette({ onAddNode }: NodePaletteProps) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass">
      <p className="font-display text-[13px] font-bold text-ivory">Node Palette</p>
      <p className="mt-0.5 text-[11px] text-ivory/40">Click to add to canvas</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {types.map((type) => {
          const meta = nodeMeta[type];
          const Icon = meta.icon;
          return (
            <button
              key={type}
              onClick={() => onAddNode(type)}
              className="flex flex-col items-start gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2.5 text-left transition-colors duration-200 hover:border-gold/25 hover:bg-white/[0.04]"
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md"
                style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
              >
                <Icon size={12} strokeWidth={1.75} />
              </span>
              <span className="text-[11px] font-medium text-ivory/75">{meta.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
