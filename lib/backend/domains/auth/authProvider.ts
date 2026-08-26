/**
 * APEX ONE — Authentication Provider & Session Store Interfaces
 * 
 * Implements a production-pluggable identity abstraction with:
 * 1. Cryptographically secure random session tokens (crypto.randomBytes)
 * 2. Secure salted PBKDF2 password verification
 * 3. Session lifecycle & revocation
 */

import { AuthSession, PermissionCapability, ROLE_PERMISSIONS } from "../../core/security";
import { generateSecureToken, verifyPassword } from "../../core/crypto";
import { db } from "../../database/store";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "../../core/errors";

export interface ISessionStore {
  createSession(
    user: { id: string; email: string; name: string },
    org: { id: string; name: string },
    role: string,
    permissions: PermissionCapability[],
    ttlSeconds?: number
  ): Promise<AuthSession>;
  getSession(token: string): Promise<AuthSession | undefined>;
  revokeSession(token: string): Promise<boolean>;
  revokeUserSessions(userId: string): Promise<number>;
  cleanupExpiredSessions(): Promise<number>;
}

export class InMemorySessionStore implements ISessionStore {
  private sessions: Map<string, AuthSession> = new Map();

  public async createSession(
    user: { id: string; email: string; name: string },
    org: { id: string; name: string },
    role: string,
    permissions: PermissionCapability[],
    ttlSeconds: number = 86400 // 24 hours
  ): Promise<AuthSession> {
    const token = generateSecureToken("apex_sec");
    const now = new Date();
    const expires = new Date(now.getTime() + ttlSeconds * 1000);

    const session: AuthSession = {
      token,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      organizationId: org.id,
      organizationName: org.name,
      role,
      permissions,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
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

    return session;
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
        count++;
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
        cleaned++;
      }
    }
    return cleaned;
  }
}

export interface IAuthenticationProvider {
  authenticateCredentials(
    email: string,
    password?: string,
    targetOrganizationId?: string
  ): Promise<{
    session: AuthSession;
    availableOrganizations: { id: string; name: string; role: string }[];
  }>;
}

export class LocalAuthenticationProvider implements IAuthenticationProvider {
  constructor(private readonly sessionStore: ISessionStore) {}

  public async authenticateCredentials(
    email: string,
    password?: string,
    targetOrganizationId?: string
  ): Promise<{
    session: AuthSession;
    availableOrganizations: { id: string; name: string; role: string }[];
  }> {
    // 1. Validate email input
    if (!email || typeof email !== "string" || email.trim().length === 0) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // 2. Validate password input strictly
    if (!password || typeof password !== "string" || password.length === 0) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 3. User lookup
    const user = Array.from(db.users.values()).find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // 4. Account status verification: Only active accounts may authenticate
    if (user.status !== "active") {
      throw new UnauthorizedError("Invalid email or password");
    }

    // 5. Mandatory credential verification: Password hash and salt must exist
    if (
      !user.passwordHash ||
      !user.passwordSalt ||
      typeof user.passwordHash !== "string" ||
      typeof user.passwordSalt !== "string" ||
      user.passwordHash.trim().length === 0 ||
      user.passwordSalt.trim().length === 0
    ) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // 6. Cryptographically verify password against stored PBKDF2 hash
    const isPasswordValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // 7. Resolve verified tenant memberships for authenticated user
    const memberships = Array.from(db.memberships.values()).filter((m) => m.userId === user.id);
    if (memberships.length === 0) {
      throw new ForbiddenError("User is not associated with any active organization tenant");
    }

    // 8. Enforce organization boundary: targetOrganizationId must be a verified membership
    let chosenMembership = memberships[0];
    if (targetOrganizationId) {
      const match = memberships.find((m) => m.organizationId === targetOrganizationId);
      if (!match) {
        throw new ForbiddenError(`User is not an authorized member of organization ${targetOrganizationId}`);
      }
      chosenMembership = match;
    }

    const org = db.organizations.get(chosenMembership.organizationId);
    if (!org) {
      throw new NotFoundError("Organization");
    }

    // 9. Derive authoritative permissions strictly from database-backed role
    const permissions = ROLE_PERMISSIONS[chosenMembership.role] || ROLE_PERMISSIONS["Operations"];

    // 10. Issue secure authenticated session only after all checks have passed
    const session = await this.sessionStore.createSession(
      { id: user.id, email: user.email, name: user.name },
      { id: org.id, name: org.name },
      chosenMembership.role,
      permissions
    );

    const availableOrganizations = memberships.map((m) => {
      const o = db.organizations.get(m.organizationId);
      return {
        id: m.organizationId,
        name: o?.name || m.organizationId,
        role: m.role,
      };
    });

    return { session, availableOrganizations };
  }
}

export const defaultSessionStore = new InMemorySessionStore();
export const defaultAuthProvider = new LocalAuthenticationProvider(defaultSessionStore);
