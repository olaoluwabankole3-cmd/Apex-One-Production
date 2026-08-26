export interface UnifiedCustomer {
  id: string;
  name: string;
  businessUnit: "Enterprise Operations" | "Commercial Operations" | "Strategic Accounts" | "Customer Operations";
  tier: "Enterprise" | "Mid-Market" | "SMB";
  status: "active" | "at-risk" | "onboarding";
  healthScore: number;
  arrNaira: number; // in Millions Naira (e.g. 1200 = ₦1.2B)
  arrUSD: number; // in Millions USD
  ltvNaira: number; // in Millions Naira
  ltvUSD: number;
  since: string;
  owner: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  industry: string;
  growthYoY: number; // percentage
  engagementLevel: number; // percentage
  contractStatus: string;
  supportActivity: string;
  supportTickets: number;
  paymentBehavior: string;
  paymentStatus: "pristine" | "standard" | "delayed";
  riskLevel: string;
  riskScore: number; // 0 - 100
  expansionPotential: "High" | "Medium" | "Low";
  potentialArrNaira: number;
  opportunityNaira: number;
  opportunityReason: string;
  riskReasons: string[];
  aiInsight: string;
  recommendedAction: string;
  tags?: string[];
}

export const demoCustomers: UnifiedCustomer[] = [];

export interface RelationshipEvent {
  year: number;
  category: "sales" | "contracts" | "purchases" | "support" | "renewals" | "expansion" | "complaints" | "meetings";
  title: string;
  description: string;
}

export const demoRelationshipHistory: Record<string, RelationshipEvent[]> = {};
