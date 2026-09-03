/**
 * APEX ONE — Security, Authentication Tokens, and Tenant Context Resolver
 *
 * Security invariants:
 *
 * 1. Authentication establishes the trusted tenant context.
 * 2. Client-supplied organization identifiers are never trusted by this module.
 * 3. Unknown roles fail closed and receive no permissions.
 * 4. Authorization checks are capability-based.
 * 5. Production authentication never falls back to demo identity.
 * 6. This module does not statically import the authentication provider.
 *    This prevents a runtime circular dependency:
 *
 *      security.ts → authProvider.ts → security.ts
 *
 * 7. Session tokens are treated as opaque credentials.
 * 8. Malformed authentication input fails with 401 rather than leaking
 *    implementation errors.
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
import type { ISessionStore } from "../domains/auth/authProvider";
import { normalizeRequestId } from "../observability/telemetry";

export type { TenantContext, PermissionCapability };

export {
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  CrossTenantViolationError,
};

/**
 * Canonical application roles currently supported by the backend.
 *
 * IMPORTANT:
 * Do not add a fallback role here.
 * An unrecognized role must fail closed.
 */
export const ROLE_PERMISSIONS = {
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
} as const satisfies Record<string, readonly PermissionCapability[]>;

export type ApplicationRole = keyof typeof ROLE_PERMISSIONS;

export const AUTH_COOKIE_NAME = "apex_session";

const DEFAULT_SESSION_TTL_SECONDS = 86_400; // 24 hours
const MAX_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface SessionCookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
  expires?: Date;
}

/**
 * Returns whether the current process is explicitly operating in production.
 */
function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.APP_ENV === "production"
  );
}

/**
 * Returns whether explicit development-only demo authentication is enabled.
 *
 * Demo authentication is deliberately impossible when the process is marked
 * as production.
 */
function isDevelopmentDemoAuthenticationEnabled(): boolean {
  if (isProductionEnvironment()) {
    return false;
  }

  const isDevelopment =
    process.env.NODE_ENV === "development" ||
    process.env.APP_ENV === "development";

  return isDevelopment && process.env.DEMO_MODE === "true";
}

/**
 * Validate and normalize a session TTL.
 *
 * Missing TTL uses the secure default.
 * Invalid, zero, negative, fractional, or excessive values are rejected
 * instead of silently producing an invalid cookie.
 */
function normalizeSessionTtl(ttlSeconds: number): number {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new ValidationError(
      "Session TTL must be a positive integer number of seconds"
    );
  }

  if (ttlSeconds > MAX_SESSION_TTL_SECONDS) {
    throw new ValidationError(
      `Session TTL cannot exceed ${MAX_SESSION_TTL_SECONDS} seconds`
    );
  }

  return ttlSeconds;
}

export function getSessionCookieOptions(
  ttlSeconds: number = DEFAULT_SESSION_TTL_SECONDS
): Omit<SessionCookieOptions, "value"> {
  const normalizedTtl = normalizeSessionTtl(ttlSeconds);

  const isProduction = isProductionEnvironment();

  return {
    name: AUTH_COOKIE_NAME,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: normalizedTtl,
    expires: new Date(Date.now() + normalizedTtl * 1000),
  };
}

export function getClearSessionCookieOptions(): SessionCookieOptions {
  const isProduction = isProductionEnvironment();

  return {
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };
}

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

/**
 * Returns true only for a currently supported application role.
 */
export function isApplicationRole(role: unknown): role is ApplicationRole {
  return typeof role === "string" && role in ROLE_PERMISSIONS;
}

/**
 * Resolve permissions for a role.
 *
 * SECURITY REQUIREMENT:
 * Unknown roles MUST fail closed.
 *
 * We intentionally do NOT return Operations or any other default role.
 */
export function getPermissionsForRole(
  role: unknown
): readonly PermissionCapability[] {
  if (!isApplicationRole(role)) {
    throw new ValidationError(
      `Unsupported application role '${String(role)}'`
    );
  }

  return ROLE_PERMISSIONS[role];
}

/**
 * Resolve the session authority already composed for the default auth service.
 * The dynamic import preserves the core-security/auth module boundary while
 * ensuring local in-memory sessions are not replaced between requests. In
 * production the service's session provider was created by the Stage 4F
 * composition factory and therefore resolves to Redis.
 */
