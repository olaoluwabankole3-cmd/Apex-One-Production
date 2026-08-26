import { ActivityItem, NotificationItem } from "@/lib/types";

export type SignalCategory =
  | "Critical"
  | "Risks"
  | "Opportunities"
  | "Decisions"
  | "Customer Signals"
  | "Revenue Signals"
  | "Operations"
  | "Workflow"
  | "AI Insights";

export interface IntelligenceSignal {
  id: string;
  category: SignalCategory;
  title: string;
  timestamp: string;
  source: string;
  businessArea: string;
  urgency: "Critical" | "Urgent" | "Normal";
  confidence: number; // Percentage
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "active" | "investigating" | "understood" | "assigned";
  assignee?: string;
  whatHappened: string;
  whyItMatters: string;
  potentialImpact: string;
  recommendedAction: string;
  evidenceLogs: string[];
}

export const demoActivity: ActivityItem[] = [];
export const demoNotifications: NotificationItem[] = [];
export const demoSignals: IntelligenceSignal[] = [];
