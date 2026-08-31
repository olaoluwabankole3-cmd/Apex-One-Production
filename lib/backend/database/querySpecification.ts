/**
 * APEX ONE — Storage-Agnostic Structured Query Specifications
 * 
 * ARCHITECTURAL SPECIFICATION:
 * Replaces arbitrary JavaScript callback predicates from repository interfaces with declarative,
 * storage-agnostic structured query specifications.
 * 
 * These specifications are:
 * 1. Serializable and inspectable.
 * 2. Directly translatable into SQL (WHERE clauses, ILIKE, IN, parameter bindings, ORDER BY, LIMIT/OFFSET) by PostgreSQL adapters.
 * 3. Evaluable by in-memory repository adapters with complete fidelity.
 */

import {
  PaginatedResult,
  PaginationOptions,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizeLimit,
  encodeCursor,
  decodeCursor,
  ENTITY_SORT_WHITELIST,
  normalizeAndValidateOrderBy,
  compareRecords,
  OrderBySpec,
} from "./pagination";

export {
  type PaginatedResult,
  type PaginationOptions,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizeLimit,
  encodeCursor,
  decodeCursor,
  ENTITY_SORT_WHITELIST,
  normalizeAndValidateOrderBy,
  compareRecords,
};

export type ValueFilter<V> = V | (V extends string ? string : never) | (V extends number ? number : never);

export type ComparisonOperator<V = unknown> = {
  eq?: ValueFilter<V>;
  neq?: ValueFilter<V>;
  in?: ValueFilter<V>[];
  nin?: ValueFilter<V>[];
  notIn?: ValueFilter<V>[];
  lt?: number | string | Date;
  lte?: number | string | Date;
  gt?: number | string | Date;
  gte?: number | string | Date;
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  ilike?: string;
  arrayContains?: unknown;
  arrayContainsAny?: unknown[];
  isNull?: boolean;
};

export type FieldCondition<V> = ValueFilter<V> | ComparisonOperator<V> | null | undefined;

export type QueryFilter<T> = {
  [K in keyof T]?: FieldCondition<T[K]>;
} & {
  AND?: QueryFilter<T>[];
  OR?: QueryFilter<T>[];
  NOT?: QueryFilter<T>;
};

export interface SearchSpecification<T> {
  fields: (keyof T | string)[];
  term: string;
}

export interface OrderBySpecification<T> {
  field: keyof T | string;
  direction?: "asc" | "desc";
}

export type OrderByClause<T = Record<string, unknown>> = OrderBySpecification<T>;

export interface QuerySpecification<T = Record<string, unknown>> {
  where?: QueryFilter<T>;
  search?: SearchSpecification<T>;
  orderBy?: OrderBySpecification<T>[] | OrderBySpecification<T>;
  limit?: number;
  offset?: number;
  cursor?: string | null;
}

/**
 * Helper to check if a value is an operator object.
 */
function isOperatorObject(val: unknown): val is ComparisonOperator<unknown> {
  if (val === null || typeof val !== "object" || Array.isArray(val) || val instanceof Date) {
    return false;
  }
  const knownKeys = [
    "eq",
    "neq",
    "in",
    "nin",
    "notIn",
    "lt",
    "lte",
    "gt",
    "gte",
    "contains",
    "startsWith",
    "endsWith",
    "ilike",
    "arrayContains",
    "arrayContainsAny",
    "isNull",
  ];
  return Object.keys(val as object).some((k) => knownKeys.includes(k));
}

function toComparable(val: unknown): number | string {
  if (val instanceof Date) return val.getTime();
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = Date.parse(val);
    if (!isNaN(parsed) && (val.includes("-") || val.includes("T"))) {
      return parsed;
    }
    return val;
  }
  return String(val);
}

/**
 * Evaluates whether a single property value satisfies a condition.
 */
