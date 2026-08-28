/**
 * APEX ONE — Request & Data Runtime Validation Engine
 * 
 * Performs strict type, format, length, enum, and state-transition validation
 * on untrusted incoming HTTP request payloads before reaching domain services.
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

export type SupportedCurrency = "NGN" | "USD" | "GBP" | "EUR" | "GHS" | "ZAR" | "KES";
export const SUPPORTED_CURRENCIES: readonly SupportedCurrency[] = [
  "NGN",
  "USD",
  "GBP",
  "EUR",
  "GHS",
  "ZAR",
  "KES",
] as const;

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
  ghs: "GHS",
  cedi: "GHS",
  cedis: "GHS",
  "ghana cedi": "GHS",
  "ghana cedis": "GHS",
  "₵": "GHS",
  zar: "ZAR",
  rand: "ZAR",
  rands: "ZAR",
  "south african rand": "ZAR",
  r: "ZAR",
  kes: "KES",
  ksh: "KES",
  "kenyan shilling": "KES",
  "kenyan shillings": "KES",
};

export class Validator {
  /**
   * Ensure value is a non-empty string.
   */
  public static requireString(value: unknown, fieldName: string, options?: { minLength?: number; maxLength?: number }): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ValidationError(`Field '${fieldName}' is required and must be a non-empty string`);
    }
    const trimmed = value.trim();
    if (options?.minLength && trimmed.length < options.minLength) {
      throw new ValidationError(`Field '${fieldName}' must have at least ${options.minLength} characters`);
    }
    if (options?.maxLength && trimmed.length > options.maxLength) {
      throw new ValidationError(`Field '${fieldName}' cannot exceed ${options.maxLength} characters`);
    }
    return trimmed;
  }

  /**
   * Optional string with length bounds.
   */
  public static optionalString(value: unknown, fieldName: string, options?: { maxLength?: number }): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "string") {
      throw new ValidationError(`Field '${fieldName}' must be a string`);
    }
    const trimmed = value.trim();
    if (options?.maxLength && trimmed.length > options.maxLength) {
      throw new ValidationError(`Field '${fieldName}' cannot exceed ${options.maxLength} characters`);
    }
    return trimmed;
  }

  /**
   * Ensure value is a finite number within bounds.
   */
  public static requireNumber(value: unknown, fieldName: string, options?: { min?: number; max?: number }): number {
    const num = typeof value === "number" ? value : Number(value);
    if (isNaN(num) || !Number.isFinite(num)) {
      throw new ValidationError(`Field '${fieldName}' must be a valid finite number`);
    }
    if (options?.min !== undefined && num < options.min) {
      throw new ValidationError(`Field '${fieldName}' must be at least ${options.min}`);
    }
    if (options?.max !== undefined && num > options.max) {
      throw new ValidationError(`Field '${fieldName}' cannot exceed ${options.max}`);
    }
    return num;
  }

  /**
   * Optional number with bounds.
   */
  public static optionalNumber(value: unknown, fieldName: string, options?: { min?: number; max?: number }): number | undefined {
    if (value === undefined || value === null) return undefined;
    return this.requireNumber(value, fieldName, options);
  }

  /**
   * Ensure value is a member of an allowed enum array.
   */
  public static requireEnum<T extends string>(value: unknown, allowed: readonly T[], fieldName: string): T {
    if (typeof value !== "string" || !allowed.includes(value as T)) {
      throw new ValidationError(
        `Invalid value for '${fieldName}'. Allowed values: [${allowed.join(", ")}]`
      );
    }
    return value as T;
  }

  /**
   * Optional enum value.
   */
  public static optionalEnum<T extends string>(value: unknown, allowed: readonly T[], fieldName: string): T | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    return this.requireEnum(value, allowed, fieldName);
  }

  /**
   * Ensure value is a boolean.
   */
  public static optionalBoolean(value: unknown, fieldName: string): boolean | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "boolean") {
      throw new ValidationError(`Field '${fieldName}' must be a boolean`);
    }
    return value;
  }

  /**
   * Ensure value is a string array.
   */
  public static optionalStringArray(value: unknown, fieldName: string): string[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
      throw new ValidationError(`Field '${fieldName}' must be an array of strings`);
    }
    return value.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  /**
   * Validate email format.
   */
  public static requireEmail(value: unknown, fieldName: string = "email"): string {
    const str = this.requireString(value, fieldName);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(str)) {
      throw new ValidationError(`Field '${fieldName}' must be a valid email address`);
    }
    return str.toLowerCase();
  }

  /**
   * Validate an ID format.
   */
  public static requireId(value: unknown, fieldName: string = "id"): string {
    const str = this.requireString(value, fieldName);
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(str)) {
      throw new ValidationError(`Field '${fieldName}' contains invalid characters. Must be 3-64 alphanumeric characters, dashes, or underscores`);
    }
    return str;
  }

  /**
   * Normalize an incoming currency identifier or return undefined if ambiguous/unsupported.
   * Standardizes strings to ISO 4217 standard codes (e.g., 'NGN', 'USD', 'GBP', 'EUR', 'GHS').
   */
  public static normalizeCurrency(value: unknown): SupportedCurrency | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const upper = trimmed.toUpperCase();
    if (SUPPORTED_CURRENCIES.includes(upper as SupportedCurrency)) {
      return upper as SupportedCurrency;
    }

    const lower = trimmed.toLowerCase();
    return CURRENCY_NORMALIZATION_MAP[lower];
  }

  /**
   * Ensure value is a valid, supported ISO 4217 currency.
   * Rejects missing, empty, malformed, or unsupported currencies with ValidationError.
   */
  public static requireCurrency(value: unknown, fieldName: string = "currency"): SupportedCurrency {
    if (value === undefined || value === null || value === "") {
      throw new ValidationError(`Field '${fieldName}' is required and must be a supported ISO currency`);
    }
    const normalized = this.normalizeCurrency(value);
    if (!normalized) {
      throw new ValidationError(
        `Invalid or unsupported currency '${String(value)}' for '${fieldName}'. Supported ISO currencies: [${SUPPORTED_CURRENCIES.join(", ")}]`
      );
    }
    return normalized;
  }

  /**
   * Validate a monetary amount (must be finite, non-negative number).
   */
  public static requireMonetaryAmount(value: unknown, fieldName: string = "amount"): number {
    return this.requireNumber(value, fieldName, { min: 0 });
  }

  /**
   * Verify valid state machine transition.
   */
  public static validateStateTransition<T extends string>(
    current: T,
    next: T,
    allowedTransitions: Record<T, T[]>,
    entityName: string = "Entity"
  ): void {
    const allowed = allowedTransitions[current] || [];
    if (!allowed.includes(next)) {
      throw new InvalidStateTransitionError(entityName, current, next, allowed);
    }
  }

  /**
   * Validate and normalize a query limit using centralized bounds [1, MAX_PAGE_SIZE].
   */
  public static normalizeQueryLimit(limit: unknown, options?: { strict?: boolean; defaultSize?: number; maxSize?: number; fieldName?: string }): number {
    return normalizeQueryLimit(limit, options);
  }

  /**
   * Strict validation of a query limit. Rejects values > MAX_PAGE_SIZE.
   */
  public static requireQueryLimit(limit: unknown, fieldName: string = "limit"): number {
    return normalizeQueryLimit(limit, { strict: true, fieldName });
  }

  /**
   * Validate and normalize a query offset / skip value.
   */
  public static normalizeQueryOffset(offset: unknown, fieldName: string = "offset"): number {
    return normalizeQueryOffset(offset, { fieldName });
  }

  /**
   * Validates sort configuration against a domain whitelist of allowed fields.
   */
  public static validateSort<T extends string>(
    sort: unknown,
    allowedFields: readonly T[],
    options?: { strict?: boolean; fieldName?: string }
  ): SortOptions<T> | undefined {
    return validateSortOptions(sort, allowedFields, options);
  }
}
