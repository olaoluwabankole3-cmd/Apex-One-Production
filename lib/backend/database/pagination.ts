/**
 * APEX ONE — Standard Pagination Contract & Deterministic Sorting Engine
 * 
 * ARCHITECTURAL SPECIFICATION:
 * 1. Reusable paginated result abstraction (`PaginatedResult<T>`).
 * 2. Strict, centralized limits (`DEFAULT_PAGE_SIZE = 50`, `MAX_PAGE_SIZE = 100`).
 * 3. Cursor-based pagination with opaque base64url encoding and tenant isolation binding.
 * 4. Deterministic multi-key sorting with automatic secondary tie-breaker (`id`).
 * 5. Sort field whitelisting to eliminate unvalidated / injection-prone order clauses.
 * 6. Storage-agnostic contract directly translatable to PostgreSQL keyset pagination.
 */

import { TenantContext, ValidationError, CrossTenantViolationError } from "../core/errors";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export interface PaginationOptions {
  limit?: number;
  cursor?: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string | null;
  hasMore: boolean;
  totalCount?: number;
  count?: number;
}

export interface CursorPayload {
  v: unknown;            // Primary sort field value
  id: string;            // Entity unique ID tie-breaker
  f: string;             // Primary sort field key
  d: "asc" | "desc";     // Sort direction
  t: string;             // Tenant organizationId (strict isolation check)
}

/**
 * Normalizes and validates the requested limit against centralized platform boundaries.
 * Rejects 0, negative numbers, NaN, Infinity, and non-numeric values.
 * Caps values exceeding MAX_PAGE_SIZE to MAX_PAGE_SIZE.
 */
export function normalizeLimit(limit?: unknown): number {
  if (limit === undefined || limit === null) {
    return DEFAULT_PAGE_SIZE;
  }

  if (typeof limit !== "number" || Number.isNaN(limit)) {
    return DEFAULT_PAGE_SIZE;
  }

  if (!Number.isFinite(limit)) {
    return limit > 0 ? MAX_PAGE_SIZE : DEFAULT_PAGE_SIZE;
  }

  if (limit <= 0) {
    return DEFAULT_PAGE_SIZE;
  }

  const intLimit = Math.floor(limit);
  if (intLimit <= 0) {
    return DEFAULT_PAGE_SIZE;
  }

  if (intLimit > MAX_PAGE_SIZE) {
    return MAX_PAGE_SIZE;
  }

  return intLimit;
}

/**
 * Encodes an opaque, URL-safe base64 cursor representing the last evaluated record.
 */
export function encodeCursor(payload: CursorPayload): string {
  const jsonStr = JSON.stringify({
    v: payload.v,
    id: payload.id,
    f: payload.f,
    d: payload.d,
    t: payload.t,
  });
  return Buffer.from(jsonStr, "utf8").toString("base64url");
}

/**
 * Decodes and validates an opaque pagination cursor, verifying tenant context ownership.
 */
export function decodeCursor(cursor: string, expectedTenantId?: string): CursorPayload {
  if (!cursor || typeof cursor !== "string" || cursor.trim().length === 0) {
    throw new ValidationError("Pagination cursor cannot be empty.");
  }

  try {
    const raw = Buffer.from(cursor.trim(), "base64url").toString("utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      throw new ValidationError("Malformed pagination cursor structure.");
    }

    if (!parsed.id || !parsed.f || !parsed.d || !parsed.t) {
      throw new ValidationError("Pagination cursor is missing required keys.");
    }

    if (expectedTenantId && parsed.t !== expectedTenantId) {
      throw new ValidationError(`Pagination cursor organization mismatch: cursor issued for ${parsed.t}, expected ${expectedTenantId}`);
    }

    return {
      v: parsed.v,
      id: String(parsed.id),
      f: String(parsed.f),
      d: parsed.d === "desc" ? "desc" : "asc",
      t: String(parsed.t),
    };
  } catch (err: unknown) {
    if (err instanceof CrossTenantViolationError || err instanceof ValidationError) {
      throw err;
    }
    throw new ValidationError("Failed to parse pagination cursor.");
  }
}

/**
 * Entity Sort Whitelists
 * Prevents arbitrary persistence column injection and unknown property lookups.
 */
