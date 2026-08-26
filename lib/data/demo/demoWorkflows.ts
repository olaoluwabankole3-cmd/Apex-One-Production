import { WorkflowDef } from "@/lib/types";

export interface ContextAwareLog {
  trigger: { label: string; details: string; active: boolean; done: boolean };
  context: { label: string; details: string; active: boolean; done: boolean };
  aiReasoning: { label: string; details: string; active: boolean; done: boolean; content: string };
  decision: { label: string; details: string; active: boolean; done: boolean; content: string };
  action: { label: string; details: string; active: boolean; done: boolean; content: string; approvalRequired: boolean };
  outcome: { label: string; details: string; active: boolean; done: boolean; content: string };
}

export interface HistoricalRun {
  id: string;
  status: "success" | "failed" | "escalated" | "modified";
  timestamp: string;
  duration: string;
  triggeredBy: string;
  outcomeText: string;
  logs: string[];
}

export interface CustomWorkflowDef extends WorkflowDef {
  businessUnit: "Enterprise Operations" | "Commercial Operations" | "Strategic Accounts" | "Customer Operations";
  contextAwareDetails: ContextAwareLog;
  history: HistoricalRun[];
}

export const demoWorkflows: CustomWorkflowDef[] = [];
