export type Role =
  | "CEO"
  | "Operations"
  | "Relationship Manager"
  | "Compliance"
  | "Customer Service"
  | "Customer / Investor";

export const ALL_ROLES: Role[] = [
  "CEO",
  "Operations",
  "Relationship Manager",
  "Compliance",
  "Customer Service",
  "Customer / Investor",
];


export interface KpiDatum {
  id: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  delta: number;
  deltaLabel: string;
  trend: "up" | "down" | "flat";
  sparkline: number[];
  roles: Role[];
}

export interface RevenuePoint {
  month: string;
  revenue: number;
  target: number;
}

export interface PortfolioSlice {
  name: string;
  value: number;
  color: string;
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  type: "deal" | "risk" | "compliance" | "system" | "customer";
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  roles: Role[];
}

export type RichContentType = "performance-stats" | "executive-report" | "at-risk-customers";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  richContent?: RichContentType;
  animate?: boolean;
}

export interface SuggestedPrompt {
  id: string;
  label: string;
  prompt?: string;
  roles: Role[];
}

export interface AtRiskCustomer {
  id: string;
  name: string;
  subsidiary: string;
  arr: number;
  riskScore: number;
  reason: string;
}

export interface ReportSection {
  id: string;
  title: string;
  summary: string;
}

// ── Customer Relationship Workspace ─────────────────────────────────────

export type CustomerStatus = "active" | "at-risk" | "onboarding";
export type CustomerTier = "Enterprise" | "Mid-Market" | "SMB";

export interface Customer {
  id: string;
  name: string;
  subsidiary: string;
  tier: CustomerTier;
  status: CustomerStatus;
  healthScore: number;
  arr: number;
  owner: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  since: string;
  tags: string[];
}

export interface TimelineEvent {
  id: string;
  customerId: string;
  type: "deal" | "meeting" | "note" | "support" | "system";
  title: string;
  description: string;
  date: string;
  actor: string;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  author: string;
  content: string;
  date: string;
  pinned?: boolean;
}

export interface CustomerTask {
  id: string;
  customerId: string;
  title: string;
  dueDate: string;
  done: boolean;
  assignee: string;
  priority: "high" | "medium" | "low";
}

export interface CustomerMeeting {
  id: string;
  customerId: string;
  title: string;
  date: string;
  time: string;
  attendees: string[];
  status: "upcoming" | "completed";
  notes?: string;
}

export interface CustomerFile {
  id: string;
  customerId: string;
  name: string;
  type: "pdf" | "doc" | "xlsx" | "image";
  size: string;
  uploadedBy: string;
  date: string;
}

// ── Operations ───────────────────────────────────────────────────────────

export type ReconciliationStatus = "complete" | "pending" | "delayed";

export interface SubsidiaryOps {
  subsidiary: string;
  slaCompliance: number;
  reconciliationStatus: ReconciliationStatus;
  openIncidents: number;
  avgResolutionHours: number;
  automationCoverage: number;
  trend: number[];
}

export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "open" | "investigating" | "resolved";

export interface Incident {
  id: string;
  subsidiary: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  opened: string;
  owner: string;
}

export interface AutomationOpportunity {
  id: string;
  subsidiary: string;
  process: string;
  description: string;
  impact: string;
  effort: "low" | "medium" | "high";
}

export interface SlaTrendPoint {
  month: string;
  compliance: number;
  target: number;
}

export type SlaPoint = SlaTrendPoint;


// ── Document Intelligence ────────────────────────────────────────────────

export type DocumentCategory = "Contract" | "Financial Statement" | "Compliance Filing" | "Claims Report";
export type DocumentFileType = "pdf" | "doc" | "xlsx";
export type DocumentStatus = "processing" | "processed";

export interface ExtractedField {
  label: string;
  value: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  fileType: DocumentFileType;
  category: DocumentCategory;
  subsidiary: string;
  uploadedBy: string;
  date: string;
  size: string;
  pages: number;
  status: DocumentStatus;
  aiSummary: string;
  extractedFields: ExtractedField[];
  suggestedQuestions: string[];
}

// ── Analytics ────────────────────────────────────────────────────────────

export interface RevenueBySubsidiaryPoint {
  month: string;
  enterpriseOps: number;
  commercialOps: number;
  strategicAccounts: number;
  customerOps: number;
}

export interface SubsidiaryRevenuePoint {
  name: string;
  revenue: number;
  target: number;
  margin: number;
}

export interface CustomerGrowthPoint {
  month: string;
  customers: number;
}

export interface SubsidiaryPerformance {
  subsidiary: string;
  portfolioValue: number;
  customers: number;
  growthPct: number;
  slaCompliance: number;
}

export type SubsidiaryPerformanceItem = SubsidiaryPerformance;


export interface SegmentBreakdown {
  segment: "Enterprise" | "Mid-Market" | "SMB";
  arr: number;
  customers: number;
  color: string;
}

export type TimeRange = "30D" | "90D" | "YTD" | "12M";

// ── Workflow Builder ─────────────────────────────────────────────────────

export type WorkflowNodeType =
  | "trigger"
  | "action"
  | "condition"
  | "ai"
  | "delay"
  | "integration"
  | "ai_analyze"
  | "ai_classify"
  | "ai_predict"
  | "ai_recommend"
  | "ai_generate"
  | "ai_decide_approval"
  | "context";
export type WorkflowNodeStatus = "idle" | "running" | "success" | "skipped";
export type WorkflowStatus = "active" | "draft" | "paused";

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  subtitle: string;
  x: number;
  y: number;
}

export interface WorkflowConnection {
  id: string;
  from: string;
  to: string;
  branchLabel?: string;
}

export interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  subsidiary: string;
  status: WorkflowStatus;
  successRate: number;
  runsPerWeek: number;
  lastRun: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

// ── Notifications ────────────────────────────────────────────────────────

export type NotificationType = "alert" | "mention" | "workflow" | "system" | "action" | "info" | "urgent";
export type NotificationSeverity = "critical" | "warning" | "info" | "success";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  description: string;
  time: string;
  timestamp?: string;
  read: boolean;
  source: string;
  subsidiary?: string;
  actionUrl?: string;
}

// ── Calendar ─────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  type: "meeting" | "renewal" | "workflow" | "review" | "board" | "client" | "operational";
  attendees: string[];
  participants?: string[];
  aiSummary?: string;
  subsidiary?: string;
}

// ── Knowledge Hub ────────────────────────────────────────────────────────

export type ArticleCategory = "Playbook" | "Policy" | "Onboarding" | "Product";

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: ArticleCategory;
  excerpt: string;
  content: string[];
  author: string;
  date: string;
  readTime: number;
  pinned?: boolean;
}

// ── Settings ─────────────────────────────────────────────────────────────

export interface IntegrationItem {
  id: string;
  name: string;
  description?: string;
  connected?: boolean;
  status?: "connected" | "disconnected" | "syncing" | "error";
  category: string;
  lastSync?: string;
  eventsToday?: number;
  icon?: string;
}
