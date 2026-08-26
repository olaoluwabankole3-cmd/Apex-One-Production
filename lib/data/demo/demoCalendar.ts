export type EventCategory =
  | "Executive Decision"
  | "Customer Meeting"
  | "Renewal"
  | "Strategy"
  | "Operations"
  | "Compliance"
  | "Review"
  | "Workflow"
  | "Internal";

export interface DecisionIntellEvent {
  id: string;
  title: string;
  date: string; // e.g. "Aug 18, 2026"
  dayNumber: number; // e.g. 18
  time: string;
  category: EventCategory;
  status: "completed" | "upcoming";
  participants: string[];
  relatedCustomer: string;
  relatedDepartment: "Strategic Accounts" | "Enterprise Operations" | "Commercial Operations" | "Customer Operations";
  relatedWorkflow: string;
  relatedContract: string;
  previousMeetings: string[];
  relevantDocuments: string[];
  decisionRequired: string;
  businessImpact: string; // formatted currency value
  dependencies: string[];
  executiveBrief: {
    currentContractValue: string;
    revenueHistory: string;
    lastInteraction: string;
    openSupportIssues: number;
    renewalProbability: string;
    outstandingRisks: string;
    expansionOpportunity: string;
    recommendedDiscussionPoints: string[];
  };
  decisionCapture?: {
    decisionsMade: string[];
    actionItems: { task: string; owner: string; deadline: string }[];
    relatedWorkflows: string[];
    followUpDate: string;
  };
}

export const demoCalendarEvents: DecisionIntellEvent[] = [];
