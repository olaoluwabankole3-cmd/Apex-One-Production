/**
 * APEX ONE — Storage-Agnostic Structured Query Specifications
 *
 * Stage 3 canonical query contract:
 * - Declarative filters/search/order only; no executable predicates.
 * - Cursor pagination only at public repository/service boundaries.
 * - Directly translatable to parameterized SQL WHERE/ORDER BY/keyset LIMIT.
 * - Fully evaluable by the in-memory adapter for deterministic tests.
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

/**
 * Canonical repository collection query. Offset is intentionally absent.
 */
export interface QuerySpecification<T = Record<string, unknown>> extends PaginationOptions {
  where?: QueryFilter<T>;
  search?: SearchSpecification<T>;
  orderBy?: OrderBySpecification<T>[] | OrderBySpecification<T>;
}

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

export function evaluateCondition<V>(fieldValue: V, condition: FieldCondition<V>): boolean {
  if (condition === undefined) return true;

  if (condition === null) {
    return fieldValue === null || fieldValue === undefined;
  }

  if (!isOperatorObject(condition)) {
    if (typeof fieldValue === "string" && typeof condition === "string") {
      return fieldValue.toLowerCase() === condition.toLowerCase();
    }
    return (fieldValue as unknown) === condition;
  }

  const op = condition as ComparisonOperator<V>;

  if (op.isNull !== undefined) {
    const isActuallyNull = fieldValue === null || fieldValue === undefined;
    if (op.isNull !== isActuallyNull) return false;
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
    } else if (String(a) >= String(b)) return false;
  }

  if (op.lte !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    const a = toComparable(fieldValue);
    const b = toComparable(op.lte);
    if (typeof a === "number" && typeof b === "number") {
      if (a > b) return false;
    } else if (String(a) > String(b)) return false;
  }

  if (op.gt !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    const a = toComparable(fieldValue);
    const b = toComparable(op.gt);
    if (typeof a === "number" && typeof b === "number") {
      if (a <= b) return false;
    } else if (String(a) <= String(b)) return false;
  }

  if (op.gte !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    const a = toComparable(fieldValue);
    const b = toComparable(op.gte);
    if (typeof a === "number" && typeof b === "number") {
      if (a < b) return false;
    } else if (String(a) < String(b)) return false;
  }

  if (op.contains !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    if (!String(fieldValue).toLowerCase().includes(op.contains.toLowerCase())) return false;
  }

  if (op.startsWith !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    if (!String(fieldValue).toLowerCase().startsWith(op.startsWith.toLowerCase())) return false;
  }

  if (op.endsWith !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    if (!String(fieldValue).toLowerCase().endsWith(op.endsWith.toLowerCase())) return false;
  }

  if (op.ilike !== undefined) {
    if (fieldValue === null || fieldValue === undefined) return false;
    const str = String(fieldValue).toLowerCase();
    const escaped = op.ilike
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/%/g, ".*")
      .replace(/_/g, ".");
    if (!new RegExp(`^${escaped}$`, "i").test(str)) return false;
  }

  if (op.arrayContains !== undefined) {
    if (!Array.isArray(fieldValue)) return false;
    const needle = typeof op.arrayContains === "string"
      ? op.arrayContains.toLowerCase()
      : op.arrayContains;
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
    const exists = fieldValue.some((item) =>
      op.arrayContainsAny!.some((needle) => {
        if (typeof item === "string" && typeof needle === "string") {
          return item.toLowerCase() === needle.toLowerCase();
        }
        return item === needle;
      })
    );
    if (!exists) return false;
  }

  return true;
}

export function matchesFilter<T>(item: T, filter?: QueryFilter<T>): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;

  const obj = item as Record<string, unknown>;

  if (filter.AND && Array.isArray(filter.AND)) {
    for (const subFilter of filter.AND) {
      if (!matchesFilter(item, subFilter)) return false;
    }
  }

  if (filter.OR && Array.isArray(filter.OR) && filter.OR.length > 0) {
    if (!filter.OR.some((subFilter) => matchesFilter(item, subFilter))) return false;
  }

  if (filter.NOT && matchesFilter(item, filter.NOT)) return false;

  for (const key of Object.keys(filter)) {
    if (key === "AND" || key === "OR" || key === "NOT") continue;
    const condition = (filter as Record<string, unknown>)[key] as FieldCondition<unknown>;
    if (!evaluateCondition(obj[key], condition)) return false;
  }

  return true;
}

export function matchesSearch<T>(item: T, search?: SearchSpecification<T>): boolean {
  if (!search || !search.term || search.term.trim().length === 0) return true;

  const term = search.term.toLowerCase().trim();
  const obj = item as Record<string, unknown>;

  return search.fields.some((fieldKey) => {
    const val = obj[fieldKey as string];
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) {
      return val.some((elem) => String(elem).toLowerCase().includes(term));
    }
    return String(val).toLowerCase().includes(term);
  });
}

export function matchesSpecification<T>(item: T, spec?: QuerySpecification<T>): boolean {
  if (!spec) return true;
  if (spec.where && !matchesFilter(item, spec.where)) return false;
  if (spec.search && !matchesSearch(item, spec.search)) return false;
  return true;
}

/**
 * Non-paginated helper for internal calculations. Public collection reads must
 * use applyQuerySpecificationPaginated so cursor metadata is never lost.
 */
export function applyQuerySpecification<T>(items: T[], spec?: QuerySpecification<T>): T[] {
  if (!spec) return [...items];

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
        if (comp !== 0) return comp * direction;
      }
      return 0;
    });
  }

  return result;
}

/**
 * Applies structured filtering, deterministic sorting, and tenant-bound cursor pagination.
 */
export function applyQuerySpecificationPaginated<
  T extends { id: string; organizationId: string }
>(
  items: T[],
  spec?: QuerySpecification<T>,
  expectedTenantId?: string,
  entityName?: string
): PaginatedResult<T> {
  let filtered = spec
    ? items.filter((item) => matchesSpecification(item, spec))
    : [...items];
  const totalCount = filtered.length;

  const normalizedOrder = normalizeAndValidateOrderBy<T>(entityName, spec?.orderBy);
  filtered.sort((a, b) => compareRecords(a, b, normalizedOrder));

  const limit = normalizeLimit(spec?.limit);

  let startIndex = 0;
  if (spec?.cursor) {
    const cursorPayload = decodeCursor(spec.cursor, expectedTenantId);
    const primaryOrder = normalizedOrder[0];
    const primaryField = String(primaryOrder.field);
    const primaryDirection = primaryOrder.direction === "desc" ? "desc" : "asc";

    if (cursorPayload.f !== primaryField || cursorPayload.d !== primaryDirection) {
      throw new (require("../core/errors").ValidationError)(
        "Pagination cursor does not match the requested sort order."
      );
    }

    const exactMatchIndex = filtered.findIndex((item) => item.id === cursorPayload.id);
    if (exactMatchIndex !== -1) {
      startIndex = exactMatchIndex + 1;
    } else {
      const cursorDummy = {
        [primaryField]: cursorPayload.v,
        id: cursorPayload.id,
      } as unknown as T;
      const idx = filtered.findIndex(
        (item) => compareRecords(item, cursorDummy, normalizedOrder) > 0
      );
      startIndex = idx === -1 ? filtered.length : idx;
    }
  }

  const pageItems = filtered.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + pageItems.length < filtered.length;

  let nextCursor: string | null = null;
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
      t: expectedTenantId || lastItem.organizationId,
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
