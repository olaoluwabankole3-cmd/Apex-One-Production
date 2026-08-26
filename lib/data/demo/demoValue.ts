export type PipelineStatus = "discovered" | "validated" | "in_execution" | "pending" | "captured";

export interface DemoValueOpportunity {
  id: string;
  title: string;
  category: "Customer expansion" | "Dormant customers" | "Contract optimization" | "Revenue recovery" | "Process optimization" | "Capacity utilization";
  description: string;
  sourceSystem: string;
  valueAmount: number; // in Naira (e.g. 42300000 = ₦42.3M)
  status: PipelineStatus;
  confidence: number;
  probability: number;
  businessReason: string;
  recommendedAction: string;
  expectedOutcome: string;
  responsibleDepartment: string;
  expectedCaptureDate: string;
  impactTier: "High" | "Medium" | "Low";
  realizationSpeed: "Fastest" | "Medium" | "Long-Term";
  strategicImportance: "High" | "Medium" | "Low";
  risk: "Low" | "Medium" | "High";
  evidence: string;
}

export interface DemoLeakageSource {
  id: string;
  title: string;
  category: "Missed renewals" | "Billing errors" | "Underutilized contracts" | "SLA-related credits" | "Failed collections" | "Unbilled services" | "Pricing inconsistencies";
  estimatedValue: number; // in Naira
  rootCause: string;
  evidence: string;
  confidence: number;
  recoveryAction: string;
  expectedOutcome: string;
  systemAffected: string;
  status: "unplugged" | "monitoring" | "plugged";
  recovered: boolean;
  isRecovering?: boolean;
}

export interface DemoCustomerValueMetric {
  id: string;
  name: string;
  category: "High Value / High Potential" | "High Value / Low Risk" | "Low Value / High Potential" | "At Risk" | "Dormant";
  tier: "Enterprise" | "Mid-Market" | "SMB";
  currentRevenue: number;
  potentialValue: number;
  expansionPotential: number;
  renewalValue: number;
  lifetimeValue: number;
  unusedOpportunitiesValue: number;
  purchaseFrequency: string;
  contractHistory: string;
  interactionsCount: number;
  openSupportTickets: number;
  sentimentScore: number;
  renewalDaysRemaining: number;
  retentionProbability: number;
  riskIndex: number;
  usageGrowthPercentage: number;
  aiRecommendationText: string;
}

export interface DemoCapacityCategory {
  name: string;
  wasteValue: number;
  available: string;
  utilized: number;
  unused: number;
  submetrics: { label: string; value: string; percentage: number }[];
}

export interface DemoExecutionPlay {
  id: string;
  recommendation: string;
  owner: string;
  deadline: string;
  expectedValue: number;
  status: "Ready" | "Approved" | "In Progress" | "Completed" | "Measured";
  confidence: number;
  automationType: "Manual" | "AI-assisted" | "Automated" | "Awaiting approval";
  requiresHumanApproval: boolean;
  insightSource: string;
  decisionDetail: string;
  resultMetric: string;
  logs: string[];
}

export interface DemoCapturedValueEvent {
  id: string;
  opportunity: string;
  category: "Revenue recovered" | "Revenue generated" | "Cost avoided" | "Capacity recovered" | "Time saved";
  capturedValue: number;
  evidenceType: "Invoice Link" | "Contract Clause" | "Customer transaction log" | "Workflow completion" | "Before/after metric" | "Financial ledger record";
  evidenceDescription: string;
  originalEstimate: number;
  realizationDate: string;
  auditTrail: string[];
  verifiedBy: string;
}

export const demoValueOpportunities: DemoValueOpportunity[] = [];
export const demoLeakageSources: DemoLeakageSource[] = [];
export const demoCustomerValueMetrics: DemoCustomerValueMetric[] = [];
export const demoCapacityCategories: DemoCapacityCategory[] = [];
export const demoExecutionPlays: DemoExecutionPlay[] = [];
export const demoCapturedValueEvents: DemoCapturedValueEvent[] = [];
