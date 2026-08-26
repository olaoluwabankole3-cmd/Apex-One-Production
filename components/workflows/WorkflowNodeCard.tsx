"use client";

import {
  Zap,
  CheckSquare,
  GitBranch,
  Sparkles,
  Clock,
  Plug,
  CheckCircle2,
  Loader2,
  Search,
  Tag,
  TrendingUp,
  ThumbsUp,
  FileText,
  UserCheck,
  Database
} from "lucide-react";
import clsx from "clsx";
import { WorkflowNode, WorkflowNodeStatus, WorkflowNodeType } from "@/lib/types";

export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 72;

export const nodeMeta: Record<WorkflowNodeType, { icon: typeof Zap; color: string; label: string }> = {
  trigger: { icon: Zap, color: "#C9A961", label: "Trigger" },
  action: { icon: CheckSquare, color: "#3FBF8F", label: "Action" },
  condition: { icon: GitBranch, color: "#E0A845", label: "Condition" },
  ai: { icon: Sparkles, color: "#8A7EE8", label: "AI Agent" },
  delay: { icon: Clock, color: "#9CA3AF", label: "Delay" },
  integration: { icon: Plug, color: "#5B9BD5", label: "Integration" },
  ai_analyze: { icon: Search, color: "#A78BFA", label: "AI Analyze" },
  ai_classify: { icon: Tag, color: "#F472B6", label: "AI Classify" },
  ai_predict: { icon: TrendingUp, color: "#60A5FA", label: "AI Predict" },
  ai_recommend: { icon: ThumbsUp, color: "#34D399", label: "AI Recommend" },
  ai_generate: { icon: FileText, color: "#FB923C", label: "AI Generate" },
  ai_decide_approval: { icon: UserCheck, color: "#F59E0B", label: "AI Decide with Approval" },
  context: { icon: Database, color: "#2DD4BF", label: "Context" },
};

interface WorkflowNodeCardProps {
  node: WorkflowNode;
  status: WorkflowNodeStatus;
  selected: boolean;
  onPointerDownNode: (e: React.PointerEvent, id: string) => void;
  onSelect: (id: string) => void;
  styleOverride?: React.CSSProperties;
}

export default function WorkflowNodeCard({ node, status, selected, onPointerDownNode, onSelect, styleOverride }: WorkflowNodeCardProps) {
  const meta = nodeMeta[node.type];
  const Icon = meta.icon;
  const running = status === "running";
  const done = status === "success";

  return (
    <div
      onPointerDown={(e) => onPointerDownNode(e, node.id)}
      onClick={() => onSelect(node.id)}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        borderColor: selected ? "#C9A961" : running ? meta.color : undefined,
        ...styleOverride,
      }}
      className={clsx(
        "absolute cursor-grab select-none rounded-xl border bg-charcoal-light/90 px-3.5 py-3 shadow-glass backdrop-blur-sm transition-shadow duration-200 active:cursor-grabbing",
        selected ? "ring-1 ring-gold/40" : "border-white/[0.09]",
        running && "animate-pulse-slow"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : done ? <CheckCircle2 size={12} /> : <Icon size={12} strokeWidth={1.75} />}
        </span>
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: meta.color }}>
          {meta.label}
        </p>
      </div>
      <p className="mt-1.5 truncate text-[12.5px] font-medium text-ivory/90">{node.label}</p>
      <p className="truncate text-[10.5px] text-ivory/40">{node.subtitle}</p>
    </div>
  );
}
