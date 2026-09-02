/**
 * APEX ONE — Strict HTTP Request Boundary Validation
 *
 * Route-layer helpers for untrusted HTTP inputs. These helpers deliberately
 * keep transport validation separate from domain/service validation:
 * - JSON bodies must be valid plain objects.
 * - Unexpected body fields are rejected rather than silently ignored.
 * - Public collection pagination accepts cursor + limit only.
 * - Query strings are bounded and unambiguous before reaching domain services.
 * - Nested records/arrays are type-checked before domain-specific validation.
 */

import type { CursorPaginationRequest } from "../../contracts/http";
import { ValidationError } from "./errors";
import { Validator } from "./validation";

export type JsonObject = Record<string, unknown>;

const DEFAULT_CURSOR_MAX_LENGTH = 4096;
const DEFAULT_QUERY_STRING_MAX_LENGTH = 500;
const DEFAULT_ARRAY_MAX_ITEMS = 250;

/**
 * Require a non-null JSON object. Arrays and primitive values are rejected.
 */
export function requireJsonObject(
  value: unknown,
  fieldName: string = "request body"
): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be a JSON object`);
  }

  return value as JsonObject;
}

/**
 * Parse an HTTP request body and require a valid JSON object.
 * Syntax/parsing failures are normalized to a structured ValidationError.
 */
export async function readJsonObject(
  request: { json(): Promise<unknown> },
  fieldName: string = "request body"
): Promise<JsonObject> {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    throw new ValidationError(`${fieldName} must contain valid JSON`);
  }

  return requireJsonObject(parsed, fieldName);
}

/**
 * Reject unrecognized fields at the HTTP trust boundary.
 * This prevents clients from smuggling persistence/security fields such as
 * organizationId, id, timestamps, or other future fields through broad DTOs.
 */
export function assertAllowedKeys(
  value: JsonObject,
  allowedKeys: readonly string[],
  fieldName: string = "request body"
): void {
  const allowed = new Set(allowedKeys);
  const unexpectedFields = Object.keys(value).filter((key) => !allowed.has(key));

  if (unexpectedFields.length > 0) {
    throw new ValidationError(
      `${fieldName} contains unsupported field${unexpectedFields.length === 1 ? "" : "s"}: ${unexpectedFields.join(", ")}`,
      { unexpectedFields }
    );
  }
}

/**
 * Require at least one explicitly supplied field for mutation payloads.
 */
export function assertNonEmptyObject(
  value: JsonObject,
  fieldName: string = "request body"
): void {
  if (Object.keys(value).length === 0) {
    throw new ValidationError(`${fieldName} must contain at least one field`);
  }
}

/**
 * Reject unsupported or repeated query-string parameters.
 * This prevents legacy offset/page parameters and ambiguous duplicate keys
 * from coexisting with the canonical cursor contract.
 */
export function assertAllowedQueryKeys(
  searchParams: URLSearchParams,
  allowedKeys: readonly string[]
): void {
  const allowed = new Set(allowedKeys);
  const seen = new Set<string>();

  for (const [key] of searchParams) {
    if (!allowed.has(key)) {
      throw new ValidationError(`Unsupported query parameter '${key}'`, {
        unsupportedQueryParameter: key,
      });
    }

    if (seen.has(key)) {
      throw new ValidationError(`Query parameter '${key}' must not be repeated`, {
        repeatedQueryParameter: key,
      });
    }

    seen.add(key);
  }
}

/**
 * Canonical public collection pagination parser.
 * Offset/skip/page parameters are intentionally not accepted here.
 */
export function parseCursorPagination(
  searchParams: URLSearchParams
): CursorPaginationRequest {
  const rawLimit = searchParams.get("limit");
  const rawCursor = searchParams.get("cursor");

  const limit =
    rawLimit === null
      ? undefined
      : Validator.requireQueryLimit(rawLimit, "limit");

  const cursor =
    rawCursor === null
      ? undefined
      : Validator.optionalString(rawCursor, "cursor", {
          maxLength: DEFAULT_CURSOR_MAX_LENGTH,
        });

  return {
    ...(limit !== undefined ? { limit } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
  };
}

/**
 * Read a bounded optional query-string value.
 */
export function optionalQueryString(
  searchParams: URLSearchParams,
  key: string,
  maxLength: number = DEFAULT_QUERY_STRING_MAX_LENGTH
): string | undefined {
  const raw = searchParams.get(key);

  if (raw === null) {
    return undefined;
  }

  return Validator.optionalString(raw, key, { maxLength });
}

/**
 * Require a nested JSON object.
 */
export function requireRecord(
  value: unknown,
  fieldName: string
): Record<string, unknown> {
  return requireJsonObject(value, fieldName);
}

/**
 * Accept an optional nested JSON object.
 */
export function optionalRecord(
  value: unknown,
  fieldName: string
): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requireRecord(value, fieldName);
}

/**
 * Require an array and enforce a conservative transport-level item bound.
 * Domain validators remain responsible for validating each element's shape.
 */
export function requireArray(
  value: unknown,
  fieldName: string,
  maxItems: number = DEFAULT_ARRAY_MAX_ITEMS
): unknown[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`Field '${fieldName}' must be an array`);
  }

  if (!Number.isSafeInteger(maxItems) || maxItems < 1) {
    throw new ValidationError(`Invalid maximum item count configuration for '${fieldName}'`);
  }

  if (value.length > maxItems) {
    throw new ValidationError(`Field '${fieldName}' cannot contain more than ${maxItems} items`);
  }

  return value;
}

/**
 * Validate an optional array using the same transport-level item bound.
 */
export function optionalArray(
  value: unknown,
  fieldName: string,
  maxItems: number = DEFAULT_ARRAY_MAX_ITEMS
): unknown[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requireArray(value, fieldName, maxItems);
}
