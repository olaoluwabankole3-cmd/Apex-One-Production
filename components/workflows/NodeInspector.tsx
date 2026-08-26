"use client";

import { Trash2 } from "lucide-react";
import { WorkflowNode, WorkflowNodeStatus } from "@/lib/types";
import { nodeMeta } from "./WorkflowNodeCard";

interface NodeInspectorProps {
  node: WorkflowNode | null;
  status: WorkflowNodeStatus | undefined;
  onDelete: (id: string) => void;
  onUpdateNode: (id: string, updates: Partial<WorkflowNode>) => void;
}

export default function NodeInspector({ node, status, onDelete, onUpdateNode }: NodeInspectorProps) {
  if (!node) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass">
        <p className="font-display text-[13px] font-bold text-ivory">Node Inspector</p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ivory/40">
          Select a node on the canvas to view and edit its properties.
        </p>
      </div>
    );
  }

  const meta = nodeMeta[node.type];
  const Icon = meta.icon;

  return (
    <div className="rounded-2xl border border-gold/20 bg-charcoal/40 p-4 shadow-glass">
      <div className="flex items-center justify-between">
        <p className="font-display text-[13px] font-bold text-ivory">Node Inspector</p>
        <button
          onClick={() => onDelete(node.id)}
          aria-label="Delete node"
          className="flex h-6 w-6 items-center justify-center rounded-md text-ivory/35 transition-colors duration-200 hover:bg-crimson/10 hover:text-crimson"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
        >
          <Icon size={13} strokeWidth={1.75} />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: meta.color }}>
          {meta.label}
        </p>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.06em] text-ivory/35 font-medium">Node Label</label>
          <input
            type="text"
            value={node.label}
            onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
            className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ivory outline-none focus:border-gold/30"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.06em] text-ivory/35 font-medium">Description</label>
          <textarea
            value={node.subtitle}
            onChange={(e) => onUpdateNode(node.id, { subtitle: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ivory outline-none focus:border-gold/30 resize-none"
          />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.06em] text-ivory/35 font-medium">Status</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${status === 'success' ? 'bg-emerald' : status === 'running' ? 'bg-gold animate-pulse' : 'bg-white/20'}`} />
            <p className="text-[12px] capitalize text-ivory/70">{status ?? "idle"}</p>
          </div>
        </div>

        {/* Dynamic Type-specific Parameters */}
        <div className="border-t border-white/[0.06] pt-3">
          <p className="text-[11px] font-semibold text-gold/80 mb-2">Parameters</p>
          {node.type === "trigger" && (
            <div>
              <label className="text-[10px] text-ivory/40">Event Trigger Source</label>
              <select className="mt-1 w-full rounded-lg border border-white/[0.08] bg-charcoal/90 px-2 py-1.5 text-[11.5px] text-ivory outline-none">
                <option>On Customer Risk Alert</option>
                <option>On Scheduled Cron</option>
                <option>On Webhook Received</option>
                <option>On Database Mutation</option>
              </select>
            </div>
          )}
          {node.type === "context" && (
            <div>
              <label className="text-[10px] text-ivory/40">Context Boundary Rules</label>
              <input
                type="text"
                defaultValue="renewal_days < 90 AND support_tickets > 3"
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11.5px] text-ivory outline-none font-mono"
              />
            </div>
          )}
          {node.type === "condition" && (
            <div>
              <label className="text-[10px] text-ivory/40">Branch Filter Rule</label>
              <input
                type="text"
                defaultValue="healthScore < 50"
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11.5px] text-ivory outline-none font-mono"
              />
            </div>
          )}
          {node.type === "ai_analyze" && (
            <div>
              <label className="text-[10px] text-ivory/40">Deep Analysis Scope</label>
              <textarea
                rows={2}
                defaultValue="Analyze compounding account metrics including churn indicators."
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11.5px] text-ivory outline-none resize-none font-sans"
              />
            </div>
          )}
          {node.type === "ai_classify" && (
            <div>
              <label className="text-[10px] text-ivory/40">Classification Labels</label>
              <input
                type="text"
                defaultValue="CRITICAL_RISK, STABLE_REVENUE, LOW_ENGAGEMENT"
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11.5px] text-ivory outline-none font-mono"
              />
            </div>
          )}
          {node.type === "ai_predict" && (
            <div>
              <label className="text-[10px] text-ivory/40">Prediction Metric Target</label>
              <input
                type="text"
                defaultValue="probability_of_churn_percentage"
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11.5px] text-ivory outline-none font-mono"
              />
            </div>
          )}
          {node.type === "ai_recommend" && (
            <div>
              <label className="text-[10px] text-ivory/40">Recommendation Prompt</label>
              <textarea
                rows={2}
                defaultValue="Generate 3 strategic retention pathways customized to usage logs."
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11.5px] text-ivory outline-none resize-none"
              />
            </div>
          )}
          {node.type === "ai_generate" && (
            <div>
              <label className="text-[10px] text-ivory/40">Generation Document Format</label>
              <textarea
                rows={2}
                defaultValue="Executive Client Health Dossier & Remediation Briefing"
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11.5px] text-ivory outline-none resize-none"
              />
            </div>
          )}
          {node.type === "ai_decide_approval" && (
            <div>
              <label className="text-[10px] text-ivory/40">Approval Stakeholder Group</label>
              <select className="mt-1 w-full rounded-lg border border-white/[0.08] bg-charcoal/90 px-2 py-1.5 text-[11.5px] text-ivory outline-none">
                <option>Account Executive & RM (Elena Cho)</option>
                <option>Compliance Desk Check</option>
                <option>Operations Audit Committee</option>
                <option>Strategic Accounts Lead</option>
              </select>
            </div>
          )}
          {node.type === "action" && (
            <div>
              <label className="text-[10px] text-ivory/40">Recipient / Target</label>
              <input
                type="text"
                defaultValue="elena.cho@apexsync.com"
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11.5px] text-ivory outline-none"
              />
            </div>
          )}
          {node.type === "ai" && (
            <div>
              <label className="text-[10px] text-ivory/40">Model Instructions</label>
              <textarea
                rows={2}
                defaultValue="Analyze sentiment and extract key facts..."
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11.5px] text-ivory outline-none resize-none"
              />
            </div>
          )}
          {node.type === "delay" && (
            <div>
              <label className="text-[10px] text-ivory/40">Duration (seconds)</label>
              <input
                type="number"
                defaultValue={15}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11.5px] text-ivory outline-none"
              />
            </div>
          )}
          {node.type === "integration" && (
            <div>
              <label className="text-[10px] text-ivory/40">Platform Integration</label>
              <select className="mt-1 w-full rounded-lg border border-white/[0.08] bg-charcoal/90 px-2 py-1.5 text-[11.5px] text-ivory outline-none">
                <option>Google Calendar Sync (Create Event)</option>
                <option>Slack Channel Notification</option>
                <option>Salesforce Account Alert</option>
                <option>Jira Ticket Auto-Create</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
