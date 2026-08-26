/**
 * APEX ONE — Backend Core Security, Errors, and Tenant Context
 * 
 * Strict Multi-Tenancy Rules:
 * 1. The client-provided tenantId is NEVER trusted.
 * 2. Authenticated identity establishes the Tenant Context.
 * 3. Every service and repository MUST accept and enforce TenantContext.
 */

export interface TenantContext {
  organizationId: string;
  userId: string;
  userEmail: string;
  userRole: string;
  permissions: string[];
  isSuperAdmin?: boolean;
  requestId: string;
  timestamp: string;
}

export type PermissionCapability =
  | "org:read"
  | "org:write"
  | "org:admin"
  | "customer:read"
  | "customer:write"
  | "customer:delete"
  | "financial:read"
  | "financial:write"
  | "document:read"
  | "document:write"
  | "document:delete"
  | "knowledge:read"
  | "knowledge:write"
  | "workflow:read"
  | "workflow:write"
  | "workflow:execute"
  | "ai:execute"
  | "value:read"
  | "value:write"
  | "value:approve"
  | "action:create"
  | "action:approve"
  | "action:execute"
  | "action:cancel"
  | "audit:read";

export class BackendError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(message: string, statusCode: number = 500, code: string = "INTERNAL_SERVER_ERROR", details?: unknown) {
    super(message);
    this.name = "BackendError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class UnauthorizedError extends BackendError {
  constructor(message: string = "Authentication required: Missing or invalid credentials") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends BackendError {
  constructor(message: string = "You do not have permission to perform this action in this tenant") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends BackendError {
  constructor(resource: string = "Resource") {
    // Avoid leaking whether a resource exists in another organization
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

export class ValidationError extends BackendError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class ConflictError extends BackendError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "CONFLICT", details);
  }
}

export class InvalidStateTransitionError extends BackendError {
  constructor(entity: string, current: string, requested: string, allowed: readonly string[]) {
    super(
      `Cannot transition ${entity} from '${current}' to '${requested}'. Allowed transitions: [${allowed.join(", ")}]`,
      400,
      "INVALID_STATE_TRANSITION",
      { entity, current, requested, allowed }
    );
  }
}

export class CrossTenantViolationError extends BackendError {
  constructor(attemptedOrgId: string, actualOrgId: string) {
    // We log the detailed attemptedOrgId internally, but keep client message clean
    super(
      `Resource not found or access denied for this organization`,
      404,
      "CROSS_TENANT_VIOLATION",
      { attemptedOrgId, actualOrgId }
    );
  }
}

export class ExternalServiceFailureError extends BackendError {
  constructor(serviceName: string, reason: string) {
    super(
      `External service failure (${serviceName}): ${reason}`,
      502,
      "EXTERNAL_SERVICE_FAILURE",
      { serviceName, reason }
    );
  }
}

export class InsufficientDataError extends BackendError {
  constructor(domain: string, missingRequirements: string[]) {
    super(
      `Insufficient organizational evidence in ${domain} to compute high-confidence metric`,
      422,
      "INSUFFICIENT_DATA",
      { domain, missingRequirements }
    );
  }
}
