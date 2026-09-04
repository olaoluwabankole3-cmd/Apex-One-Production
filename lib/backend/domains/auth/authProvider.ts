/**
 * APEX ONE — Authentication Provider & Session Store Interfaces
 */

import { createHash } from "node:crypto";
import {
  AuthSession,
  PermissionCapability,
  getPermissionsForRole,
} from "../../core/security";
import { generateSecureToken, verifyPassword, dummyPasswordVerification } from "../../core/crypto";
import { DatabaseStore } from "../../database/store";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "../../core/errors";
import {
  isProductionInfrastructureEnvironment,
  resolveInfrastructureConfiguration,
  type InfrastructureEnvironment,
} from "../../infrastructure/runtime";
import { RedisWireClient, type RedisReply } from "../../infrastructure/redis/RedisWireClient";

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

function normalizeCreateSessionParams(
  paramsOrUser: CreateSessionParams | { id: string; email: string; name: string },
  org?: { id: string; name: string },
  role?: string,
  permissions?: PermissionCapability[],
  ttlSecondsParam?: number
): CreateSessionParams {
  if ("user" in paramsOrUser && "org" in paramsOrUser) {
    return paramsOrUser as CreateSessionParams;
  }

  const resolvedRole = role || "Operations";
  return {
    user: paramsOrUser as { id: string; email: string; name: string },
    org: org || { id: "apex-demo", name: "Apex Demo" },
    role: resolvedRole,
    permissions: permissions || [...getPermissionsForRole(resolvedRole)],
    ttlSeconds: ttlSecondsParam,
  };
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
    const params = normalizeCreateSessionParams(paramsOrUser, org, role, permissions, ttlSecondsParam);
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

type StoredAuthSession = Omit<AuthSession, "token">;

interface RedisStoredSessionEnvelope {
  session: StoredAuthSession;
  userIndexId: string;
  orgIndexId: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requirePositiveTtlSeconds(value: number | undefined): number {
  const ttlSeconds = value === undefined ? 86400 : value;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new TypeError("Session TTL must be a positive integer number of seconds");
  }
  return ttlSeconds;
}

function redisNumber(reply: RedisReply, operation: string): number {
  if (typeof reply !== "number" || !Number.isSafeInteger(reply)) {
    throw new Error(`Redis ${operation} returned an invalid integer reply`);
  }
  return reply;
}

function parseStoredSession(payload: RedisReply, token: string): AuthSession | undefined {
  if (typeof payload !== "string") return undefined;
  let envelope: RedisStoredSessionEnvelope;
  try {
    envelope = JSON.parse(payload) as RedisStoredSessionEnvelope;
  } catch {
    throw new Error("Redis session payload is not valid JSON");
  }

  const session = envelope?.session;
  if (
    !session ||
    typeof session.userId !== "string" ||
    typeof session.userEmail !== "string" ||
    typeof session.userName !== "string" ||
    typeof session.organizationId !== "string" ||
    typeof session.organizationName !== "string" ||
    typeof session.role !== "string" ||
    !Array.isArray(session.permissions) ||
    typeof session.createdAt !== "string" ||
    typeof session.expiresAt !== "string"
  ) {
    throw new Error("Redis session payload is missing required identity fields");
  }

  return { ...session, token };
}

export class RedisSessionStore implements ISessionStore {
  private readonly redis: RedisWireClient;
  private readonly sessionPrefix: string;
  private readonly userPrefix: string;
  private readonly orgPrefix: string;
  private readonly expirationIndexKey: string;

  constructor(
    redisUrl: string,
    namespace: string = "apex-one:auth:sessions"
  ) {
    this.redis = new RedisWireClient(redisUrl);
    this.sessionPrefix = `${namespace}:session:`;
    this.userPrefix = `${namespace}:user:`;
    this.orgPrefix = `${namespace}:org:`;
    this.expirationIndexKey = `${namespace}:expirations`;
  }

  private tokenDigest(token: string): string {
    return sha256(token);
  }

  private userIndexId(userId: string): string {
    return sha256(userId);
  }

  private orgIndexId(organizationId: string): string {
    return sha256(organizationId);
  }

  private sessionKeyFromDigest(tokenDigest: string): string {
    return `${this.sessionPrefix}${tokenDigest}`;
  }

  private userKeyFromIndexId(indexId: string): string {
    return `${this.userPrefix}${indexId}`;
  }

  private orgKeyFromIndexId(indexId: string): string {
    return `${this.orgPrefix}${indexId}`;
  }

  public async createSession(
    paramsOrUser: CreateSessionParams | { id: string; email: string; name: string },
    org?: { id: string; name: string },
    role?: string,
    permissions?: PermissionCapability[],
    ttlSecondsParam?: number
  ): Promise<AuthSession> {
    const params = normalizeCreateSessionParams(paramsOrUser, org, role, permissions, ttlSecondsParam);
    const ttlSeconds = requirePositiveTtlSeconds(params.ttlSeconds);
    const ttlMs = ttlSeconds * 1000;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = generateSecureToken("apex_sec");
      const tokenDigest = this.tokenDigest(token);
      const now = new Date();
      const expires = new Date(now.getTime() + ttlMs);
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

      const { token: _rawToken, ...storedSession } = session;
      const userIndexId = this.userIndexId(session.userId);
      const orgIndexId = this.orgIndexId(session.organizationId);
      const envelope: RedisStoredSessionEnvelope = { session: storedSession, userIndexId, orgIndexId };

      const script = `
        local created = redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2], 'NX')
        if not created then return 0 end
        redis.call('ZADD', KEYS[2], ARGV[3], ARGV[4])
        redis.call('ZADD', KEYS[3], ARGV[3], ARGV[4])
        redis.call('ZADD', KEYS[4], ARGV[3], ARGV[4])
        local ttl = tonumber(ARGV[2])
        for index = 3, 4 do
          local existing = redis.call('PTTL', KEYS[index])
          if existing < ttl then redis.call('PEXPIRE', KEYS[index], ttl) end
        end
        return 1
      `;

      const created = redisNumber(
        await this.redis.execute([
          "EVAL",
          script,
          4,
          this.sessionKeyFromDigest(tokenDigest),
          this.expirationIndexKey,
          this.userKeyFromIndexId(userIndexId),
          this.orgKeyFromIndexId(orgIndexId),
          JSON.stringify(envelope),
          ttlMs,
          expires.getTime(),
          tokenDigest,
        ]),
        "session creation"
      );

      if (created === 1) return session;
    }

    throw new Error("Unable to allocate a unique opaque session token");
  }

  public async getSession(token: string): Promise<AuthSession | undefined> {
    if (!token || typeof token !== "string") return undefined;
    const tokenDigest = this.tokenDigest(token);
    const script = `
      local payload = redis.call('GET', KEYS[1])
      if not payload then return nil end
      local ttl = redis.call('PTTL', KEYS[1])
      if ttl <= 0 then return nil end
      local envelope = cjson.decode(payload)
      envelope.session.lastActivityAt = ARGV[1]
      local updated = cjson.encode(envelope)
      redis.call('SET', KEYS[1], updated, 'PX', ttl)
      return updated
    `;
    const payload = await this.redis.execute([
      "EVAL",
      script,
      1,
      this.sessionKeyFromDigest(tokenDigest),
      new Date().toISOString(),
    ]);
    return parseStoredSession(payload, token);
  }

  public async touchSession(token: string): Promise<boolean> {
    if (!token || typeof token !== "string") return false;
    const tokenDigest = this.tokenDigest(token);
    const script = `
      local payload = redis.call('GET', KEYS[1])
      if not payload then return 0 end
      local ttl = redis.call('PTTL', KEYS[1])
      if ttl <= 0 then return 0 end
      local envelope = cjson.decode(payload)
      envelope.session.lastActivityAt = ARGV[1]
      redis.call('SET', KEYS[1], cjson.encode(envelope), 'PX', ttl)
      return 1
    `;
    return redisNumber(
      await this.redis.execute([
        "EVAL",
        script,
        1,
        this.sessionKeyFromDigest(tokenDigest),
        new Date().toISOString(),
      ]),
      "session touch"
    ) === 1;
  }

  public async revokeSession(token: string): Promise<boolean> {
    if (!token || typeof token !== "string") return false;
    const tokenDigest = this.tokenDigest(token);
    const script = `
      local payload = redis.call('GET', KEYS[1])
      if not payload then
        redis.call('ZREM', KEYS[2], ARGV[1])
        return 0
      end
      local envelope = cjson.decode(payload)
      redis.call('DEL', KEYS[1])
      redis.call('ZREM', KEYS[2], ARGV[1])
      redis.call('ZREM', ARGV[2] .. envelope.userIndexId, ARGV[1])
      redis.call('ZREM', ARGV[3] .. envelope.orgIndexId, ARGV[1])
      return 1
    `;
    return redisNumber(
      await this.redis.execute([
        "EVAL",
        script,
        2,
        this.sessionKeyFromDigest(tokenDigest),
        this.expirationIndexKey,
        tokenDigest,
        this.userPrefix,
        this.orgPrefix,
      ]),
      "session revocation"
    ) === 1;
  }

  public async revokeUserSessions(userId: string): Promise<number> {
    if (!userId || typeof userId !== "string") return 0;
    const userKey = this.userKeyFromIndexId(this.userIndexId(userId));
    const script = `
      local members = redis.call('ZRANGE', KEYS[1], 0, -1)
      local count = 0
      for _, digest in ipairs(members) do
        local sessionKey = ARGV[1] .. digest
        local payload = redis.call('GET', sessionKey)
        if payload then
          local envelope = cjson.decode(payload)
          redis.call('DEL', sessionKey)
          redis.call('ZREM', KEYS[2], digest)
          redis.call('ZREM', ARGV[2] .. envelope.orgIndexId, digest)
          count = count + 1
        else
          redis.call('ZREM', KEYS[2], digest)
        end
      end
      redis.call('DEL', KEYS[1])
      return count
    `;
    return redisNumber(
      await this.redis.execute([
        "EVAL",
        script,
        2,
        userKey,
        this.expirationIndexKey,
        this.sessionPrefix,
        this.orgPrefix,
      ]),
      "user session revocation"
    );
  }

  public async revokeOrgSessions(organizationId: string): Promise<number> {
    if (!organizationId || typeof organizationId !== "string") return 0;
    const orgKey = this.orgKeyFromIndexId(this.orgIndexId(organizationId));
    const script = `
      local members = redis.call('ZRANGE', KEYS[1], 0, -1)
      local count = 0
      for _, digest in ipairs(members) do
        local sessionKey = ARGV[1] .. digest
        local payload = redis.call('GET', sessionKey)
        if payload then
          local envelope = cjson.decode(payload)
          redis.call('DEL', sessionKey)
          redis.call('ZREM', KEYS[2], digest)
          redis.call('ZREM', ARGV[2] .. envelope.userIndexId, digest)
          count = count + 1
        else
          redis.call('ZREM', KEYS[2], digest)
        end
      end
      redis.call('DEL', KEYS[1])
      return count
    `;
    return redisNumber(
      await this.redis.execute([
        "EVAL",
        script,
        2,
        orgKey,
        this.expirationIndexKey,
        this.sessionPrefix,
        this.userPrefix,
      ]),
      "organization session revocation"
    );
  }

  public async cleanupExpiredSessions(): Promise<number> {
    const script = `
      local members = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
      if #members > 0 then redis.call('ZREM', KEYS[1], unpack(members)) end
      return #members
    `;
    return redisNumber(
      await this.redis.execute(["EVAL", script, 1, this.expirationIndexKey, Date.now()]),
      "expired-session cleanup"
    );
  }

  public async getActiveSessionCount(): Promise<number> {
    return redisNumber(
      await this.redis.execute(["ZCOUNT", this.expirationIndexKey, Date.now() + 1, "+inf"]),
      "active-session count"
    );
  }
}