async function getAuthoritativeApplicationSessionStore(): Promise<ISessionStore> {
  const { authService } = await import("../domains/auth/authService");
  return authService.getAuthoritativeSessionStore();
}

/**
 * Create an authenticated session through the authoritative application session store.
 */
export async function createSessionToken(
  user: { id: string; email: string; name: string },
  org: { id: string; name: string },
  role: string
): Promise<AuthSession> {
  const permissions = getPermissionsForRole(role);
  const sessionStore = await getAuthoritativeApplicationSessionStore();

  return sessionStore.createSession({
    user,
    org,
    role,
    permissions: [...permissions],
  });
}

/**
 * Retrieve a session through the authoritative application session store.
 */
export async function getSession(
  token: string
): Promise<AuthSession | undefined> {
  const normalizedToken = normalizeSessionToken(token);

  if (!normalizedToken) {
    return undefined;
  }

  const sessionStore = await getAuthoritativeApplicationSessionStore();
  return sessionStore.getSession(normalizedToken);
}

/**
 * Revoke a session through the authoritative application session store.
 */
export async function revokeSession(token: string): Promise<boolean> {
  const normalizedToken = normalizeSessionToken(token);

  if (!normalizedToken) {
    return false;
  }

  const sessionStore = await getAuthoritativeApplicationSessionStore();
  return sessionStore.revokeSession(normalizedToken);
}

/**
 * Validate an opaque session token.
 *
 * We deliberately do not impose a token format here because the session
 * provider owns token generation. This function only rejects empty input.
 */
