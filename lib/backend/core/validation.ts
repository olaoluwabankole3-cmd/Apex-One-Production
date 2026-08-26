/**
 * APEX ONE — Request & Data Runtime Validation Engine
 * 
 * Performs strict type, format, length, enum, and state-transition validation
 * on untrusted incoming HTTP request payloads before reaching domain services.
 */

import { ValidationError, InvalidStateTransitionError } from "./errors";

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
}
