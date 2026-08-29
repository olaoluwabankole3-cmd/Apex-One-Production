/**
 * APEX ONE — Request & Data Runtime Validation Engine
 *
 * Performs strict type, format, length, enum, and state-transition validation
 * on untrusted incoming HTTP request payloads before reaching domain services.
 *
 * SECURITY PRINCIPLES:
 * - Reject unexpected types instead of relying on JavaScript coercion.
 * - Apply explicit length and range constraints where supplied.
 * - Prefer allowlists for structured values.
 * - Normalize values only when normalization is unambiguous.
 * - Never silently convert malformed security-sensitive input into a valid value.
 * - Keep query pagination/sorting semantics delegated to the centralized query layer.
 */

import { ValidationError, InvalidStateTransitionError } from "./errors";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizeQueryLimit,
  normalizeQueryOffset,
  validateSortOptions,
  SortOptions,
} from "../database/query";

export type SupportedCurrency =
  | "NGN"
  | "USD"
  | "GBP"
  | "EUR"
  | "GHS"
  | "ZAR"
  | "KES";

export const SUPPORTED_CURRENCIES: readonly SupportedCurrency[] = [
  "NGN",
  "USD",
  "GBP",
  "EUR",
  "GHS",
  "ZAR",
  "KES",
] as const;

/**
 * Canonical, unambiguous currency aliases.
 *
 * Deliberately excludes ambiguous one-character aliases such as "r".
 */
const CURRENCY_NORMALIZATION_MAP: Record<string, SupportedCurrency> = {
  ngn: "NGN",
  naira: "NGN",
  "₦": "NGN",

  usd: "USD",
  dollar: "USD",
  dollars: "USD",
  "us dollar": "USD",
  "us dollars": "USD",
  "$": "USD",

  gbp: "GBP",
  pound: "GBP",
  pounds: "GBP",
  "british pound": "GBP",
  "£": "GBP",

  eur: "EUR",
  euro: "EUR",
  euros: "EUR",
  "€": "EUR",
};

/**
 * Conservative maximum for generic string arrays.
 *
 * Domain-specific validators should still provide tighter limits where
 * the business model requires them.
 */
const DEFAULT_STRING_ARRAY_MAX_ITEMS = 100;

/**
 * Conservative maximum length for an individual string-array item.
 */
const DEFAULT_STRING_ARRAY_ITEM_MAX_LENGTH = 500;

/**
 * Conservative maximum generic string length when a caller does not provide
 * an explicit limit.
 *
 * Domain-specific fields should preferably provide their own tighter bounds.
 */
const DEFAULT_STRING_MAX_LENGTH = 10_000;

export class Validator {
  /**
   * Ensure value is a non-empty string.
   *
   * The returned value is trimmed so callers receive a canonical representation.
   */
  public static requireString(
    value: unknown,
    fieldName: string,
    options?: {
      minLength?: number;
      maxLength?: number;
    }
  ): string {
    if (typeof value !== "string") {
      throw new ValidationError(
        `Field '${fieldName}' is required and must be a non-empty string`
      );
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      throw new ValidationError(
        `Field '${fieldName}' is required and must be a non-empty string`
      );
    }

    const minLength = options?.minLength;
    const maxLength = options?.maxLength ?? DEFAULT_STRING_MAX_LENGTH;

    if (minLength !== undefined) {
      if (
        !Number.isSafeInteger(minLength) ||
        minLength < 0
      ) {
        throw new ValidationError(
          `Invalid minimum length configuration for '${fieldName}'`
        );
      }

      if (trimmed.length < minLength) {
        throw new ValidationError(
          `Field '${fieldName}' must have at least ${minLength} characters`
        );
      }
    }

    if (
      !Number.isSafeInteger(maxLength) ||
      maxLength < 1
    ) {
      throw new ValidationError(
        `Invalid maximum length configuration for '${fieldName}'`
      );
    }

    if (trimmed.length > maxLength) {
      throw new ValidationError(
        `Field '${fieldName}' cannot exceed ${maxLength} characters`
      );
    }

    return trimmed;
  }

