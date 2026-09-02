/**
 * APEX ONE — Auth & Identity Domain Service
 */

import { db, DatabaseStore } from "../../database/store";
import { defaultAuthProvider, defaultSessionStore, IAuthenticationProvider, ISessionStore } from "./authProvider";
import { defaultAuthRateLimiter, IRateLimiter } from "./rateLimiter";
import { createSessionToken, revokeSession, AuthSession, ROLE_PERMISSIONS } from "../../core/security";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "../../core/crypto";
import {
  TenantContext,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "../../core/errors";
import {
  IAuthIdentityRepository,
  TenantScopedAuthIdentityRepository,
} from "./authIdentityRepository";

export interface LoginDto {
  email: string;
  password: string;
  targetOrganizationId?: string;
}

export interface ChangePasswordDto {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface LoginOptions {
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  private readonly authIdentityRepository: IAuthIdentityRepository;

  constructor(
    private readonly database: DatabaseStore = db,
    private readonly authProvider: IAuthenticationProvider = defaultAuthProvider,
    private readonly sessionStore: ISessionStore = defaultSessionStore,
    private readonly rateLimiter: IRateLimiter = defaultAuthRateLimiter,
    authIdentityRepository?: IAuthIdentityRepository
  ) {
    this.authIdentityRepository =
      authIdentityRepository ?? new TenantScopedAuthIdentityRepository(database);
  }

  /**
   * Authenticate a user, verify organization membership, enforce rate limiting,
   * and issue a tenant-scoped session token.
   */
  public async login(
    dto: LoginDto,
    requestId: string,
    options?: LoginOptions
  ): Promise<{ session: AuthSession; availableOrganizations: any[] }> {
    if (!dto.email || typeof dto.email !== "string" || dto.email.trim().length === 0) {
      throw new ValidationError("Email address is required");
    }

    if (!dto.password || typeof dto.password !== "string" || dto.password.length === 0) {
      throw new ValidationError("Password is required");
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const rateLimitKey = options?.ipAddress ? `${options.ipAddress}:${normalizedEmail}` : normalizedEmail;

    // 1. Enforce rate limiting to protect against brute-force attacks
    const rateLimitResult = await this.rateLimiter.isRateLimited(rateLimitKey);
    if (rateLimitResult.limited) {
      this.database.recordAuditLog({
        organizationId: "system",
        actorId: "unauthenticated",
        actorEmail: normalizedEmail.substring(0, 80),
        action: "auth:rate_limited",
        resource: "Session",
        resourceId: "rate_limit_lockout",
        requestId,
        status: "denied",
        metadata: {
          retryAfterSeconds: rateLimitResult.retryAfterSeconds,
          totalAttempts: rateLimitResult.totalAttempts,
          ip: options?.ipAddress,
        },
      });
      throw new UnauthorizedError(
        `Too many failed login attempts. Please try again in ${rateLimitResult.retryAfterSeconds ?? 900} seconds.`
      );
    }

    try {
      const authResult = await this.authProvider.authenticateCredentials(
        normalizedEmail,
        dto.password,
        dto.targetOrganizationId,
        options
      );

      // Reset rate limiter on successful authentication
      await this.rateLimiter.recordAttempt(rateLimitKey, true);

      this.database.recordAuditLog({
        organizationId: authResult.session.organizationId,
        actorId: authResult.session.userId,
        actorEmail: authResult.session.userEmail,
        action: "auth:login",
        resource: "Session",
        resourceId: authResult.session.token.substring(0, 10) + "...",
        requestId,
        status: "success",
        metadata: {
          role: authResult.session.role,
          organization: authResult.session.organizationName,
          ip: options?.ipAddress,
        },
      });

      return authResult;
    } catch (err: any) {
      // Record failed attempt for rate limiting
      await this.rateLimiter.recordAttempt(rateLimitKey, false);

      this.database.recordAuditLog({
        organizationId: "system",
        actorId: "unauthenticated",
        actorEmail: normalizedEmail.substring(0, 80),
        action: "auth:login_failed",
        resource: "Session",
        resourceId: "login_attempt",
        requestId,
        status: "denied",
        metadata: { reason: "Authentication rejected", ip: options?.ipAddress },
      });
      throw err;
    }
  }

  /**
   * Change a user password with cryptographic verification of the current password,
   * enterprise policy validation, and complete invalidation of prior active sessions.
   *
   * SECURITY INVARIANT:
   * The target identity is resolved and mutated exclusively through the tenant-scoped
   * auth identity repository. org:admin permits changing another user only inside the
   * caller's authenticated organization; it never grants cross-tenant identity access.
   */
  public async changePassword(dto: ChangePasswordDto, ctx: TenantContext): Promise<boolean> {
    if (!dto.userId || !dto.currentPassword || !dto.newPassword) {
      throw new ValidationError("User ID, current password, and new password are required");
    }

    // Only allow users to change their own password unless caller possesses org:admin.
    // Tenant membership is enforced independently by the repository below.
    if (ctx.userId !== dto.userId && !ctx.permissions.includes("org:admin")) {
      throw new ForbiddenError("You are not authorized to change credentials for another user");
    }

    // Tenant-scoped lookup occurs before any credential verification. Cross-tenant
    // targets therefore fail as not-found without revealing whether the user exists
    // or whether the supplied current password is correct.
    const user = await this.authIdentityRepository.findUserById(dto.userId, ctx);

    // Verify current password against stored credentials
    if (!user.passwordHash || !user.passwordSalt) {
      throw new UnauthorizedError("Current credentials invalid");
    }
    const isCurrentValid = verifyPassword(dto.currentPassword, user.passwordHash, user.passwordSalt);
    if (!isCurrentValid) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    // Validate new password against policy
    const policyResult = validatePasswordPolicy(dto.newPassword);
    if (!policyResult.valid) {
      throw new ValidationError(policyResult.error || "Password does not meet enterprise policy requirements");
    }

    // Generate new secure hash and salt
    const newCredentials = hashPassword(dto.newPassword);
    const updatedUser = await this.authIdentityRepository.updatePasswordCredentials(
      user.id,
      {
        passwordHash: newCredentials.hash,
        passwordSalt: newCredentials.salt,
      },
      ctx
    );

    // Invalidate all active sessions for the target user to force re-authentication across all devices
    await this.sessionStore.revokeUserSessions(updatedUser.id);

    this.database.recordAuditLog({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action: "auth:password_change",
      resource: "User",
      resourceId: updatedUser.id,
      requestId: ctx.requestId,
      status: "success",
    });

    return true;
  }

  public async getCurrentSession(ctx: TenantContext): Promise<any> {
    const user = this.database.users.get(ctx.userId);
    const org = this.database.organizations.get(ctx.organizationId);
    return {
      user: {
        id: ctx.userId,
        email: ctx.userEmail,
        name: user?.name || ctx.userEmail,
        role: ctx.userRole,
        permissions: ctx.permissions,
      },
      organization: {
        id: ctx.organizationId,
        name: org?.name || ctx.organizationId,
        currency: org?.currency || "NGN",
        currencySymbol: org?.currencySymbol || "₦",
      },
    };
  }

  public async switchOrganization(targetOrgId: string, ctx: TenantContext): Promise<AuthSession> {
    const memberships = Array.from(this.database.memberships.values()).filter((m) => m.userId === ctx.userId);
    const match = memberships.find((m) => m.organizationId === targetOrgId);
    if (!match) {
      this.database.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "auth:switch_organization_denied",
        resource: "Organization",
        resourceId: targetOrgId,
        requestId: ctx.requestId,
        status: "denied",
        metadata: { attemptedOrg: targetOrgId },
      });
      throw new ForbiddenError(`Cannot switch to organization ${targetOrgId}: user is not an authorized member.`);
    }

    const org = this.database.organizations.get(targetOrgId);
    if (!org) {
      throw new NotFoundError("Target organization");
    }

    const user = this.database.users.get(ctx.userId)!;
    const session = await this.sessionStore.createSession({
      user: { id: user.id, email: user.email, name: user.name },
      org: { id: org.id, name: org.name },
      role: match.role,
      permissions: ROLE_PERMISSIONS[match.role] || ROLE_PERMISSIONS["Operations"],
    });

    this.database.recordAuditLog({
      organizationId: targetOrgId,
      actorId: user.id,
      actorEmail: user.email,
      action: "auth:switch_organization",
      resource: "Organization",
      resourceId: targetOrgId,
      requestId: ctx.requestId,
      status: "success",
      metadata: { previousOrg: ctx.organizationId, newRole: match.role },
    });

    return session;
  }

  public async logout(token: string, ctx?: TenantContext): Promise<boolean> {
    await this.sessionStore.revokeSession(token);
    if (ctx) {
      this.database.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "auth:logout",
        resource: "Session",
        resourceId: token.substring(0, 10) + "...",
        requestId: ctx.requestId,
        status: "success",
      });
    }
    return true;
  }
}

export const authService = new AuthService();
