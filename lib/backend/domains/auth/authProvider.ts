/**
 * APEX ONE — Authentication Provider & Session Store Interfaces
 */

import {
  AuthSession,
  PermissionCapability,
  getPermissionsForRole,
} from "../../core/security";
import { generateSecureToken, verifyPassword, dummyPasswordVerification } from "../../core/crypto";
import { db, DatabaseStore } from "../../database/store";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "../../core/errors";

export interface CreateSessionParams {
  user: { id: string; email: string; name: string };
  org: { id: string; name: string };
  role: string;
  permissions: PermissionCapability[];
  ttlSeconds?: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface ISessionStore {
  createSession(
    paramsOrUser: CreateSessionParams | { id: string; email: string; name: string },
    org?: { id: string; name: string },
    role?: string,
    permissions?: PermissionCapability[],
    ttlSeconds?: number
  ): Promise<AuthSession>;
  getSession(token: string): Promise<AuthSession | undefined>;
  touchSession(token: string): Promise<boolean>;
  revokeSession(token: string): Promise<boolean>;
  revokeUserSessions(userId: string): Promise<number>;
  revokeOrgSessions(organizationId: string): Promise<number>;
  cleanupExpiredSessions(): Promise<number>;
  getActiveSessionCount(): Promise<number>;
}

export class InMemorySessionStore implements ISessionStore {
  private sessions: Map<string, AuthSession> = new Map();

  public async createSession(
    paramsOrUser: CreateSessionParams | { id: string; email: string; name: string },
    org?: { id: string; name: string },
    role?: string,
    permissions?: PermissionCapability[],
    ttlSecondsParam?: number
  ): Promise<AuthSession> {
    let params: CreateSessionParams;

    if ("user" in paramsOrUser && "org" in paramsOrUser) {
      params = paramsOrUser as CreateSessionParams;
    } else {
      const resolvedRole = role || "Operations";
      params = {
        user: paramsOrUser as { id: string; email: string; name: string },
        org: org || { id: "apex-demo", name: "Apex Demo" },
        role: resolvedRole,
        permissions: permissions || [...getPermissionsForRole(resolvedRole)],
        ttlSeconds: ttlSecondsParam,
      };
    }

    const ttlSeconds = params.ttlSeconds !== undefined ? params.ttlSeconds : 86400;
    const token = generateSecureToken("apex_sec");
    const now = new Date();
    const expires = new Date(now.getTime() + ttlSeconds * 1000);

    const session: AuthSession = {
      token,
      userId: params.user.id,
      userEmail: params.user.email,
      userName: params.user.name,
      organizationId: params.org.id,
      organizationName: params.org.name,
      role: params.role,
      permissions: params.permissions,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      lastActivityAt: now.toISOString(),
      sessionVersion: 1,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    };

    this.sessions.set(token, session);
    return session;
  }

  public async getSession(token: string): Promise<AuthSession | undefined> {
    if (!token || typeof token !== "string") return undefined;
    const session = this.sessions.get(token);
    if (!session) return undefined;
    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(token);
      return undefined;
    }
    session.lastActivityAt = new Date().toISOString();
    return session;
  }

  public async touchSession(token: string): Promise<boolean> {
    if (!token || typeof token !== "string") return false;
    const session = this.sessions.get(token);
    if (!session) return false;
    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(token);
      return false;
    }
    session.lastActivityAt = new Date().toISOString();
    return true;
  }

  public async revokeSession(token: string): Promise<boolean> {
    if (!token || typeof token !== "string") return false;
    return this.sessions.delete(token);
  }

  public async revokeUserSessions(userId: string): Promise<number> {
    if (!userId || typeof userId !== "string") return 0;
    let count = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(token);
        count += 1;
      }
    }
    return count;
  }

  public async revokeOrgSessions(organizationId: string): Promise<number> {
    if (!organizationId || typeof organizationId !== "string") return 0;
    let count = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (session.organizationId === organizationId) {
        this.sessions.delete(token);
        count += 1;
      }
    }
    return count;
  }

  public async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    let cleaned = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (new Date(session.expiresAt) < now) {
        this.sessions.delete(token);
        cleaned += 1;
      }
    }
    return cleaned;
  }

  public async getActiveSessionCount(): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const session of this.sessions.values()) if (new Date(session.expiresAt) >= now) count += 1;
    return count;
  }

  public clearAll(): void {
    this.sessions.clear();
  }
}

export interface AuthenticateCredentialsOptions {
  ipAddress?: string;
  userAgent?: string;
}

export interface IAuthenticationProvider {
  authenticateCredentials(
    email: string,
    password?: string,
    targetOrganizationId?: string,
    options?: AuthenticateCredentialsOptions
  ): Promise<{
    session: AuthSession;
    availableOrganizations: { id: string; name: string; role: string }[];
  }>;
}

export class LocalAuthenticationProvider implements IAuthenticationProvider {
  constructor(
    private readonly sessionStore: ISessionStore,
    private readonly database: DatabaseStore = db
  ) {}

  public async authenticateCredentials(
    email: string,
    password?: string,
    targetOrganizationId?: string,
    options?: AuthenticateCredentialsOptions
  ): Promise<{
    session: AuthSession;
    availableOrganizations: { id: string; name: string; role: string }[];
  }> {
    if (!email || typeof email !== "string" || email.trim().length === 0) {
      throw new UnauthorizedError("Invalid email or password");
    }
    if (!password || typeof password !== "string" || password.length === 0) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.database.findUserByEmail(normalizedEmail);

    if (!user) {
      dummyPasswordVerification(password);
      throw new UnauthorizedError("Invalid email or password");
    }
    if (user.status !== "active") {
      dummyPasswordVerification(password);
      throw new UnauthorizedError("Invalid email or password");
    }
    if (
      !user.passwordHash ||
      !user.passwordSalt ||
      typeof user.passwordHash !== "string" ||
      typeof user.passwordSalt !== "string" ||
      user.passwordHash.trim().length === 0 ||
      user.passwordSalt.trim().length === 0
    ) {
      dummyPasswordVerification(password);
      throw new UnauthorizedError("Invalid email or password");
    }
    if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const memberships = await this.database.findMembershipsForUser(user.id);
    if (memberships.length === 0) {
      throw new ForbiddenError("User is not associated with any active organization tenant");
    }

    let chosenMembership = memberships[0];
    if (targetOrganizationId) {
      const match = memberships.find((membership) => membership.organizationId === targetOrganizationId);
      if (!match) {
        throw new ForbiddenError(`User is not an authorized member of organization ${targetOrganizationId}`);
      }
      chosenMembership = match;
    }

    const org = await this.database.findOrganizationById(chosenMembership.organizationId);
    if (!org) throw new NotFoundError("Organization");

    const permissions = [...getPermissionsForRole(chosenMembership.role)];
    const session = await this.sessionStore.createSession({
      user: { id: user.id, email: user.email, name: user.name },
      org: { id: org.id, name: org.name },
      role: chosenMembership.role,
      permissions,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });

    const availableOrganizations = await Promise.all(
      memberships.map(async (membership) => {
        const organization = await this.database.findOrganizationById(membership.organizationId);
        return {
          id: membership.organizationId,
          name: organization?.name || membership.organizationId,
          role: membership.role,
        };
      })
    );

    return { session, availableOrganizations };
  }
}

export const defaultSessionStore = new InMemorySessionStore();
export const defaultAuthProvider = new LocalAuthenticationProvider(defaultSessionStore);
