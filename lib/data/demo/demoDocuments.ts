export interface ExtractedEntities {
  customers: string[];
  contracts: string[];
  financialValues: string[];
  risks: string[];
  importantDates: string[];
  actions: string[];
  relatedDocs: string[];
}

export interface UsefulSummary {
  keyFinding: string;
  obligations: string[];
  risksDetail: string[];
  datesDetail: { event: string; date: string }[];
  financialExposure: string;
  recommendedAction: string;
}

export interface DocRelationships {
  relatedCustomer: { name: string; id: string };
  relatedContract: string;
  relatedWorkflow: string;
  relatedEmployee: string;
  relatedTransaction: string;
  relatedDecision: string;
}

export interface IntelDocument {
  id: string;
  name: string;
  fileType: "pdf" | "doc" | "xlsx";
  category: "Contract" | "Policy" | "Financial Document" | "Report" | "Compliance Document";
  businessUnit: "Enterprise Operations" | "Commercial Operations" | "Strategic Accounts" | "Customer Operations";
  uploadedBy: string;
  date: string;
  size: string;
  pages: number;
  status: "processed" | "processing";
  usefulSummary: UsefulSummary;
  entities: ExtractedEntities;
  relationships: DocRelationships;
}

export const demoDocuments: IntelDocument[] = [];
