/**
 * APEX ONE — Stage 4C Redis authentication-state integration verification.
 *
 * Runs against a real Redis service and proves that session and rate-limit
 * authority is shared across application instances rather than process memory.
 */

import {
  RedisSessionStore,
  createSessionStoreFromEnvironment,
} from "../lib/backend/domains/auth/authProvider";
import {
  RedisRateLimiter,
  createRateLimiterFromEnvironment,
} from "../lib/backend/domains/auth/rateLimiter";
import { ROLE_PERMISSIONS } from "../lib/backend/core/security";
import { RedisWireClient, type RedisReply } from "../lib/backend/infrastructure/redis/RedisWireClient";

interface CheckResult {
  name: string;
  passed: boolean;
  error?: string;
}

function requireRedisUrl(): string {
  const value = process.env.REDIS_URL;
  if (!value) throw new Error("REDIS_URL is required for Stage 4C Redis integration tests");
  return value;
}

const redisUrl = requireRedisUrl();
const redis = new RedisWireClient(redisUrl);
const results: CheckResult[] = [];

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
  } catch (error: any) {
    results.push({ name, passed: false, error: error?.stack || error?.message || String(error) });
  }
}

function replyStrings(reply: RedisReply, operation: string): string[] {
  if (!Array.isArray(reply)) throw new Error(`${operation} did not return a Redis array`);
  return reply.map((value) => {
    if (typeof value !== "string") throw new Error(`${operation} returned a non-string member`);
    return value;
  });
}

function sessionParams(
  userId: string,
  organizationId: string,
  email = `${userId}@stage4c.test`
) {
  return {
    user: { id: userId, email, name: `Stage 4C ${userId}` },
    org: { id: organizationId, name: `Stage 4C ${organizationId}` },
    role: "Operations",
    permissions: [...ROLE_PERMISSIONS.Operations],
  };
}

async function flush(): Promise<void> {
  const result = await redis.execute(["FLUSHDB"]);
  if (result !== "OK") throw new Error("Redis FLUSHDB did not return OK");
}