export const ENTITY_SORT_WHITELIST: Record<string, readonly string[]> = {
  Customer: ["id", "name", "tier", "status", "healthScore", "arr", "since", "createdAt", "updatedAt", "contractRenewalDate"],
  Contract: ["id", "customerId", "title", "contractValue", "annualRecurringRevenue", "startDate", "endDate", "renewalDaysRemaining", "status", "createdAt", "updatedAt"],
  Transaction: ["id", "customerId", "amount", "date", "category", "status", "createdAt", "updatedAt"],
  Signal: ["id", "category", "severity", "title", "status", "timestamp", "createdAt", "updatedAt"],
  ValueOpportunity: ["id", "title", "category", "status", "estimatedArrImpact", "potentialValue", "confidenceScore", "createdAt", "updatedAt"],
  ValueCaptured: ["id", "opportunityId", "title", "category", "capturedValue", "realizedAt", "createdAt", "updatedAt"],
  OrganizationalMemory: ["id", "type", "title", "confidence", "effectiveAt", "verified", "createdAt", "updatedAt"],
  Action: ["id", "title", "status", "priority", "dueDate", "createdAt", "updatedAt"],
  Document: ["id", "name", "category", "fileType", "fileSize", "status", "uploadedAt", "createdAt", "updatedAt"],
  KnowledgeItem: ["id", "title", "category", "confidenceScore", "verifiedAt", "createdAt", "updatedAt"],
  Workflow: ["id", "name", "category", "status", "createdAt", "updatedAt"],
  WorkflowRun: ["id", "workflowId", "status", "startedAt", "completedAt", "createdAt", "updatedAt"],
  AuditLog: ["id", "timestamp", "actorEmail", "action", "resource", "resourceId", "status"],
};

export interface OrderBySpec<T = Record<string, unknown>> {
  field: keyof T | string;
  direction?: "asc" | "desc";
}

/**
 * Validates requested sort fields against entity whitelists and appends a deterministic secondary tie-breaker.
 */
export function normalizeAndValidateOrderBy<T>(
  entityName?: string,
  orderBy?: OrderBySpec<T>[] | OrderBySpec<T>
): OrderBySpec<T>[] {
  const whitelist = entityName && ENTITY_SORT_WHITELIST[entityName] ? ENTITY_SORT_WHITELIST[entityName] : undefined;

  let orderList: OrderBySpec<T>[] = [];
  if (orderBy) {
    orderList = Array.isArray(orderBy) ? [...orderBy] : [orderBy];
  }

  if (orderList.length > 0) {
    for (const ord of orderList) {
      const fieldStr = String(ord.field);
      if (whitelist && !whitelist.includes(fieldStr)) {
        throw new ValidationError(`Invalid sort field '${fieldStr}' for entity '${entityName}'. Allowed fields: ${whitelist.join(", ")}`);
      }
    }
  } else {
    // Default deterministic sorting
    if (entityName === "AuditLog") {
      orderList = [{ field: "timestamp", direction: "desc" }];
    } else if (whitelist?.includes("createdAt")) {
      orderList = [{ field: "createdAt", direction: "desc" }];
    } else {
      orderList = [{ field: "id", direction: "asc" }];
    }
  }

  // Ensure deterministic tie-breaker: always end with `id`
  const hasIdTieBreaker = orderList.some((o) => String(o.field) === "id");
  if (!hasIdTieBreaker) {
    const primaryDir = orderList[0]?.direction || "desc";
    orderList.push({ field: "id", direction: primaryDir });
  }

  return orderList;
}

/**
 * Pure deterministic comparator across multiple fields with tie-breaking on `id`.
 */
export function compareRecords<T>(a: T, b: T, orderBys: OrderBySpec<T>[]): number {
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;

  for (const order of orderBys) {
    const fieldKey = String(order.field);
    const direction = order.direction === "desc" ? -1 : 1;

    const valA = objA[fieldKey];
    const valB = objB[fieldKey];

    if (valA === valB) {
      continue;
    }

    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    if (typeof valA === "number" && typeof valB === "number") {
      return (valA - valB) * direction;
    }

    if (valA instanceof Date && valB instanceof Date) {
      return (valA.getTime() - valB.getTime()) * direction;
    }

    const strA = String(valA);
    const strB = String(valB);

    // Attempt date comparison for ISO strings
    if (strA.includes("T") && strB.includes("T")) {
      const timeA = Date.parse(strA);
      const timeB = Date.parse(strB);
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return (timeA - timeB) * direction;
      }
    }

    const comp = strA.localeCompare(strB);
    if (comp !== 0) {
      return comp * direction;
    }
  }

  return 0;
}
