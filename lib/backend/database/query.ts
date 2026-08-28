/**
 * APEX ONE — Centralized Query, Pagination, Filtering & Sorting Contracts
 * 
 * Defines centralized constants, type-safe query options, sort whitelists,
 * and structured filter interfaces across all domain repositories.
 */

import { ValidationError } from "../core/errors";

// ============================================================================
// 1. CENTRALIZED PAGINATION & QUERY LIMITS
// ============================================================================

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export type SortDirection = "asc" | "desc";

export interface SortOptions<TSortField extends string = string> {
  field: TSortField;
  direction?: SortDirection;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface CollectionQuery<TFilter = unknown, TSortField extends string = string> {
  filter?: TFilter;
  sort?: SortOptions<TSortField>;
  limit?: number;
  offset?: number;
}

/**
 * Normalizes an incoming query limit value.
 * - If undefined or null, returns DEFAULT_PAGE_SIZE (50).
 * - Normalizes negative limits, zero, NaN to DEFAULT_PAGE_SIZE.
 * - Caps Infinity or values exceeding MAX_PAGE_SIZE (100) to MAX_PAGE_SIZE.
 * - Floors non-integer numbers to valid whole integers.
 */
export function normalizeQueryLimit(
  limit: unknown,
  options?: { strict?: boolean; defaultSize?: number; maxSize?: number; fieldName?: string }
): number {
  const defaultSize = options?.defaultSize ?? DEFAULT_PAGE_SIZE;
  const maxSize = options?.maxSize ?? MAX_PAGE_SIZE;
  const fieldName = options?.fieldName ?? "limit";

  if (limit === undefined || limit === null || limit === "") {
    return defaultSize;
  }

  let num: number;
  if (typeof limit === "number") {
    num = limit;
  } else if (typeof limit === "string") {
    const trimmed = limit.trim();
    num = Number(trimmed);
  } else {
    if (options?.strict) {
      throw new ValidationError(`Field '${fieldName}' must be a valid integer number`);
    }
    return defaultSize;
  }

  if (isNaN(num)) {
    if (options?.strict) {
      throw new ValidationError(`Field '${fieldName}' must be a valid finite number`);
    }
    return defaultSize;
  }

  if (!Number.isFinite(num)) {
    if (num > 0) {
      return maxSize;
    }
    return defaultSize;
  }

  const floored = Math.floor(num);

  if (floored <= 0) {
    if (options?.strict) {
      throw new ValidationError(`Field '${fieldName}' must be a positive integer greater than 0, received ${num}`);
    }
    return defaultSize;
  }

  if (floored > maxSize) {
    if (options?.strict) {
      throw new ValidationError(`Field '${fieldName}' cannot exceed maximum allowed page size of ${maxSize}, received ${num}`);
    }
    return maxSize;
  }

  return floored;
}

/**
 * Normalizes an incoming query offset / skip value.
 */
export function normalizeQueryOffset(
  offset: unknown,
  options?: { strict?: boolean; fieldName?: string }
): number {
  const fieldName = options?.fieldName ?? "offset";

  if (offset === undefined || offset === null || offset === "") {
    return 0;
  }

  let num: number;
  if (typeof offset === "number") {
    num = offset;
  } else if (typeof offset === "string") {
    const trimmed = offset.trim();
    num = Number(trimmed);
  } else {
    if (options?.strict) {
      throw new ValidationError(`Field '${fieldName}' must be a valid non-negative integer`);
    }
    return 0;
  }

  if (isNaN(num) || !Number.isFinite(num)) {
    if (options?.strict) {
      throw new ValidationError(`Field '${fieldName}' must be a valid finite number`);
    }
    return 0;
  }

  const floored = Math.floor(num);

  if (floored < 0) {
    if (options?.strict) {
      throw new ValidationError(`Field '${fieldName}' must be a non-negative integer, received ${num}`);
    }
    return 0;
  }

  return floored;
}

/**
 * Validates sort options against a domain whitelist of allowed fields.
 * Strictly forbids arbitrary database column names, SQL fragments, prototype pollution, or unwhitelisted strings.
 */
export function validateSortOptions<T extends string>(
  sort: unknown,
  allowedFields?: readonly T[],
  options?: { strict?: boolean; fieldName?: string }
): SortOptions<T> | undefined {
  if (sort === undefined || sort === null) {
    return undefined;
  }

  const fieldName = options?.fieldName ?? "sort";

  if (typeof sort !== "object" || Array.isArray(sort)) {
    if (options?.strict) {
      throw new ValidationError(`Field '${fieldName}' must be a sort configuration object`);
    }
    return undefined;
  }

  const candidate = sort as Record<string, unknown>;

  if (typeof candidate.field !== "string" || candidate.field.trim().length === 0) {
    if (options?.strict) {
      throw new ValidationError(`Sort field must be a non-empty string`);
    }
    return undefined;
  }

  const requestedField = candidate.field.trim();

  // If no whitelist is provided or field is not in whitelist, reject safely
  if (!allowedFields || !Array.isArray(allowedFields) || !allowedFields.includes(requestedField as T)) {
    if (options?.strict) {
      throw new ValidationError(
        `Unsupported sort field '${requestedField}'. Allowed sort fields: [${(allowedFields || []).join(", ")}]`
      );
    }
    return undefined;
  }

  let direction: SortDirection = "asc";
  if (candidate.direction !== undefined && candidate.direction !== null) {
    const dirStr = String(candidate.direction).trim().toLowerCase();
    if (dirStr === "desc") {
      direction = "desc";
    } else {
      direction = "asc";
    }
  }

  return {
    field: requestedField as T,
    direction,
  };
}

// ============================================================================
// 2. DOMAIN SORT WHITELISTS & TYPES
// ============================================================================

export const CUSTOMER_SORT_FIELDS = [
  "name",
  "arr",
  "healthScore",
  "tier",
  "status",
  "since",
  "createdAt",
  "updatedAt",
] as const;
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];

