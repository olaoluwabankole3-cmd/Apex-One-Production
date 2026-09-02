/**
 * APEX ONE — Tenant-Scoped Authentication Identity Repository
 *
 * Password/credential operations are identity-sensitive and MUST prove that the
 * target user is a member of the authenticated organization before reading or
 * mutating credential material.
 */

import type { DatabaseStore } from "../../database/store";
import type { UserRecord } from "../../database/schema";
import { NotFoundError, type TenantContext } from "../../core/errors";

export interface PasswordCredentialUpdate {
  passwordHash: string;
  passwordSalt: string;
}

export interface IAuthIdentityRepository {
  findUserById(userId: string, ctx: TenantContext): Promise<UserRecord>;
  updatePasswordCredentials(
    userId: string,
    credentials: PasswordCredentialUpdate,
    ctx: TenantContext
  ): Promise<UserRecord>;
}

/**
 * In-memory implementation of the auth identity repository.
 *
 * SECURITY INVARIANT:
 * Membership in ctx.organizationId is checked before the global user map is
 * consulted. A caller therefore cannot use this repository to discover whether
 * a user ID exists in another tenant.
 */
export class TenantScopedAuthIdentityRepository implements IAuthIdentityRepository {
  constructor(private readonly database: DatabaseStore) {}

  private async requireTenantUser(userId: string, ctx: TenantContext): Promise<UserRecord> {
    const membership = this.database.getUserMembership(userId, ctx.organizationId);

    if (!membership) {
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "auth:password_change_target_denied",
        resource: "User",
        resourceId: userId,
        requestId: ctx.requestId,
        status: "denied",
        metadata: {
          reason: "Target user is not a member of the authenticated organization",
        },
      });

      // Intentionally indistinguishable from a nonexistent user to avoid
      // cross-tenant account enumeration.
      throw new NotFoundError("User");
    }

    const user = this.database.users.get(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    return user;
  }

  public async findUserById(userId: string, ctx: TenantContext): Promise<UserRecord> {
    return this.requireTenantUser(userId, ctx);
  }

  public async updatePasswordCredentials(
    userId: string,
    credentials: PasswordCredentialUpdate,
    ctx: TenantContext
  ): Promise<UserRecord> {
    // Re-check membership at mutation time rather than trusting a prior read.
    const user = await this.requireTenantUser(userId, ctx);

    user.passwordHash = credentials.passwordHash;
    user.passwordSalt = credentials.passwordSalt;
    this.database.users.set(user.id, user);

    return user;
  }
}
