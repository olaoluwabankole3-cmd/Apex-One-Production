/**
 * APEX ONE — Domain Entities & Database Schema Types
 * 
 * Strict, type-safe entity definitions for all core domains.
 */

export interface OrganizationRecord {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  industry: string;
  plan: "standard" | "enterprise";
  currency: string;
  currencySymbol: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  title: string;
  avatarUrl?: string;
  status: "active" | "suspended" | "disabled" | "pending";
  passwordHash?: string;
  passwordSalt?: string;
  createdAt: string;
}

export interface OrganizationMembershipRecord {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  department?: string;
  joinedAt: string;
}

export interface CustomerRecord {
  id: string;
  organizationId: string;
  name: string;
  subsidiary: string;
  tier: "Enterprise" | "Mid-Market" | "SMB";
  status: "active" | "at-risk" | "onboarding" | "dormant";
  healthScore: number;
  arr: number;
  owner: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  since: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContractRecord {
  id: string;
  organizationId: string;
  customerId: string;
  title: string;
  contractValue: number;
  startDate: string;
  endDate: string;
  renewalDaysRemaining: number;
  status: "active" | "expiring_soon" | "expired" | "renewed";
  slaCompliance: number;
  volatilityIndexationClause: boolean;
  createdAt: string;
}

export interface TransactionRecord {
  id: string;
  organizationId: string;
  customerId: string;
  type: "revenue" | "cost" | "credit" | "reconciliation";
  amount: number;
  currency: string;
  status: "cleared" | "pending" | "failed" | "disputed";
  reference: string;
  category: string;
  date: string;
  createdAt: string;
}

// -------------------------------------------------------------
// DOCUMENT DOMAIN SCHEMA
// -------------------------------------------------------------

export type DocumentProcessingStatus = "uploading" | "processing" | "indexed" | "failed" | "archived";
export type DocumentFileType = "pdf" | "doc" | "docx" | "xlsx" | "csv" | "image" | "json";

export interface DocumentExtractionField {
  label: string;
  value: string;
  confidence: number;
  sourceLocation?: string;
}

export interface DocumentMetadata {
  pageCount?: number;
  fileSizeBytes: number;
  mimeType: string;
  checksumSha256?: string;
  storageUri: string;
  extractedAt?: string;
  indexRef?: string;
}

export interface DocumentRecord {
  id: string;
  organizationId: string;
  customerId?: string;
  name: string;
  fileType: DocumentFileType;
  category: "Contract" | "Invoice" | "SLA Agreement" | "Audit Report" | "Board Paper" | "Compliance Document" | "Other";
  size: string;
  uploadedBy: string;
  storageKey: string;
  status: DocumentProcessingStatus;
  metadata: DocumentMetadata;
  aiSummary?: string;
  extractedFields: DocumentExtractionField[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// KNOWLEDGE HUB DOMAIN SCHEMA
// -------------------------------------------------------------

export type KnowledgeCategory =
  | "Playbook"
  | "Policy"
  | "Onboarding"
  | "Product"
  | "Financial Regulation"
  | "Engineering Standard"
  | "Treasury Guideline";

export interface KnowledgeItemRecord {
  id: string;
  organizationId: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  summary?: string;
  author: string;
  sourceDocId?: string;
  embeddingRef?: string;
  tags: string[];
  isPublicPlatformKnowledge?: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// WORKFLOW DOMAIN SCHEMA
// -------------------------------------------------------------

export type WorkflowNodeType =
  | "trigger"
  | "condition"
  | "ai_agent"
  | "action"
  | "integration"
  | "human_approval"
  | "notification";

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  title: string;
  description?: string;
  configuration: Record<string, string | number | boolean | string[]>;
  position?: { x: number; y: number };
}

export interface WorkflowConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  conditionLabel?: string;
}

export type WorkflowStatus = "active" | "draft" | "paused" | "archived";

export interface WorkflowRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  subsidiary: string;
  status: WorkflowStatus;
  version: number;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  runsCount: number;
  successRate: number;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowRunStatus = "pending" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled";

export interface WorkflowRunStepRecord {
  stepId: string;
  nodeId: string;
  nodeTitle: string;
  status: "pending" | "executing" | "completed" | "failed" | "skipped";
  output?: Record<string, unknown>;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export interface WorkflowRunRecord {
  id: string;
  organizationId: string;
  workflowId: string;
  workflowVersion: number;
  triggeredBy: string;
  triggerType: "manual" | "event" | "schedule" | "signal";
  status: WorkflowRunStatus;
  steps: WorkflowRunStepRecord[];
  contextData: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
}

// -------------------------------------------------------------
// ORGANIZATIONAL MEMORY SCHEMA
// -------------------------------------------------------------

export interface OrganizationalMemoryRecord {
  id: string;
  organizationId: string;
  type: "fact" | "history" | "decision" | "insight" | "policy";
  title: string;
  content: string;
  source: string;
  sourceReference: string;
  confidence: number;
  effectiveAt: string;
  verified: boolean;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  organizationId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actor: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface SignalRecord {
  id: string;
  organizationId: string;
  category: "revenue" | "customer" | "operation" | "capacity" | "compliance";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  evidence: string;
  estimatedFinancialImpact: number;
  status: "active" | "investigating" | "resolved";
  detectedAt: string;
}

// -------------------------------------------------------------
// VALUE INTELLIGENCE SCHEMA
// -------------------------------------------------------------

export interface ValueOpportunityRecord {
  id: string;
  organizationId: string;
  title: string;
  category: "Customer expansion" | "Dormant customers" | "Contract optimization" | "Revenue recovery" | "Process optimization" | "Capacity utilization";
  potentialValue: number;
  confidence: number;
  evidence: string;
  sourceEntityId?: string;
  sourceEntityType?: "Contract" | "Customer" | "Signal" | "Transaction" | "Operation";
  recommendedAction: string;
  expectedOutcome: string;
  realizationSpeed: "Fastest" | "Medium" | "Long-Term";
  strategicImportance: "High" | "Medium" | "Low";
  risk: "Low" | "Medium" | "High";
  status: "Identified" | "Validated" | "Approved" | "Executing" | "Captured";
  createdAt: string;
  updatedAt: string;
}

export interface ValueCapturedRecord {
  id: string;
  organizationId: string;
  opportunityId?: string;
  opportunityTitle: string;
  category: "Revenue recovered" | "Revenue generated" | "Cost avoided" | "Capacity recovered" | "Time saved";
  capturedValue: number;
  evidenceType: string;
  evidenceDescription: string;
  realizationDate: string;
  certifiedBy: string;
  auditTrail: string[];
  createdAt: string;
}

// -------------------------------------------------------------
// EXECUTION ACTIONS SCHEMA
// -------------------------------------------------------------

export interface ActionRecord {
  id: string;
  organizationId: string;
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
  approvedBy?: string;
  logs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  organizationId: string;
  actorId: string;
  actorEmail: string;
  action: string;
  resource: string;
  resourceId: string;
  requestId: string;
  status: "success" | "denied" | "error";
  metadata?: Record<string, unknown>;
  timestamp: string;
}