export const CONTRACT_SORT_FIELDS = [
  "title",
  "contractValue",
  "startDate",
  "endDate",
  "renewalDaysRemaining",
  "slaCompliance",
  "status",
  "createdAt",
] as const;
export type ContractSortField = (typeof CONTRACT_SORT_FIELDS)[number];

export const TRANSACTION_SORT_FIELDS = [
  "amount",
  "date",
  "createdAt",
  "type",
  "status",
  "currency",
  "reference",
] as const;
export type TransactionSortField = (typeof TRANSACTION_SORT_FIELDS)[number];

export const SIGNAL_SORT_FIELDS = [
  "detectedAt",
  "estimatedFinancialImpact",
  "severity",
  "category",
  "status",
  "title",
] as const;
export type SignalSortField = (typeof SIGNAL_SORT_FIELDS)[number];

export const VALUE_OPPORTUNITY_SORT_FIELDS = [
  "potentialValue",
  "confidence",
  "createdAt",
  "updatedAt",
  "title",
  "category",
  "status",
] as const;
export type ValueOpportunitySortField = (typeof VALUE_OPPORTUNITY_SORT_FIELDS)[number];

export const VALUE_CAPTURED_SORT_FIELDS = [
  "capturedValue",
  "realizationDate",
  "createdAt",
  "category",
  "opportunityTitle",
] as const;
export type ValueCapturedSortField = (typeof VALUE_CAPTURED_SORT_FIELDS)[number];

export const ORGANIZATIONAL_MEMORY_SORT_FIELDS = [
  "title",
  "type",
  "confidence",
  "effectiveAt",
  "createdAt",
] as const;
export type OrganizationalMemorySortField = (typeof ORGANIZATIONAL_MEMORY_SORT_FIELDS)[number];

export const ACTION_SORT_FIELDS = [
  "deadline",
  "expectedValue",
  "confidence",
  "status",
  "createdAt",
  "updatedAt",
  "recommendation",
] as const;
export type ActionSortField = (typeof ACTION_SORT_FIELDS)[number];

export const DOCUMENT_SORT_FIELDS = [
  "name",
  "category",
  "status",
  "createdAt",
  "updatedAt",
  "fileType",
  "size",
] as const;
export type DocumentSortField = (typeof DOCUMENT_SORT_FIELDS)[number];

export const KNOWLEDGE_SORT_FIELDS = [
  "title",
  "category",
  "version",
  "createdAt",
  "updatedAt",
] as const;
export type KnowledgeSortField = (typeof KNOWLEDGE_SORT_FIELDS)[number];

export const WORKFLOW_SORT_FIELDS = [
  "name",
  "status",
  "version",
  "runsCount",
  "successRate",
  "createdAt",
  "updatedAt",
] as const;
export type WorkflowSortField = (typeof WORKFLOW_SORT_FIELDS)[number];

export const WORKFLOW_RUN_SORT_FIELDS = [
  "startedAt",
  "completedAt",
  "status",
  "workflowVersion",
] as const;
export type WorkflowRunSortField = (typeof WORKFLOW_RUN_SORT_FIELDS)[number];

