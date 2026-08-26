/**
 * APEX ONE — Security, Authentication Tokens, and Context Resolver
 */

import {
  type TenantContext,
  type PermissionCapability,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  CrossTenantViolationError,
} from "./errors";
import { generateSecureRequestId } from "./crypto";
import { defaultSessionStore } from "../domains/auth/authProvider";

export type { TenantContext, PermissionCapability };
export {
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  CrossTenantViolationError,
};

// Role-to-Permission capabilities matrix
export const ROLE_PERMISSIONS: Record<string, PermissionCapability[]> = {
  CEO: [
    "org:read",
    "org:write",
    "org:admin",
    "customer:read",
    "customer:write",
    "customer:delete",
    "financial:read",
    "financial:write",
    "document:read",
    "document:write",
    "document:delete",
    "knowledge:read",
    "knowledge:write",
    "workflow:read",
    "workflow:write",
    "workflow:execute",
    "ai:execute",
    "value:read",
    "value:write",
    "value:approve",
    "action:create",
    "action:approve",
    "action:execute",
    "action:cancel",
    "audit:read",
  ],
  Operations: [
    "org:read",
    "customer:read",
    "customer:write",
    "document:read",
    "document:write",
    "knowledge:read",
    "knowledge:write",
    "workflow:read",
    "workflow:write",
    "workflow:execute",
    "ai:execute",
    "value:read",
    "value:write",
    "action:create",
    "action:execute",
    "audit:read",
  ],
  "Relationship Manager": [
    "org:read",
    "customer:read",
    "customer:write",
    "document:read",
    "document:write",
    "knowledge:read",
    "ai:execute",
    "value:read",
    "action:create",
  ],
  Compliance: [
    "org:read",
    "customer:read",
    "financial:read",
    "document:read",
    "knowledge:read",
    "audit:read",
    "ai:execute",
    "value:read",
  ],
  "Customer Service": [
    "org:read",
    "customer:read",
    "document:read",
    "knowledge:read",
    "ai:execute",
  ],
  "Customer / Investor": [
    "customer:read",
    "document:read",
    "knowledge:read",
    "value:read",
  ],
  Administrator: [
    "org:read",
    "org:write",
    "org:admin",
    "customer:read",
    "customer:write",
    "customer:delete",
    "financial:read",
    "financial:write",
    "document:read",
    "document:write",
    "document:delete",
    "knowledge:read",
    "knowledge:write",
    "workflow:read",
    "workflow:write",
    "workflow:execute",
    "ai:execute",
    "value:read",
    "value:write",
    "value:approve",
    "action:create",
    "action:approve",
    "action:execute",
    "action:cancel",
    "audit:read",
  ],
};

export function generateRequestId(): string {
  return generateSecureRequestId();
}

export interface AuthSession {
  token: string;
  userId: string;
  userEmail: string;
  userName: string;
  organizationId: string;
  organizationName: string;
  role: string;
  permissions: PermissionCapability[];
  createdAt: string;
  expiresAt: string;
}

export async function createSessionToken(
  user: { id: string; email: string; name: string },
  org: { id: string; name: string },
  role: string
): Promise<AuthSession> {
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS["Operations"];
  return defaultSessionStore.createSession(user, org, role, permissions);
}

export async function getSession(token: string): Promise<AuthSession | undefined> {
  return defaultSessionStore.getSession(token);
}

export async function revokeSession(token: string): Promise<boolean> {
  return defaultSessionStore.revokeSession(token);
}

/**
 * Resolve the authenticated Tenant Context from request headers.
 * 
 * Rules:
 * 1. Missing or invalid Bearer token strictly throws UnauthorizedError (401).
 * 2. No automatic demo fallback in production.
 * 3. Client headers cannot override the trusted organizationId established by authentication.
 */
export async function resolveTenantContext(
  headers: Headers | Record<string, string | string[] | undefined>
): Promise<TenantContext> {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  // Extract authorization header
  let authHeader: string | undefined;
  if (headers instanceof Headers) {
    authHeader = headers.get("authorization") || undefined;
  } else {
    const raw = headers["authorization"] || headers["Authorization"];
    authHeader = Array.isArray(raw) ? raw[0] : raw;
  }

  // Strict check: if no Bearer token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Only allow development-specific demo mode if explicitly activated via environment variables
    const isExplicitDevDemo =
      (process.env.APP_ENV === "development" || process.env.NODE_ENV === "development") &&
      process.env.DEMO_MODE === "true";

    if (isExplicitDevDemo) {
      return {
        organizationId: "apex-demo",
        userId: "usr-marcus-thorne",
        userEmail: "m.thorne@apexsync.ai",
        userRole: "CEO",
        permissions: ROLE_PERMISSIONS["CEO"],
        requestId,
        timestamp,
      };
    }

    throw new UnauthorizedError("Authentication required: Missing or invalid Bearer token");
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    throw new UnauthorizedError("Authentication required: Empty Bearer token");
  }

  const session = await defaultSessionStore.getSession(token);
  if (!session) {
    throw new UnauthorizedError("Authentication failed: Invalid or expired session token");
  }

  return {
    organizationId: session.organizationId,
    userId: session.userId,
    userEmail: session.userEmail,
    userRole: session.role,
    permissions: session.permissions,
    requestId,
    timestamp,
  };
}

/**
 * Verify that the TenantContext possesses a required permission capability.
 */
export function requirePermission(ctx: TenantContext, permission: PermissionCapability) {
  if (!ctx.permissions || !ctx.permissions.includes(permission)) {
    throw new ForbiddenError(`Missing required capability '${permission}' for role '${ctx.userRole}'`);
  }
}
