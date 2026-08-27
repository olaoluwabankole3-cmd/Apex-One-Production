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
  industry?: string | null;
  growthYoY?: number | null; // percentage
  engagementLevel?: number | null; // percentage
  contractStatus?: string | null;
  supportActivity?: string | null;
  supportTickets?: number | null;
  paymentBehavior?: string | null;
  paymentStatus?: "pristine" | "standard" | "delayed" | null;
  riskLevel?: string | null;
  riskScore?: number | null; // 0 - 100
  expansionPotential?: "High" | "Medium" | "Low" | null;
  potentialArrNaira?: number | null;
  opportunityNaira?: number | null;
  opportunityReason?: string | null;
  riskReasons?: string[];
  aiInsight?: string | null;
  recommendedAction?: string | null;
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