export const AUDIT_LOG_SORT_FIELDS = [
  "timestamp",
  "action",
  "resource",
  "status",
] as const;
export type AuditLogSortField = (typeof AUDIT_LOG_SORT_FIELDS)[number];

// ============================================================================
// 3. STRUCTURED DOMAIN QUERY FILTERS (NO `any`, NO FUNCTION PREDICATES)
// ============================================================================

export interface CustomerQueryFilter {
  tier?: "Enterprise" | "Mid-Market" | "SMB" | "all";
  status?: "active" | "at-risk" | "onboarding" | "dormant" | "all";
  contactEmail?: string;
  industry?: string;
  owner?: string;
  subsidiary?: string;
  minHealthScore?: number;
  maxHealthScore?: number;
  minArr?: number;
  maxArr?: number;
  search?: string;
  tags?: string[];
}

export interface ContractQueryFilter {
  customerId?: string;
  status?: "active" | "expiring_soon" | "expired" | "renewed" | "all";
  maxRenewalDays?: number;
  minContractValue?: number;
  maxContractValue?: number;
  volatilityIndexationClause?: boolean;
  search?: string;
}

export interface TransactionQueryFilter {
  customerId?: string;
  type?: "revenue" | "cost" | "credit" | "reconciliation" | "all";
  status?: "cleared" | "pending" | "failed" | "disputed" | "all";
  currency?: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

export interface SignalQueryFilter {
  category?: "revenue" | "customer" | "operation" | "capacity" | "compliance" | "all";
  severity?: "critical" | "high" | "medium" | "low" | "all";
  status?: "active" | "investigating" | "resolved" | "all";
  minImpact?: number;
  search?: string;
}

export interface ValueOpportunityQueryFilter {
  category?:
    | "Customer expansion"
    | "Dormant customers"
    | "Contract optimization"
    | "Revenue recovery"
    | "Process optimization"
    | "Capacity utilization"
    | "all";
  status?: "Identified" | "Validated" | "Approved" | "Executing" | "Captured" | "all";
  sourceEntityType?: "Contract" | "Customer" | "Signal" | "Transaction" | "Operation";
  sourceEntityId?: string;
  realizationSpeed?: "Fastest" | "Medium" | "Long-Term";
  strategicImportance?: "High" | "Medium" | "Low";
  minPotentialValue?: number;
  search?: string;
}

export interface ValueCapturedQueryFilter {
  opportunityId?: string;
  category?: "Revenue recovered" | "Revenue generated" | "Cost avoided" | "Capacity recovered" | "Time saved" | "all";
  evidenceType?: string;
  certifiedBy?: string;
  search?: string;
}

export interface OrganizationalMemoryQueryFilter {
  type?: "fact" | "history" | "decision" | "insight" | "policy" | "all";
  source?: string;
  verified?: boolean;
  keywords?: string[];
  search?: string;
}

export interface ActionQueryFilter {
  status?: "Ready" | "Approved" | "In Progress" | "Completed" | "Measured" | "all";
  automationType?: "Manual" | "AI-assisted" | "Automated" | "Awaiting approval" | "all";
  owner?: string;
  requiresHumanApproval?: boolean;
  search?: string;
}

export interface DocumentQueryFilter {
  customerId?: string;
  category?: "Contract" | "Invoice" | "SLA Agreement" | "Audit Report" | "Board Paper" | "Compliance Document" | "Other" | "all";
  status?: "uploading" | "processing" | "indexed" | "failed" | "archived" | "all";
  fileType?: "pdf" | "doc" | "docx" | "xlsx" | "csv" | "image" | "json" | "all";
  uploadedBy?: string;
  tags?: string[];
  search?: string;
}

export interface KnowledgeQueryFilter {
  category?:
    | "Playbook"
    | "Policy"
    | "Onboarding"
    | "Product"
    | "Financial Regulation"
    | "Engineering Standard"
    | "Treasury Guideline"
    | "all";
  sourceDocId?: string;
  author?: string;
  tags?: string[];
  isPublicPlatformKnowledge?: boolean;
  search?: string;
}

export interface WorkflowQueryFilter {
  status?: "active" | "draft" | "paused" | "archived" | "all";
  subsidiary?: string;
  search?: string;
}

export interface WorkflowRunQueryFilter {
  workflowId?: string;
  status?: "pending" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled" | "all";
  triggeredBy?: string;
  triggerType?: "manual" | "event" | "schedule" | "signal" | "all";
  activeOnly?: boolean;
}

export interface AuditLogQueryFilter {
  actorId?: string;
  actorEmail?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  status?: "success" | "denied" | "error" | "all";
  requestId?: string;
}