class UnavailableSessionStore implements ISessionStore {
  constructor(private readonly message: string) {}
  private fail(): never {
    throw new Error(this.message);
  }
  public async createSession(): Promise<AuthSession> { return this.fail(); }
  public async getSession(): Promise<AuthSession | undefined> { return this.fail(); }
  public async touchSession(): Promise<boolean> { return this.fail(); }
  public async revokeSession(): Promise<boolean> { return this.fail(); }
  public async revokeUserSessions(): Promise<number> { return this.fail(); }
  public async revokeOrgSessions(): Promise<number> { return this.fail(); }
  public async cleanupExpiredSessions(): Promise<number> { return this.fail(); }
  public async getActiveSessionCount(): Promise<number> { return this.fail(); }
}

export function createSessionStoreFromEnvironment(
  env: InfrastructureEnvironment = process.env
): ISessionStore {
  const configuration = resolveInfrastructureConfiguration(env);
  const production = isProductionInfrastructureEnvironment(env);

  if (production && configuration.session !== "redis") {
    throw new Error("Production session provider must be Redis; in-memory sessions are local/test only");
  }

  if (configuration.session === "redis") {
    const redisUrl = env.REDIS_URL?.trim();
    if (!redisUrl && production) {
      throw new Error("REDIS_URL is required for the production Redis session provider");
    }
    return redisUrl
      ? new RedisSessionStore(redisUrl)
      : new UnavailableSessionStore("Redis session adapter selected but REDIS_URL is not configured");
  }
  return new InMemorySessionStore();
}

export interface AuthenticateCredentialsOptions {
  ipAddress?: string;
  userAgent?: string;
}

export interface IAuthenticationProvider {
  authenticateCredentials(
    identifier: string,
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
    private readonly database: DatabaseStore
  ) {}

  public async authenticateCredentials(
    identifier: string,
    password?: string,
    targetOrganizationId?: string,
    options?: AuthenticateCredentialsOptions
  ): Promise<{
    session: AuthSession;
    availableOrganizations: { id: string; name: string; role: string }[];
  }> {
    if (!identifier || typeof identifier !== "string" || identifier.trim().length === 0) {
      throw new UnauthorizedError("Invalid email or password");
    }
    if (!password || typeof password !== "string" || password.length === 0) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = normalizedIdentifier.includes("@")
      ? await this.database.findUserByEmail(normalizedIdentifier)
      : await this.database.findUserByLoginIdentifier(normalizedIdentifier);

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
