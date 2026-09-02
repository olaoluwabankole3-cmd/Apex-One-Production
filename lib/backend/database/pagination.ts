/**
 * APEX ONE — Standard Pagination Contract & Deterministic Sorting Engine
 *
 * Stage 3 architectural rules:
 * 1. Cursor pagination is the single public pagination model.
 * 2. Page limits come from the shared HTTP contract foundation.
 * 3. Cursors are opaque, tenant-bound, and deterministic.
 * 4. Sorting is whitelist-controlled with an automatic `id` tie-breaker.
 * 5. The engine remains storage-agnostic for future SQL/keyset adapters.
 */

import { TenantContext, ValidationError, CrossTenantViolationError } from "../core/errors";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type CursorPaginationRequest,
  type PaginatedResult,
} from "../../contracts/http";

export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type PaginatedResult,
};

export type PaginationOptions = CursorPaginationRequest;

export interface CursorPayload {
  v: unknown;             // Primary sort field value
  id: string;             // Entity unique ID tie-breaker
  f: string;              // Primary sort field key
  d: "asc" | "desc";    // Sort direction
  t: string;              // Tenant organizationId (strict isolation check)
}

/**
 * Normalizes and validates the requested limit against centralized platform boundaries.
 * Invalid/non-positive values normalize to DEFAULT_PAGE_SIZE; oversized positive values
 * clamp to MAX_PAGE_SIZE.
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
 * Decodes and validates an opaque pagination cursor, verifying tenant ownership.
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

    if (parsed.d !== "asc" && parsed.d !== "desc") {
      throw new ValidationError("Pagination cursor contains an invalid sort direction.");
    }

    if (expectedTenantId && parsed.t !== expectedTenantId) {
      throw new ValidationError("Pagination cursor is not valid for this organization.");
    }

    return {
      v: parsed.v,
      id: String(parsed.id),
      f: String(parsed.f),
      d: parsed.d,
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
 * Entity sort whitelists prevent arbitrary persistence-column injection.
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
  Provenance: ["id", "subjectType", "subjectId", "relation", "producerType", "createdAt"],
  Verification: ["id", "subjectType", "subjectId", "state", "verifierId", "createdAt"],
  Certification: ["id", "subjectType", "subjectId", "state", "certifierId", "validFrom", "validUntil", "createdAt"],
  AuditLog: ["id", "timestamp", "actorEmail", "action", "resource", "resourceId", "status"],
};

export interface OrderBySpec<T = Record<string, unknown>> {
  field: keyof T | string;
  direction?: "asc" | "desc";
}

/**
 * Validates requested sort fields and appends a deterministic secondary `id` tie-breaker.
 */
export function normalizeAndValidateOrderBy<T>(
  entityName?: string,
  orderBy?: OrderBySpec<T>[] | OrderBySpec<T>
): OrderBySpec<T>[] {
  const whitelist = entityName && ENTITY_SORT_WHITELIST[entityName]
    ? ENTITY_SORT_WHITELIST[entityName]
    : undefined;

  let orderList: OrderBySpec<T>[] = [];
  if (orderBy) {
    orderList = Array.isArray(orderBy) ? [...orderBy] : [orderBy];
  }

  if (orderList.length > 0) {
    for (const ord of orderList) {
      const fieldStr = String(ord.field);
      if (whitelist && !whitelist.includes(fieldStr)) {
        throw new ValidationError(
          `Invalid sort field '${fieldStr}' for entity '${entityName}'. Allowed fields: ${whitelist.join(", ")}`
        );
      }
    }
  } else {
    if (entityName === "AuditLog") {
      orderList = [{ field: "timestamp", direction: "desc" }];
    } else if (whitelist?.includes("createdAt")) {
      orderList = [{ field: "createdAt", direction: "desc" }];
    } else {
      orderList = [{ field: "id", direction: "asc" }];
    }
  }

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

    if (valA === valB) continue;
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

    if (strA.includes("T") && strB.includes("T")) {
      const timeA = Date.parse(strA);
      const timeB = Date.parse(strB);
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return (timeA - timeB) * direction;
      }
    }

    const comp = strA.localeCompare(strB);
    if (comp !== 0) return comp * direction;
  }

  return 0;
}