export function evaluateCondition<V>(fieldValue: V, condition: FieldCondition<V>): boolean {
  if (condition === undefined) {
    return true;
  }

  if (condition === null) {
    return fieldValue === null || fieldValue === undefined;
  }

  if (!isOperatorObject(condition)) {
    // Direct value equality comparison
    if (typeof fieldValue === "string" && typeof condition === "string") {
      return fieldValue.toLowerCase() === condition.toLowerCase();
    }
    return (fieldValue as unknown) === condition;
  }

  const op = condition as ComparisonOperator<V>;

  if (op.isNull !== undefined) {
    const isActuallyNull = fieldValue === null || fieldValue === undefined;
    if (op.isNull !== isActuallyNull) {
      return false;
    }
  }

  if (op.eq !== undefined) {
    if (typeof fieldValue === "string" && typeof op.eq === "string") {
      if (fieldValue.toLowerCase() !== op.eq.toLowerCase()) return false;
    } else if (fieldValue !== op.eq) {
      return false;
    }
  }

  if (op.neq !== undefined) {
    if (typeof fieldValue === "string" && typeof op.neq === "string") {
      if (fieldValue.toLowerCase() === op.neq.toLowerCase()) return false;
    } else if (fieldValue === op.neq) {
      return false;
    }
  }

  if (op.in !== undefined) {
    if (!Array.isArray(op.in)) return false;
    const match = op.in.some((candidate) => {
      if (typeof fieldValue === "string" && typeof candidate === "string") {
        return fieldValue.toLowerCase() === candidate.toLowerCase();
      }
      return fieldValue === candidate;
    });
    if (!match) return false;
  }

  const notInList = op.nin !== undefined ? op.nin : op.notIn;
  if (notInList !== undefined) {
    if (!Array.isArray(notInList)) return true;
    const match = notInList.some((candidate) => {
      if (typeof fieldValue === "string" && typeof candidate === "string") {
        return fieldValue.toLowerCase() === candidate.toLowerCase();
      }
      return fieldValue === candidate;
    });
    if (match) return false;
  }

  if (op.lt !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    const a = toComparable(fieldValue);
    const b = toComparable(op.lt);
    if (typeof a === "number" && typeof b === "number") {
      if (a >= b) return false;
    } else if (String(a) >= String(b)) {
      return false;
    }
  }

  if (op.lte !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    const a = toComparable(fieldValue);
    const b = toComparable(op.lte);
    if (typeof a === "number" && typeof b === "number") {
      if (a > b) return false;
    } else if (String(a) > String(b)) {
      return false;
    }
  }

  if (op.gt !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    const a = toComparable(fieldValue);
    const b = toComparable(op.gt);
    if (typeof a === "number" && typeof b === "number") {
      if (a <= b) return false;
    } else if (String(a) <= String(b)) {
      return false;
    }
  }

  if (op.gte !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    const a = toComparable(fieldValue);
    const b = toComparable(op.gte);
    if (typeof a === "number" && typeof b === "number") {
      if (a < b) return false;
    } else if (String(a) < String(b)) {
      return false;
    }
  }

  if (op.contains !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    const str = String(fieldValue).toLowerCase();
    if (!str.includes(op.contains.toLowerCase())) return false;
  }

  if (op.startsWith !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    const str = String(fieldValue).toLowerCase();
    if (!str.startsWith(op.startsWith.toLowerCase())) return false;
  }

  if (op.endsWith !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    const str = String(fieldValue).toLowerCase();
    if (!str.endsWith(op.endsWith.toLowerCase())) return false;
  }

  if (op.ilike !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    const str = String(fieldValue).toLowerCase();
    const pattern = op.ilike.toLowerCase().replace(/%/g, ".*").replace(/_/g, ".");
    const regex = new RegExp(`^${pattern}$`, "i");
    if (!regex.test(str)) return false;
  }

  if (op.arrayContains !== undefined) {
    if (!Array.isArray(fieldValue)) return false;
    const needle = typeof op.arrayContains === "string" ? op.arrayContains.toLowerCase() : op.arrayContains;
    const exists = fieldValue.some((item) => {
      if (typeof item === "string" && typeof needle === "string") {
        return item.toLowerCase() === needle;
      }
      return item === needle;
    });
    if (!exists) return false;
  }

  if (op.arrayContainsAny !== undefined) {
    if (!Array.isArray(fieldValue)) return false;
    const needles = op.arrayContainsAny;
    const exists = fieldValue.some((item) => {
      return needles.some((needle) => {
        if (typeof item === "string" && typeof needle === "string") {
          return item.toLowerCase() === needle.toLowerCase();
        }
        return item === needle;
      });
    });
    if (!exists) return false;
  }

  return true;
}

/**
 * Recursively evaluates whether an item satisfies a QueryFilter.
 */
