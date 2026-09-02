/**
 * APEX ONE — Auth & Identity Domain Service
 */

import { db, DatabaseStore } from "../../database/store";
import {
  defaultAuthProvider,
  defaultSessionStore,
  IAuthenticationProvider,
  ISessionStore,
} from "./authProvider";
import { defaultAuthRateLimiter, IRateLimiter } from "./rateLimiter";
import {
  AuthSession,
  getPermissionsForRole,
} from "../../core/security";
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
import {
  AuthSessionMetadataDto,
  SafeAuthOrganization,
  buildAuthSessionMetadata,
  sanitizeAvailableOrganizations,
} from "./authSessionContract";

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

export interface AuthenticatedSessionResult {
  session: AuthSession;
  availableOrganizations: SafeAuthOrganization[];
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

  private getAvailableOrganizationsForUser(userId: string): SafeAuthOrganization[] {
    const organizations = Array.from(this.database.memberships.values())
      .filter((membership) => membership.userId === userId)
      .flatMap((membership) => {
        const organization = this.database.organizations.get(membership.organizationId);
        if (!organization) return [];
        return [{ id: organization.id, name: organization.name }];
      });

    return sanitizeAvailableOrganizations(organizations);
  }

  public async login(
    dto: LoginDto,
    requestId: string,
    options?: LoginOptions
  ): Promise<AuthenticatedSessionResult> {
    if (!dto.email || typeof dto.email !== "string" || dto.email.trim().length === 0) {
      throw new ValidationError("Email address is required");
    }

    if (!dto.password || typeof dto.password !== "string" || dto.password.length === 0) {
      throw new ValidationError("Password is required");
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const rateLimitKey = options?.ipAddress ? `${options.ipAddress}:${normalizedEmail}` : normalizedEmail;

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

      return {
        session: authResult.session,
        availableOrganizations: sanitizeAvailableOrganizations(authResult.availableOrganizations),
      };
    } catch (err: any) {
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

  public async changePassword(dto: ChangePasswordDto, ctx: TenantContext): Promise<boolean> {
    if (!dto.userId || !dto.currentPassword || !dto.newPassword) {
      throw new ValidationError("User ID, current password, and new password are required");
    }

    if (ctx.userId !== dto.userId && !ctx.permissions.includes("org:admin")) {
      throw new ForbiddenError("You are not authorized to change credentials for another user");
    }

    const user = await this.authIdentityRepository.findUserById(dto.userId, ctx);

    if (!user.passwordHash || !user.passwordSalt) {
      throw new UnauthorizedError("Current credentials invalid");
    }
    const isCurrentValid = verifyPassword(dto.currentPassword, user.passwordHash, user.passwordSalt);
    if (!isCurrentValid) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    const policyResult = validatePasswordPolicy(dto.newPassword);
    if (!policyResult.valid) {
      throw new ValidationError(policyResult.error || "Password does not meet enterprise policy requirements");
    }

    const newCredentials = hashPassword(dto.newPassword);
    const updatedUser = await this.authIdentityRepository.updatePasswordCredentials(
      user.id,
      {
        passwordHash: newCredentials.hash,
        passwordSalt: newCredentials.salt,
      },
      ctx
    );

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

  public async getCurrentSession(
    ctx: TenantContext,
    sessionToken?: string
  ): Promise<AuthSessionMetadataDto> {
    const user = this.database.users.get(ctx.userId);
    const organization = this.database.organizations.get(ctx.organizationId);
    const membership = this.database.getUserMembership(ctx.userId, ctx.organizationId);

    if (!user || !organization || !membership) {
      throw new UnauthorizedError("Authenticated session is no longer valid");
    }

    const availableOrganizations = this.getAvailableOrganizationsForUser(ctx.userId);

    if (sessionToken) {
      const session = await this.sessionStore.getSession(sessionToken);
      if (
        !session ||
        session.userId !== ctx.userId ||
        session.organizationId !== ctx.organizationId
      ) {
        throw new UnauthorizedError("Authenticated session is no longer valid");
      }

      return buildAuthSessionMetadata(session, availableOrganizations);
    }

    return {
      user: {
        id: ctx.userId,
        email: ctx.userEmail,
        name: user.name || ctx.userEmail,
        role: ctx.userRole,
        permissions: [...ctx.permissions],
      },
      organization: {
        id: organization.id,
        name: organization.name,
      },
      availableOrganizations,
      expiresAt: null,
    };
  }

  public async switchOrganization(
    targetOrgId: string,
    ctx: TenantContext,
    currentSessionToken?: string
  ): Promise<AuthenticatedSessionResult> {
    const memberships = Array.from(this.database.memberships.values()).filter(
      (membership) => membership.userId === ctx.userId
    );
    const match = memberships.find((membership) => membership.organizationId === targetOrgId);

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
      throw new ForbiddenError(
        `Cannot switch to organization ${targetOrgId}: user is not an authorized member.`
      );
    }

    const organization = this.database.organizations.get(targetOrgId);
    if (!organization) {
      throw new NotFoundError("Target organization");
    }

    const user = this.database.users.get(ctx.userId);
    if (!user) {
      throw new UnauthorizedError("Authenticated session is no longer valid");
    }

    const permissions = [...getPermissionsForRole(match.role)];
    const session = await this.sessionStore.createSession({
      user: { id: user.id, email: user.email, name: user.name },
      org: { id: organization.id, name: organization.name },
      role: match.role,
      permissions,
    });

    if (currentSessionToken && currentSessionToken !== session.token) {
      await this.sessionStore.revokeSession(currentSessionToken);
    }

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

    return {
      session,
      availableOrganizations: this.getAvailableOrganizationsForUser(user.id),
    };
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