  /**
   * Optional string with length bounds.
   *
   * null and undefined are treated as absent.
   * Empty strings are normalized to undefined.
   */
  public static optionalString(
    value: unknown,
    fieldName: string,
    options?: {
      maxLength?: number;
    }
  ): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== "string") {
      throw new ValidationError(
        `Field '${fieldName}' must be a string`
      );
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return undefined;
    }

    const maxLength =
      options?.maxLength ?? DEFAULT_STRING_MAX_LENGTH;

    if (
      !Number.isSafeInteger(maxLength) ||
      maxLength < 1
    ) {
      throw new ValidationError(
        `Invalid maximum length configuration for '${fieldName}'`
      );
    }

    if (trimmed.length > maxLength) {
      throw new ValidationError(
        `Field '${fieldName}' cannot exceed ${maxLength} characters`
      );
    }

    return trimmed;
  }

  /**
   * Ensure value is a finite number within bounds.
   *
   * Numeric strings are accepted only when they represent a complete,
   * finite decimal/scientific number. Booleans, arrays, objects, empty
   * strings, whitespace-only strings, and null/undefined are rejected.
   *
   * This prevents JavaScript's broad Number() coercion from converting
   * values such as true, false, [], or "" into numbers.
   */
  public static requireNumber(
    value: unknown,
    fieldName: string,
    options?: {
      min?: number;
      max?: number;
    }
  ): number {
    let num: number;

    if (typeof value === "number") {
      num = value;
    } else if (typeof value === "string") {
      const normalized = value.trim();

      if (normalized.length === 0) {
        throw new ValidationError(
          `Field '${fieldName}' must be a valid finite number`
        );
      }

      /**
       * Accept ordinary decimal/scientific numeric strings while rejecting
       * arbitrary JavaScript coercion.
       */
      if (
        !/^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/.test(
          normalized
        )
      ) {
        throw new ValidationError(
          `Field '${fieldName}' must be a valid finite number`
        );
      }

      num = Number(normalized);
    } else {
      throw new ValidationError(
        `Field '${fieldName}' must be a valid finite number`
      );
    }

    if (!Number.isFinite(num)) {
      throw new ValidationError(
        `Field '${fieldName}' must be a valid finite number`
      );
    }

    if (
      options?.min !== undefined &&
      num < options.min
    ) {
      throw new ValidationError(
        `Field '${fieldName}' must be at least ${options.min}`
      );
    }

    if (
      options?.max !== undefined &&
      num > options.max
    ) {
      throw new ValidationError(
        `Field '${fieldName}' cannot exceed ${options.max}`
      );
    }

    return num;
  }

  /**
   * Optional number with bounds.
   */
  public static optionalNumber(
    value: unknown,
    fieldName: string,
    options?: {
      min?: number;
      max?: number;
    }
  ): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (
      typeof value === "string" &&
      value.trim().length === 0
    ) {
      return undefined;
    }

    return this.requireNumber(value, fieldName, options);
  }

  /**
   * Ensure value is a member of an allowed enum array.
   */
  public static requireEnum<T extends string>(
    value: unknown,
    allowed: readonly T[],
    fieldName: string
  ): T {
    if (
      typeof value !== "string" ||
      !allowed.includes(value as T)
    ) {
      throw new ValidationError(
        `Invalid value for '${fieldName}'. Allowed values: [${allowed.join(
          ", "
        )}]`
      );
    }

    return value as T;
  }

  /**
   * Optional enum value.
   *
   * Empty strings are treated as absent.
   */
  public static optionalEnum<T extends string>(
    value: unknown,
    allowed: readonly T[],
    fieldName: string
  ): T | undefined {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return undefined;
    }

    return this.requireEnum(value, allowed, fieldName);
  }

  /**
   * Ensure value is a boolean.
   *
   * String values such as "true" and "false" are deliberately rejected.
   * API callers must send actual booleans.
   */
  public static optionalBoolean(
    value: unknown,
    fieldName: string
  ): boolean | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== "boolean") {
      throw new ValidationError(
        `Field '${fieldName}' must be a boolean`
      );
    }

    return value;
  }

  /**
   * Ensure value is a string array.
   *
   * Every element must actually be a string. Empty elements are removed
   * after trimming.
   */
  public static optionalStringArray(
    value: unknown,
    fieldName: string,
    options?: {
      maxItems?: number;
      itemMaxLength?: number;
    }
  ): string[] | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (!Array.isArray(value)) {
      throw new ValidationError(
        `Field '${fieldName}' must be an array of strings`
      );
    }

    const maxItems =
      options?.maxItems ?? DEFAULT_STRING_ARRAY_MAX_ITEMS;

    const itemMaxLength =
      options?.itemMaxLength ??
      DEFAULT_STRING_ARRAY_ITEM_MAX_LENGTH;

    if (
      !Number.isSafeInteger(maxItems) ||
      maxItems < 1
    ) {
      throw new ValidationError(
        `Invalid maximum item count configuration for '${fieldName}'`
      );
    }

    if (
      !Number.isSafeInteger(itemMaxLength) ||
      itemMaxLength < 1
    ) {
      throw new ValidationError(
        `Invalid item length configuration for '${fieldName}'`
      );
    }

    if (value.length > maxItems) {
      throw new ValidationError(
        `Field '${fieldName}' cannot contain more than ${maxItems} items`
      );
    }

    const normalized: string[] = [];

    for (const item of value) {
      if (typeof item !== "string") {
        throw new ValidationError(
          `Field '${fieldName}' must be an array of strings`
        );
      }

      const trimmed = item.trim();

      if (trimmed.length === 0) {
        continue;
      }

      if (trimmed.length > itemMaxLength) {
        throw new ValidationError(
          `Items in '${fieldName}' cannot exceed ${itemMaxLength} characters`
        );
      }

      normalized.push(trimmed);
    }

    return normalized;
  }

  /**
   * Validate email format.
   *
   * This is intentionally a practical syntactic validator rather than a
   * complete RFC email parser. Domain-specific email delivery systems remain
   * responsible for determining whether an address actually exists.
   */
  public static requireEmail(
    value: unknown,
    fieldName: string = "email"
  ): string {
    const str = this.requireString(
      value,
      fieldName,
      { maxLength: 254 }
    );

    /**
     * Prevent control characters and require a basic local@domain structure.
     */
    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(str)) {
      throw new ValidationError(
        `Field '${fieldName}' must be a valid email address`
      );
    }

    const atIndex = str.lastIndexOf("@");
    const localPart = str.slice(0, atIndex);
    const domainPart = str.slice(atIndex + 1);

    if (
      localPart.length === 0 ||
      localPart.length > 64 ||
      domainPart.length === 0 ||
      domainPart.length > 253
    ) {
      throw new ValidationError(
        `Field '${fieldName}' must be a valid email address`
      );
    }

    return str.toLowerCase();
  }

  /**
   * Validate an application identifier.
   *
   * IDs are intentionally restricted to a predictable ASCII allowlist.
   */
  public static requireId(
    value: unknown,
    fieldName: string = "id"
  ): string {
    const str = this.requireString(
      value,
      fieldName,
      { minLength: 3, maxLength: 64 }
    );

    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(str)) {
      throw new ValidationError(
        `Field '${fieldName}' contains invalid characters. Must be 3-64 alphanumeric characters, dashes, or underscores`
      );
    }

    return str;
  }

  /**
   * Normalize an incoming currency identifier.
   *
   * Returns undefined for missing, empty, ambiguous, or unsupported values.
   */
  public static normalizeCurrency(
    value: unknown
  ): SupportedCurrency | undefined {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    const upper = trimmed.toUpperCase();

    if (
      SUPPORTED_CURRENCIES.includes(
        upper as SupportedCurrency
      )
    ) {
      return upper as SupportedCurrency;
    }

    const lower = trimmed.toLowerCase();

    return CURRENCY_NORMALIZATION_MAP[lower];
  }

  /**
   * Ensure value is a valid, supported ISO 4217 currency.
   *
   * Rejects missing, empty, malformed, ambiguous, or unsupported currencies.
   */
  public static requireCurrency(
    value: unknown,
    fieldName: string = "currency"
  ): SupportedCurrency {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      throw new ValidationError(
        `Field '${fieldName}' is required and must be a supported ISO currency`
      );
    }

    const normalized = this.normalizeCurrency(value);

    if (!normalized) {
      throw new ValidationError(
        `Invalid or unsupported currency for '${fieldName}'. Supported ISO currencies: [${SUPPORTED_CURRENCIES.join(
          ", "
        )}]`
      );
    }

    return normalized;
  }

  /**
   * Validate a monetary amount.
   *
   * Monetary amounts must be finite and non-negative.
   *
   * Business/domain-specific maximums should be enforced by the caller.
   */
  public static requireMonetaryAmount(
    value: unknown,
    fieldName: string = "amount"
  ): number {
    return this.requireNumber(
      value,
      fieldName,
      { min: 0 }
    );
  }

  /**
   * Verify a valid state-machine transition.
   */
  public static validateStateTransition<T extends string>(
    current: T,
    next: T,
    allowedTransitions: Record<T, T[]>,
    entityName: string = "Entity"
  ): void {
    const allowed = allowedTransitions[current] || [];

    if (!allowed.includes(next)) {
      throw new InvalidStateTransitionError(
        entityName,
        current,
        next,
        allowed
      );
    }
  }

  /**
   * Validate and normalize a query limit using centralized bounds
   * [1, MAX_PAGE_SIZE].
   *
   * NOTE:
   * Strict Infinity/fractional/invalid-value behavior remains owned by
   * database/query.ts. This wrapper intentionally delegates to that
   * centralized implementation rather than duplicating query semantics.
   */
  public static normalizeQueryLimit(
    limit: unknown,
    options?: {
      strict?: boolean;
      defaultSize?: number;
      maxSize?: number;
      fieldName?: string;
    }
  ): number {
    return normalizeQueryLimit(limit, options);
  }

  /**
   * Strict validation of a query limit.
   *
   * Rejects invalid values and values above MAX_PAGE_SIZE through the
   * centralized query validator.
   */
  public static requireQueryLimit(
    limit: unknown,
    fieldName: string = "limit"
  ): number {
    return normalizeQueryLimit(
      limit,
      {
        strict: true,
        fieldName,
      }
    );
  }

  /**
   * Validate and normalize a query offset / skip value.
   */
  public static normalizeQueryOffset(
    offset: unknown,
    fieldName: string = "offset"
  ): number {
    return normalizeQueryOffset(
      offset,
      { fieldName }
    );
  }

  /**
   * Validate sort configuration against a domain whitelist of allowed fields.
   *
   * The actual query-layer implementation remains responsible for strict
   * sort direction and field semantics.
   */
  public static validateSort<T extends string>(
    sort: unknown,
    allowedFields: readonly T[],
    options?: {
      strict?: boolean;
      fieldName?: string;
    }
  ): SortOptions<T> | undefined {
    return validateSortOptions(
      sort,
      allowedFields,
      options
    );
  }
}
