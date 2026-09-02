/**
 * APEX ONE — Tenant-Scoped Authentication Identity Repository
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

export class TenantScopedAuthIdentityRepository implements IAuthIdentityRepository {
  constructor(private readonly database: DatabaseStore) {}

  private async requireTenantUser(userId: string, ctx: TenantContext): Promise<UserRecord> {
    const membership = this.database.isPostgresBacked()
      ? await this.database.findUserMembership(userId, ctx.organizationId)
      : this.database.getUserMembership(userId, ctx.organizationId);

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
      throw new NotFoundError("User");
    }

    const user = this.database.isPostgresBacked()
      ? await this.database.findUserById(userId)
      : this.database.users.get(userId);
    if (!user) throw new NotFoundError("User");
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
    const user = await this.requireTenantUser(userId, ctx);
    const updated = await this.database.updateUserPasswordCredentials(
      user.id,
      ctx.organizationId,
      credentials
    );
    if (!updated) throw new NotFoundError("User");
    return updated;
  }
}
