import { SuggestedPrompt, QuickAction, ReportSection, Role } from "@/lib/types";

export const demoQuickActions: QuickAction[] = [
  {
    id: "qa1",
    label: "Generate Executive Brief",
    description: "Multi-subsidiary performance and risk overview",
    icon: "FileText",
    roles: ["CEO", "Operations"],
  },
  {
    id: "qa2",
    label: "Review At-Risk Accounts",
    description: "Surface customers with elevated churn signals",
    icon: "ShieldAlert",
    roles: ["CEO", "Relationship Manager", "Customer Service"],
  },
  {
    id: "qa3",
    label: "Run Compliance Sweep",
    description: "Scan flagged transactions across business units",
    icon: "ScanSearch",
    roles: ["Compliance", "Operations"],
  },
  {
    id: "qa4",
    label: "Draft Operational Update",
    description: "Summarize pipeline and portfolio status",
    icon: "TrendingUp",
    roles: ["CEO"],
  },
  {
    id: "qa5",
    label: "Audit Support Queue",
    description: "Check priority customer tickets and SLA status",
    icon: "Headset",
    roles: ["Customer Service", "Operations"],
  },
];

export const demoReportSections: ReportSection[] = [];

export const demoExecutiveSummary: Record<Role, string> = {
  CEO: "Zero critical alerts active. Connect organizational data streams or import records to view real-time executive summaries.",
  Operations: "Operations platform standby. Connect telemetry feeds to monitor live reconciliation and SLA compliance.",
  "Relationship Manager": "No active customer alerts. Connect CRM data sources to track relationship health.",
  Compliance: "Compliance monitors active. No policy violations detected.",
  "Customer Service": "Support queue is currently clear.",
  "Customer / Investor": "No portfolio statements loaded.",
};

export const demoSuggestedPrompts: SuggestedPrompt[] = [
  {
    id: "sp1",
    label: "Analyze churn risk across enterprise accounts",
    prompt: "Provide a detailed churn risk analysis for our enterprise accounts, highlighting renewal dates, health scores, and recommended interventions.",
    roles: ["CEO", "Relationship Manager", "Operations"],
  },
  {
    id: "sp2",
    label: "Summarize value leakage sources across business units",
    prompt: "Break down the top value leakage sources across all business units, including root causes and recovery actions.",
    roles: ["CEO", "Operations", "Compliance"],
  },
  {
    id: "sp3",
    label: "Evaluate operational capacity and bottlenecks",
    prompt: "Analyze current processing bottlenecks, including delay metrics, ticket volumes, and expected automation impact.",
    roles: ["Operations", "Customer Service", "CEO"],
  },
];

export function demoGetAiResponse(
  prompt: string,
  _role: Role
): { content: string; richContent?: "performance-stats" | "executive-report" | "at-risk-customers" } {
  return {
    content: `AI analysis complete for query "${prompt}". No active data anomalies detected in the connected database.`,
  };
}
