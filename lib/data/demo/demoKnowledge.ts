export type InstitutionalCategory =
  | "Policies"
  | "Playbooks"
  | "Contracts"
  | "Customer Knowledge"
  | "Operations"
  | "Compliance"
  | "Strategy"
  | "Decisions"
  | "Historical Intelligence";

export interface KnowledgeSynapse {
  id: string;
  title: string;
  category: InstitutionalCategory;
  excerpt: string;
  content: string[];
  author: string;
  date: string;
  readTime: number;
  pinned?: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "Customer" | "Contract" | "Meeting" | "Support" | "Renewal" | "Decision" | "Revenue" | "Policy";
  details: string;
  connections: string[];
}

export interface HistoricalEvent {
  year: string;
  title: string;
  category: string;
  description: string;
  evidence: string;
  impactValue: string;
}

export const demoSynapses: KnowledgeSynapse[] = [];
export const demoGraphNodes: GraphNode[] = [];
export const demoHistoricalEvents: HistoricalEvent[] = [];
