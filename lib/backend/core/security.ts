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
import { defaultSessionStore, ISessionStore } from "../domains/auth/authProvider";

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
  lastActivityAt?: string;
  sessionVersion?: number;
  ipAddress?: string;
  userAgent?: string;
}

export async function createSessionToken(
  user: { id: string; email: string; name: string },
  org: { id: string; name: string },
  role: string
): Promise<AuthSession> {
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS["Operations"];
  return defaultSessionStore.createSession({
    user,
    org,
    role,
    permissions,
  });
}

export async function getSession(token: string): Promise<AuthSession | undefined> {
  return defaultSessionStore.getSession(token);
}

export async function revokeSession(token: string): Promise<boolean> {
  return defaultSessionStore.revokeSession(token);
}

/**
 * Helper to parse cookie string from headers
 */
function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader || typeof cookieHeader !== "string") return {};
  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      const key = pair.substring(0, idx).trim();
      const val = pair.substring(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

/**
 * Resolve the authenticated Tenant Context from request headers or HttpOnly cookies.
 * 
 * Rules:
 * 1. Checks Authorization: Bearer <token> first, then fallback to apex_session cookie.
 * 2. Missing, invalid, or expired session token strictly throws UnauthorizedError (401).
 * 3. In production mode, demo fallback is unconditionally disabled (even if DEMO_MODE=true).
 * 4. Client headers or body cannot override the trusted organizationId established by authenticated session.
 */
export async function resolveTenantContext(
  headers: Headers | Record<string, string | string[] | undefined>,
  sessionStore: ISessionStore = defaultSessionStore
): Promise<TenantContext> {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  // 1. Extract authorization header or cookie
  let authHeader: string | undefined;
  let cookieHeader: string | undefined;

  if (headers instanceof Headers) {
    authHeader = headers.get("authorization") || undefined;
    cookieHeader = headers.get("cookie") || undefined;
  } else {
    const rawAuth = headers["authorization"] || headers["Authorization"];
    authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
    const rawCookie = headers["cookie"] || headers["Cookie"];
    cookieHeader = Array.isArray(rawCookie) ? rawCookie[0] : rawCookie;
  }

  let token: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      throw new UnauthorizedError("Authentication required: Empty Bearer token");
    }
  } else if (cookieHeader) {
    const parsedCookies = parseCookieHeader(cookieHeader);
    if (parsedCookies["apex_session"]) {
      token = parsedCookies["apex_session"].trim();
    }
  }

  // If no token could be extracted
  if (!token) {
    // Production safeguard: Demo mode is NEVER allowed in production environment
    const isProduction = process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
    const isExplicitDevDemo =
      !isProduction &&
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

    throw new UnauthorizedError("Authentication required: Missing Authorization Bearer token or session cookie");
  }

  const session = await sessionStore.getSession(token);
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
