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
  username?: string;
  name: string;
  title: string;
  avatarUrl?: string;
  status: "active" | "suspended" | "disabled" | "pending";
  passwordHash?: string;
  passwordSalt?: string;
  passwordChangeRequired?: boolean;
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
  subsidiary?: string | null;
  tier: "Enterprise" | "Mid-Market" | "SMB";
  status: "active" | "at-risk" | "onboarding" | "dormant";
  healthScore: number;
  arr: number;
  owner: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  since?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  industry?: string | null;
  growthYoY?: number | null;
  engagementLevel?: number | null;
  contractStatus?: string | null;
  supportActivity?: string | null;
  supportTickets?: number | null;
  paymentBehavior?: string | null;
  paymentStatus?: "pristine" | "standard" | "delayed" | null;
  riskLevel?: string | null;
  riskScore?: number | null;
  riskReason?: string | null;
  expansionPotential?: "High" | "Medium" | "Low" | null;
  potentialArrNaira?: number | null;
  opportunityNaira?: number | null;
  opportunityReason?: string | null;
  riskReasons?: string[];
  aiInsight?: string | null;
  recommendedAction?: string | null;
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
  /** Parser-policy version, not a canonical evidence-verification claim. */
  extractionPolicyVersion?: "source-grounded-v1";
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

// -------------------------------------------------------------
// REPOSITORY UPDATE CONTRACTS (IMMUTABLE FIELD DEFENSE)
// -------------------------------------------------------------
// These types strictly enforce that callers cannot attempt to mutate
// immutable persistence fields (id, organizationId, createdAt, etc.)
// at compile time.

export interface UpdateCustomerInput {
  name?: string;
  subsidiary?: string | null;
  tier?: "Enterprise" | "Mid-Market" | "SMB";
  status?: "active" | "at-risk" | "onboarding" | "dormant";
  healthScore?: number;
  arr?: number;
  owner?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  since?: string | null;
  tags?: string[];
  industry?: string | null;
  growthYoY?: number | null;
  engagementLevel?: number | null;
  contractStatus?: string | null;
  supportActivity?: string | null;
  supportTickets?: number | null;
  paymentBehavior?: string | null;
  paymentStatus?: "pristine" | "standard" | "delayed" | null;
  riskLevel?: string | null;
  riskScore?: number | null;
  riskReason?: string | null;
  expansionPotential?: "High" | "Medium" | "Low" | null;
  potentialArrNaira?: number | null;
  opportunityNaira?: number | null;
  opportunityReason?: string | null;
  riskReasons?: string[];
  aiInsight?: string | null;
  recommendedAction?: string | null;
}

export interface UpdateContractInput {
  customerId?: string;
  title?: string;
  contractValue?: number;
  startDate?: string;
  endDate?: string;
  renewalDaysRemaining?: number;
  status?: "active" | "expiring_soon" | "expired" | "renewed";
  slaCompliance?: number;
  volatilityIndexationClause?: boolean;
}

export interface UpdateTransactionInput {
  customerId?: string;
  type?: "revenue" | "cost" | "credit" | "reconciliation";
  amount?: number;
  currency?: string;
  status?: "cleared" | "pending" | "failed" | "disputed";
  reference?: string;
  category?: string;
  date?: string;
}

export interface UpdateSignalInput {
  category?: "revenue" | "customer" | "operation" | "capacity" | "compliance";
  severity?: "critical" | "high" | "medium" | "low";
  title?: string;
  description?: string;
  evidence?: string;
  estimatedFinancialImpact?: number;
  status?: "active" | "investigating" | "resolved";
}

export interface UpdateValueOpportunityInput {
  title?: string;
  category?: "Customer expansion" | "Dormant customers" | "Contract optimization" | "Revenue recovery" | "Process optimization" | "Capacity utilization";
  potentialValue?: number;
  confidence?: number;
  evidence?: string;
  sourceEntityId?: string;
  sourceEntityType?: "Contract" | "Customer" | "Signal" | "Transaction" | "Operation";
  recommendedAction?: string;
  expectedOutcome?: string;
  realizationSpeed?: "Fastest" | "Medium" | "Long-Term";
  strategicImportance?: "High" | "Medium" | "Low";
  risk?: "Low" | "Medium" | "High";
  status?: "Identified" | "Validated" | "Approved" | "Executing" | "Captured";
}