async function main(): Promise<void> {
  await check("1. Redis wire client connects and environment factories select durable auth adapters", async () => {
    await flush();
    if (!(await redis.ping())) throw new Error("Redis PING failed");

    const sessionStore = createSessionStoreFromEnvironment({
      APEX_SESSION_ADAPTER: "redis",
      REDIS_URL: redisUrl,
    });
    const rateLimiter = createRateLimiterFromEnvironment({
      APEX_RATE_LIMIT_ADAPTER: "redis",
      REDIS_URL: redisUrl,
    });

    if (!(sessionStore instanceof RedisSessionStore)) {
      throw new Error("Redis session provider was not selected from infrastructure configuration");
    }
    if (!(rateLimiter instanceof RedisRateLimiter)) {
      throw new Error("Redis rate-limit provider was not selected from infrastructure configuration");
    }
  });

  await check("2. Session created by one application instance is immediately visible to another", async () => {
    await flush();
    const storeA = new RedisSessionStore(redisUrl, "stage4c:shared-session");
    const storeB = new RedisSessionStore(redisUrl, "stage4c:shared-session");
    const created = await storeA.createSession(sessionParams("user-shared", "org-shared"));
    const observed = await storeB.getSession(created.token);

    if (!observed || observed.userId !== created.userId || observed.organizationId !== created.organizationId) {
      throw new Error("Second application instance did not observe the authoritative Redis session");
    }
    if (observed.token !== created.token) {
      throw new Error("Opaque caller token was not reconstructed at the session boundary");
    }
  });

  await check("3. Session expiry survives application restart and Redis TTL remains authoritative", async () => {
    await flush();
    const storeA = new RedisSessionStore(redisUrl, "stage4c:expiry");
    const created = await storeA.createSession({ ...sessionParams("user-expiry", "org-expiry"), ttlSeconds: 1 });

    const restartedStore = new RedisSessionStore(redisUrl, "stage4c:expiry");
    if (!(await restartedStore.getSession(created.token))) {
      throw new Error("Fresh application instance could not hydrate unexpired Redis session");
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
    if (await restartedStore.getSession(created.token)) {
      throw new Error("Expired Redis session survived its authoritative TTL");
    }
    if ((await restartedStore.getActiveSessionCount()) !== 0) {
      throw new Error("Expired session remained in active-session count");
    }
    if ((await restartedStore.cleanupExpiredSessions()) < 1) {
      throw new Error("Expired-session index cleanup did not observe the elapsed session");
    }
  });

  await check("4. Session revocation by one application instance is immediate for every instance", async () => {
    await flush();
    const storeA = new RedisSessionStore(redisUrl, "stage4c:revocation");
    const storeB = new RedisSessionStore(redisUrl, "stage4c:revocation");
    const created = await storeA.createSession(sessionParams("user-revoke", "org-revoke"));

    if (!(await storeB.revokeSession(created.token))) throw new Error("Peer instance failed to revoke Redis session");
    if (await storeA.getSession(created.token)) throw new Error("Revoked session remained visible to original instance");
    if ((await storeA.getActiveSessionCount()) !== 0) throw new Error("Revoked session remained in global active count");
  });

  await check("5. User-wide revocation is durable and does not revoke another user's sessions", async () => {
    await flush();
    const storeA = new RedisSessionStore(redisUrl, "stage4c:user-revoke");
    const storeB = new RedisSessionStore(redisUrl, "stage4c:user-revoke");
    const first = await storeA.createSession(sessionParams("user-target", "org-a"));
    const second = await storeA.createSession(sessionParams("user-target", "org-b"));
    const other = await storeA.createSession(sessionParams("user-other", "org-a"));

    const revoked = await storeB.revokeUserSessions("user-target");
    if (revoked !== 2) throw new Error(`Expected 2 user sessions revoked, got ${revoked}`);
    if (await storeA.getSession(first.token)) throw new Error("First target session survived user-wide revocation");
    if (await storeA.getSession(second.token)) throw new Error("Second target session survived user-wide revocation");
    if (!(await storeA.getSession(other.token))) throw new Error("Unrelated user's session was incorrectly revoked");
  });

  await check("6. Organization-wide revocation is shared and preserves sessions in other tenants", async () => {
    await flush();
    const storeA = new RedisSessionStore(redisUrl, "stage4c:org-revoke");
    const storeB = new RedisSessionStore(redisUrl, "stage4c:org-revoke");
    const first = await storeA.createSession(sessionParams("user-a", "org-target"));
    const second = await storeA.createSession(sessionParams("user-b", "org-target"));
    const other = await storeA.createSession(sessionParams("user-a", "org-other"));

    const revoked = await storeB.revokeOrgSessions("org-target");
    if (revoked !== 2) throw new Error(`Expected 2 organization sessions revoked, got ${revoked}`);
    if (await storeA.getSession(first.token)) throw new Error("First tenant session survived organization revocation");
    if (await storeA.getSession(second.token)) throw new Error("Second tenant session survived organization revocation");
    if (!(await storeA.getSession(other.token))) throw new Error("Other-tenant session was incorrectly revoked");
  });

  await check("7. Failed-login state is identical across application instances", async () => {
    await flush();
    const limiterA = new RedisRateLimiter(redisUrl, 3, 60_000, 60_000, "stage4c:rate-shared");
    const limiterB = new RedisRateLimiter(redisUrl, 3, 60_000, 60_000, "stage4c:rate-shared");
    const key = "203.0.113.10:operator@example.test";

    await limiterA.recordAttempt(key, false);
    await limiterB.recordAttempt(key, false);
    const beforeLock = await limiterA.isRateLimited(key);
    if (beforeLock.limited || beforeLock.totalAttempts !== 2 || beforeLock.remainingAttempts !== 1) {
      throw new Error("Distributed rate-limit state diverged before lockout");
    }

    await limiterB.recordAttempt(key, false);
    const locked = await limiterA.isRateLimited(key);
    if (!locked.limited || locked.totalAttempts !== 3 || locked.remainingAttempts !== 0) {
      throw new Error("Lockout triggered by peer instance was not globally visible");
    }
  });

  await check("8. Lockout survives application restart and reset propagates globally", async () => {
    await flush();
    const key = "198.51.100.22:restart@example.test";
    const limiterA = new RedisRateLimiter(redisUrl, 2, 60_000, 60_000, "stage4c:rate-restart");
    await limiterA.recordAttempt(key, false);
    await limiterA.recordAttempt(key, false);

    const restartedLimiter = new RedisRateLimiter(redisUrl, 2, 60_000, 60_000, "stage4c:rate-restart");
    if (!(await restartedLimiter.isRateLimited(key)).limited) {
      throw new Error("Fresh application instance lost Redis lockout state");
    }

    await restartedLimiter.reset(key);
    const afterReset = await limiterA.isRateLimited(key);
    if (afterReset.limited || afterReset.totalAttempts !== 0 || afterReset.remainingAttempts !== 2) {
      throw new Error("Rate-limit reset did not propagate to the original application instance");
    }
  });

  await check("9. Concurrent distributed failed attempts are counted atomically", async () => {
    await flush();
    const limiterA = new RedisRateLimiter(redisUrl, 5, 60_000, 60_000, "stage4c:rate-concurrent");
    const limiterB = new RedisRateLimiter(redisUrl, 5, 60_000, 60_000, "stage4c:rate-concurrent");
    const key = "192.0.2.42:concurrent@example.test";

    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        (index % 2 === 0 ? limiterA : limiterB).recordAttempt(key, false)
      )
    );

    const result = await limiterA.isRateLimited(key);
    if (!result.limited || result.totalAttempts !== 10) {
      throw new Error(`Concurrent Redis attempts were not atomic: ${JSON.stringify(result)}`);
    }
  });

  await check("10. Redis never stores raw session tokens or plaintext rate-limit identities", async () => {
    await flush();
    const sessionStore = new RedisSessionStore(redisUrl, "stage4c:privacy-session");
    const limiter = new RedisRateLimiter(redisUrl, 5, 60_000, 60_000, "stage4c:privacy-rate");
    const rawRateKey = "203.0.113.77:sensitive.identity@example.test";
    const passwordSentinel = "DoNotPersistThisPassword-4C!";
    const session = await sessionStore.createSession(
      sessionParams("privacy-user", "privacy-org", "sensitive.identity@example.test")
    );
    await limiter.recordAttempt(rawRateKey, false);

    const allKeys = replyStrings(await redis.execute(["KEYS", "stage4c:privacy-*"]), "privacy key scan");
    if (allKeys.some((key) => key.includes(session.token))) {
      throw new Error("Raw opaque session token appeared in a Redis key");
    }
    if (allKeys.some((key) => key.includes(rawRateKey) || key.includes("sensitive.identity@example.test"))) {
      throw new Error("Plaintext rate-limit identity appeared in a Redis key");
    }

    const sessionKeys = replyStrings(
      await redis.execute(["KEYS", "stage4c:privacy-session:session:*"]),
      "session key scan"
    );
    if (sessionKeys.length !== 1) throw new Error(`Expected exactly one stored session payload, found ${sessionKeys.length}`);
    const payload = await redis.execute(["GET", sessionKeys[0]]);
    if (typeof payload !== "string") throw new Error("Stored Redis session payload was not a string");
    if (payload.includes(session.token) || payload.includes('"token"')) {
      throw new Error("Raw session token was persisted inside Redis session JSON");
    }
    if (payload.includes(passwordSentinel)) {
      throw new Error("Plaintext credential material appeared in Redis session JSON");
    }
  });

  await check("11. Successful authentication semantics reset shared rate-limit state", async () => {
    await flush();
    const limiterA = new RedisRateLimiter(redisUrl, 5, 60_000, 60_000, "stage4c:rate-success");
    const limiterB = new RedisRateLimiter(redisUrl, 5, 60_000, 60_000, "stage4c:rate-success");
    const key = "203.0.113.90:success@example.test";

    await limiterA.recordAttempt(key, false);
    await limiterB.recordAttempt(key, false);
    await limiterA.recordAttempt(key, true);
    const result = await limiterB.isRateLimited(key);
    if (result.limited || result.totalAttempts !== 0 || result.remainingAttempts !== 5) {
      throw new Error("Successful-auth reset did not clear distributed failed-attempt state");
    }
  });

  await flush();

  const failed = results.filter((result) => !result.passed);
  console.log("================================================================================");
  console.log("APEX ONE — STAGE 4C REDIS AUTHENTICATION STATE INTEGRATION");
  console.log("================================================================================");
  for (const result of results) {
    console.log(`${result.passed ? "✅ [PASS]" : "❌ [FAIL]"} ${result.name}`);
    if (result.error) console.log(`    ↳ ${result.error}`);
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(`TOTAL: ${results.length} | PASSED: ${results.length - failed.length} | FAILED: ${failed.length}`);
  console.log("================================================================================");
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("FATAL REDIS AUTH-STATE INTEGRATION ERROR", error);
  process.exit(1);
});