function normalizeSessionToken(token: unknown): string | undefined {
  if (typeof token !== "string") {
    return undefined;
  }

  const normalized = token.trim();

  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Safely parse an HTTP Cookie header.
 *
 * Malformed percent-encoding is ignored rather than allowed to escape as a
 * URIError and become a 500 response.
 */
function parseCookieHeader(
  cookieHeader?: string
): Record<string, string> {
  if (!cookieHeader || typeof cookieHeader !== "string") {
    return {};
  }

  const cookies: Record<string, string> = {};

  for (const pair of cookieHeader.split(";")) {
    const trimmedPair = pair.trim();

    if (!trimmedPair) {
      continue;
    }

    const separatorIndex = trimmedPair.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedPair.slice(0, separatorIndex).trim();
    const rawValue = trimmedPair.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    let value: string;

    try {
      value = decodeURIComponent(rawValue);
    } catch {
      // Malformed cookie values are treated as unusable credentials.
      continue;
    }

    cookies[key] = value;
  }

  return cookies;
}

/**
 * Extract a single request header from either a Fetch Headers object or the
 * plain object shape used by some Node/server adapters.
 */
function getHeaderValue(
  headers: Headers | Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  if (headers instanceof Headers) {
    const value = headers.get(name);
    return value ?? undefined;
  }

  const directValue = headers[name];
  const alternateValue =
    headers[name.toLowerCase()] ?? headers[name[0].toUpperCase() + name.slice(1)];

  const value = directValue ?? alternateValue;

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

/**
 * Extract a bearer token from an Authorization header.
 *
 * The authentication scheme is case-insensitive.
 */
function extractBearerToken(
  authorizationHeader?: string
): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const trimmed = authorizationHeader.trim();

  if (!trimmed) {
    throw new UnauthorizedError("Authentication required: Empty Authorization header");
  }

  const separatorIndex = trimmed.indexOf(" ");

  if (separatorIndex <= 0) {
    throw new UnauthorizedError("Authentication failed: Invalid Authorization header");
  }

  const scheme = trimmed.slice(0, separatorIndex);
  const credentials = trimmed.slice(separatorIndex + 1).trim();

  if (scheme.toLowerCase() !== "bearer") {
    throw new UnauthorizedError("Authentication failed: Unsupported authorization scheme");
  }

  if (!credentials) {
    throw new UnauthorizedError("Authentication required: Empty Bearer token");
  }

  return normalizeSessionToken(credentials);
}

/**
 * Resolve the authenticated Tenant Context from request headers or an
 * HttpOnly session cookie.
 *
 * TRUST BOUNDARY:
 *
 * organizationId comes exclusively from the authenticated session.
 * This function never reads organizationId from request body, query string,
 * or arbitrary client headers.
 *
 * Authentication precedence:
 *
 * 1. Authorization: Bearer <token>
 * 2. apex_session cookie
 *
 * If an Authorization header is present but malformed, authentication fails
 * rather than silently falling back to a cookie.
 */
export async function resolveTenantContext(
  headers: Headers | Record<string, string | string[] | undefined>,
  sessionStore?: ISessionStore
): Promise<TenantContext> {
  const requestId =
    normalizeRequestId(getHeaderValue(headers, "x-request-id")) || generateRequestId();
  const timestamp = new Date().toISOString();

  const authorizationHeader = getHeaderValue(headers, "authorization");
  const cookieHeader = getHeaderValue(headers, "cookie");

  let token: string | undefined;

  if (authorizationHeader !== undefined) {
    token = extractBearerToken(authorizationHeader);
  } else if (cookieHeader !== undefined) {
    const cookies = parseCookieHeader(cookieHeader);
    token = normalizeSessionToken(cookies[AUTH_COOKIE_NAME]);
  }

  /**
   * Explicit development demo mode is the only unauthenticated path.
   *
   * This is intentionally impossible in production.
   */
  if (!token) {
    if (isDevelopmentDemoAuthenticationEnabled()) {
      return {
        organizationId: "apex-demo",
        userId: "usr-marcus-thorne",
        userEmail: "m.thorne@apexsync.ai",
        userRole: "CEO",
        permissions: [...ROLE_PERMISSIONS.CEO],
        requestId,
        timestamp,
      };
    }

    throw new UnauthorizedError(
      "Authentication required: Missing Authorization Bearer token or session cookie"
    );
  }

  const store = sessionStore ?? await getAuthoritativeApplicationSessionStore();
  const session = await store.getSession(token);

  if (!session) {
    throw new UnauthorizedError(
      "Authentication failed: Invalid or expired session token"
    );
  }

  /**
   * A session is trusted only after it has been returned by the authoritative
   * session store. We still validate its security-critical fields before
   * creating the tenant context.
   */
  if (
    typeof session.userId !== "string" ||
    session.userId.trim().length === 0 ||
    typeof session.organizationId !== "string" ||
    session.organizationId.trim().length === 0 ||
    typeof session.userEmail !== "string" ||
    session.userEmail.trim().length === 0 ||
    typeof session.role !== "string" ||
    session.role.trim().length === 0
  ) {
    throw new UnauthorizedError(
      "Authentication failed: Invalid session identity"
    );
  }

  /**
   * Never accept an unknown role as a legitimate authorization role.
   */
  if (!isApplicationRole(session.role)) {
    throw new UnauthorizedError(
      "Authentication failed: Session contains an unsupported role"
    );
  }

  /**
   * Session permissions are intentionally preserved here because the session
   * store is authoritative for the issued session.
   *
   * However, the role must always be known. An unknown role can never create
   * a tenant context.
   */
  const permissions = Array.isArray(session.permissions)
    ? session.permissions.filter(
        (permission): permission is PermissionCapability =>
          typeof permission === "string" &&
          (Object.values(ROLE_PERMISSIONS).flat() as readonly string[]).includes(
            permission
          )
      )
    : [];

  return {
    organizationId: session.organizationId,
    userId: session.userId,
    userEmail: session.userEmail,
    userRole: session.role,
    permissions,
    requestId,
    timestamp,
  };
}

/**
 * Verify that the TenantContext possesses a required permission capability.
 *
 * This function fails closed:
 * - missing context → ForbiddenError
 * - missing permissions → ForbiddenError
 * - unknown runtime capability → ForbiddenError
 */
export function requirePermission(
  ctx: TenantContext,
  permission: PermissionCapability
): void {
  if (!ctx || !Array.isArray(ctx.permissions)) {
    throw new ForbiddenError("Authorization context is invalid");
  }

  if (!ctx.permissions.includes(permission)) {
    throw new ForbiddenError(
      `Missing required capability '${permission}' for role '${ctx.userRole}'`
    );
  }
}