export interface UpdateValueCapturedInput {
  opportunityId?: string;
  opportunityTitle?: string;
  category?: "Revenue recovered" | "Revenue generated" | "Cost avoided" | "Capacity recovered" | "Time saved";
  capturedValue?: number;
  evidenceType?: string;
  evidenceDescription?: string;
  realizationDate?: string;
  certifiedBy?: string;
  auditTrail?: string[];
}

export interface UpdateOrganizationalMemoryInput {
  type?: "fact" | "history" | "decision" | "insight" | "policy";
  title?: string;
  content?: string;
  source?: string;
  sourceReference?: string;
  confidence?: number;
  effectiveAt?: string;
  verified?: boolean;
}

export interface UpdateActionInput {
  recommendation?: string;
  owner?: string;
  deadline?: string;
  expectedValue?: number;
  status?: "Ready" | "Approved" | "In Progress" | "Completed" | "Measured";
  confidence?: number;
  automationType?: "Manual" | "AI-assisted" | "Automated" | "Awaiting approval";
  requiresHumanApproval?: boolean;
  insightSource?: string;
  decisionDetail?: string;
  resultMetric?: string;
  approvedBy?: string;
  logs?: string[];
}

export interface UpdateDocumentInput {
  customerId?: string;
  name?: string;
  fileType?: DocumentFileType;
  category?: "Contract" | "Invoice" | "SLA Agreement" | "Audit Report" | "Board Paper" | "Compliance Document" | "Other";
  size?: string;
  uploadedBy?: string;
  storageKey?: string;
  status?: DocumentProcessingStatus;
  metadata?: DocumentMetadata;
  aiSummary?: string;
  extractedFields?: DocumentExtractionField[];
  tags?: string[];
}

export interface UpdateKnowledgeItemInput {
  title?: string;
  category?: KnowledgeCategory;
  content?: string;
  summary?: string;
  author?: string;
  sourceDocId?: string;
  embeddingRef?: string;
  tags?: string[];
  isPublicPlatformKnowledge?: boolean;
  version?: number;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  subsidiary?: string;
  status?: WorkflowStatus;
  version?: number;
  nodes?: WorkflowNode[];
  connections?: WorkflowConnection[];
  runsCount?: number;
  successRate?: number;
}

export interface UpdateWorkflowRunInput {
  workflowId?: string;
  workflowVersion?: number;
  triggeredBy?: string;
  triggerType?: "manual" | "event" | "schedule" | "signal";
  status?: WorkflowRunStatus;
  steps?: WorkflowRunStepRecord[];
  contextData?: Record<string, unknown>;
  completedAt?: string;
}



/**
 * Initial banking-operations case intake. This is an unverified work item,
 * never a validated reconciliation, regulatory finding or recovery.
 * Future cross-department access/approval must not be inferred from this type.
 */
/** Bank-controlled, append-only-at-service-boundary case chronology. */
export interface BankingCaseTimelineEvent {
  id: string;
  type: "created" | "handed_off" | "evidence_linked" | "decision_proposed" | "decision_reviewed";
  actorUserId: string;
  occurredAt: string;
  note: string;
  revision: number;
  reference?: { kind: "Document" | "ValueOpportunity"; id: string };
}

export interface BankingCaseEvidenceLink {
  id: string;
  sourceType: "Document" | "ValueOpportunity";
  sourceId: string;
  note: string;
  addedByUserId: string;
  addedAt: string;
}