export function matchesFilter<T>(item: T, filter?: QueryFilter<T>): boolean {
  if (!filter || Object.keys(filter).length === 0) {
    return true;
  }

  const obj = item as Record<string, unknown>;

  // Check logical AND
  if (filter.AND && Array.isArray(filter.AND)) {
    for (const subFilter of filter.AND) {
      if (!matchesFilter(item, subFilter)) {
        return false;
      }
    }
  }

  // Check logical OR
  if (filter.OR && Array.isArray(filter.OR)) {
    if (filter.OR.length > 0) {
      const anyMatch = filter.OR.some((subFilter) => matchesFilter(item, subFilter));
      if (!anyMatch) {
        return false;
      }
    }
  }

  // Check logical NOT
  if (filter.NOT) {
    if (matchesFilter(item, filter.NOT)) {
      return false;
    }
  }

  // Check direct field conditions
  for (const key of Object.keys(filter)) {
    if (key === "AND" || key === "OR" || key === "NOT") {
      continue;
    }
    const condition = (filter as Record<string, unknown>)[key] as FieldCondition<unknown>;
    const fieldValue = obj[key];
    if (!evaluateCondition(fieldValue, condition)) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluates whether an item matches free-text SearchSpecification.
 */
export function matchesSearch<T>(item: T, search?: SearchSpecification<T>): boolean {
  if (!search || !search.term || search.term.trim().length === 0) {
    return true;
  }

  const term = search.term.toLowerCase().trim();
  const obj = item as Record<string, unknown>;

  return search.fields.some((fieldKey) => {
    const val = obj[fieldKey as string];
    if (val === null || val === undefined) {
      return false;
    }
    if (Array.isArray(val)) {
      return val.some((elem) => String(elem).toLowerCase().includes(term));
    }
    return String(val).toLowerCase().includes(term);
  });
}

/**
 * Checks if an item matches an entire QuerySpecification.
 */
export function matchesSpecification<T>(item: T, spec?: QuerySpecification<T>): boolean {
  if (!spec) {
    return true;
  }

  if (spec.where && !matchesFilter(item, spec.where)) {
    return false;
  }

  if (spec.search && !matchesSearch(item, spec.search)) {
    return false;
  }

  return true;
}

/**
 * Pure helper to apply filtering, ordering, and pagination to an array of items.
 */
export function applyQuerySpecification<T>(items: T[], spec?: QuerySpecification<T>): T[] {
  if (!spec) {
    return [...items];
  }

  let result = items.filter((item) => matchesSpecification(item, spec));

  if (spec.orderBy) {
    const orderBys = Array.isArray(spec.orderBy) ? spec.orderBy : [spec.orderBy];
    result.sort((a, b) => {
      for (const order of orderBys) {
        const fieldA = (a as Record<string, unknown>)[order.field as string];
        const fieldB = (b as Record<string, unknown>)[order.field as string];
        const direction = order.direction === "desc" ? -1 : 1;

        if (fieldA === fieldB) continue;
        if (fieldA === undefined || fieldA === null) return 1;
        if (fieldB === undefined || fieldB === null) return -1;

        if (typeof fieldA === "number" && typeof fieldB === "number") {
          return (fieldA - fieldB) * direction;
        }

        if (fieldA instanceof Date && fieldB instanceof Date) {
          return (fieldA.getTime() - fieldB.getTime()) * direction;
        }

        const comp = String(fieldA).localeCompare(String(fieldB));
        if (comp !== 0) {
          return comp * direction;
        }
      }
      return 0;
    });
  }

  if (spec.offset !== undefined && spec.offset > 0) {
    result = result.slice(spec.offset);
  }

  if (spec.limit !== undefined && spec.limit >= 0) {
    result = result.slice(0, spec.limit);
  }

  return result;
}

/**
 * Applies structured filtering, deterministic sorting, and cursor pagination.
 */
export function applyQuerySpecificationPaginated<T extends { id: string; organizationId: string }>(
  items: T[],
  spec?: QuerySpecification<T>,
  expectedTenantId?: string,
  entityName?: string
): PaginatedResult<T> {
  // 1. Filter
  let filtered = spec ? items.filter((item) => matchesSpecification(item, spec)) : [...items];
  const totalCount = filtered.length;

  // 2. Validate and apply deterministic multi-key ordering with tie-breaker
  const normalizedOrder = normalizeAndValidateOrderBy<T>(entityName, spec?.orderBy);
  filtered.sort((a, b) => compareRecords(a, b, normalizedOrder));

  // 3. Normalize limit
  const limit = normalizeLimit(spec?.limit);

  // 4. Cursor Seek
  let startIndex = 0;
  if (spec?.cursor) {
    const cursorPayload = decodeCursor(spec.cursor, expectedTenantId);

    // Look for exact entity id match first
    const exactMatchIndex = filtered.findIndex((item) => item.id === cursorPayload.id);
    if (exactMatchIndex !== -1) {
      startIndex = exactMatchIndex + 1;
    } else {
      // Keyset comparison fallback
      const primaryOrder = normalizedOrder[0];
      const primaryField = String(primaryOrder.field);
      const cursorDummy = {
        [primaryField]: cursorPayload.v,
        id: cursorPayload.id,
      } as unknown as T;

      const idx = filtered.findIndex((item) => compareRecords(item, cursorDummy, normalizedOrder) > 0);
      startIndex = idx === -1 ? filtered.length : idx;
    }
  }

  // 5. Slice page
  const pageItems = filtered.slice(startIndex, startIndex + limit);
  const remainingCount = filtered.length - (startIndex + pageItems.length);
  const hasMore = remainingCount > 0;

  // 6. Generate nextCursor if hasMore
  let nextCursor: string | undefined = undefined;
  if (hasMore && pageItems.length > 0) {
    const lastItem = pageItems[pageItems.length - 1];
    const primaryOrder = normalizedOrder[0];
    const primaryField = String(primaryOrder.field);
    const primaryVal = (lastItem as Record<string, unknown>)[primaryField];

    nextCursor = encodeCursor({
      v: primaryVal,
      id: lastItem.id,
      f: primaryField,
      d: primaryOrder.direction === "desc" ? "desc" : "asc",
      t: lastItem.organizationId || expectedTenantId || "",
    });
  }

  return {
    items: pageItems,
    nextCursor,
    hasMore,
    totalCount,
    count: pageItems.length,
  };
}