/** Approval of an internal investigation plan only; never authorization of funds. */
export interface BankingCaseDecision {
  id: string;
  state: "pending" | "approved" | "rejected";
  disposition: "continue_investigation" | "request_source_review" | "escalate_for_control_review";
  rationale: string;
  proposedByUserId: string;
  proposedAt: string;
  evidenceLinkIds: string[];
  reviewedByUserId?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface BankingPreviewOrigin {
  batchId: string;
  candidateId: string;
  comparisonStatus: "amount_discrepancy" | "currency_mismatch" | "missing_expected" | "missing_observed" | "insufficient_source_coverage" | "ambiguous";
  sourceStored: false;
  coverageVerified: false;
  financialLossAssessed: false;
}

export interface BankingCaseRecord {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  department: "Operations" | "Finance";
  priority: "normal" | "high";
  status: "open";
  evidenceState: "unverified";
  sourceType?: "Document" | "ValueOpportunity";
  sourceId?: string;
  createdByUserId: string;
  ownerUserId: string;
  /** Optimistic revision of case ownership state; historical cases default to 1. */
  revision?: number;
  lastHandoffAt?: string;
  timeline?: BankingCaseTimelineEvent[];
  evidenceLinks?: BankingCaseEvidenceLink[];
  decision?: BankingCaseDecision;
  previewOrigin?: BankingPreviewOrigin;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pilot financial-source intake registry. A two-person approval authorizes
 * internal synthetic intake only; it does NOT authenticate a bank or prove
 * provider custody, object immutability, source completeness or financial loss.
 */
export interface FinancialSourceRegistryRecord {
  id: string;
  organizationId: string;
  sourceLabel: string;
  kind: "settlement" | "fee";
  role: "expected" | "observed";
  status: "pending" | "approved" | "rejected" | "revoked";
  createdByUserId: string;
  createdAt: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
  reviewReason?: string;
  revision: number;
  updatedAt: string;
  externalSourceAuthorityVerified: false;
  revokedAt?: string;
  revokedByUserId?: string;
  revocationReason?: string;
  /** The second admin approves the exact verifier key fingerprint, not external bank identity. */
  signingKey?: {
    keyId: string;
    ed25519PublicKeySpkiDerBase64: string;
    keyFingerprintSha256: string;
    bankKeyOwnershipIndependentlyVerified: false;
  };
}

/**
 * Internal attestation DOSSIER: proves only private-key possession, not
 * independent ownership by a bank or processor. No live-data authorization.
 * The proof challenge nonce is stored as SHA-256, never as plaintext.
 */
export interface FinancialSignerOnboardingRecord {
  id: string;
  organizationId: string;
  sourceRegistryId: string;
  keyId: string;
  keyFingerprintSha256: string;
  requestedByUserId: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  status: "challenge_pending" | "proof_verified" | "reviewed" | "rejected";
  challengeNonceSha256: string;
  challengeExpiresAt: string;
  challengeIssuedAt: string;
  proofVerifiedAt?: string;
  proofSubmittedByUserId?: string;
  proofSignatureSha256?: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
  reviewReason?: string;
  /** Opaque reference and digest, not a pasted document or claim of authenticity. */
  externalEvidenceRef?: string;
  externalEvidenceSha256?: string;
  bankKeyOwnershipIndependentlyVerified: false;
  externalAuthorityApprovalVerified: false;
  sourceAuthenticityVerified: false;
}

export interface FinancialSourceSnapshotRecord {
  id: string;
  organizationId: string;
  sourceRegistryId: string;
  kind: "settlement" | "fee";
  role: "expected" | "observed";
  sourceId: string;
  expectedSha256: string;
  expectedBytes: number;
  rowCount: number;
  recordedByUserId: string;
  createdAt: string;
  encryption: "AES-256-GCM" | "none";
  byteIntegrityCheckedAtIntake: true;
  /** S3-assigned version; absent on unversioned buckets and non-S3 tests. */
  storageVersionId?: string;
  storageImmutabilityVerified: false;
  sourceAuthenticityVerified: false;
  coverageVerified: false;
  financialLossAssessed: false;
}


/** Recovery-journal metadata only: NEVER persist raw financial transaction data. */
export interface FinancialSourceImportRecord {
  id: string;
  organizationId: string;
  sourceRegistryId: string;
  idempotencyKeySha256: string;
  sourceId: string;
  snapshotId: string;
  kind: "settlement" | "fee";
  role: "expected" | "observed";
  expectedSha256: string;
  expectedBytes: number;
  rowCount: number;
  initiatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  state: "prepared" | "uploading" | "stored" | "committed" | "quarantined";
  storageVersionId?: string;
  manifestFingerprintSha256: string;
  signingKeyFingerprintSha256: string;
  quarantineCode?: "upload_interrupted" | "storage_verification_failed" | "source_policy_changed";
  /** No external source authority, financial loss or completeness is inferred. */
  sourceAuthenticityVerified: false;
  coverageVerified: false;
  financialLossAssessed: false;
}
