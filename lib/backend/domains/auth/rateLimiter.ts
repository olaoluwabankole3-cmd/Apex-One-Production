/**
 * APEX ONE — Authentication Rate Limiting Abstraction
 *
 * Provides an enterprise rate-limiting contract to protect authentication endpoints
 * against brute-force attacks, credential stuffing, and dictionary enumeration.
 */

import { createHash, randomBytes } from "node:crypto";
import {
  resolveInfrastructureConfiguration,
  type InfrastructureEnvironment,
} from "../../infrastructure/runtime";
import { RedisWireClient, type RedisReply } from "../../infrastructure/redis/RedisWireClient";

export interface RateLimitResult {
  limited: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
  totalAttempts: number;
}

export interface IRateLimiter {
  isRateLimited(key: string): Promise<RateLimitResult>;
  recordAttempt(key: string, success: boolean): Promise<void>;
  reset(key: string): Promise<void>;
}

interface AttemptTracker {
  failedAttempts: number[];
  lockedUntil?: number;
}

export class InMemoryRateLimiter implements IRateLimiter {
  private tracker: Map<string, AttemptTracker> = new Map();

  constructor(
    private readonly maxAttempts: number = 5,
    private readonly windowMs: number = 15 * 60 * 1000,
    private readonly lockoutMs: number = 15 * 60 * 1000
  ) {}

  public async isRateLimited(key: string): Promise<RateLimitResult> {
    if (!key || typeof key !== "string") {
      return { limited: false, remainingAttempts: this.maxAttempts, totalAttempts: 0 };
    }

    const now = Date.now();
    const entry = this.tracker.get(key);

    if (!entry) {
      return { limited: false, remainingAttempts: this.maxAttempts, totalAttempts: 0 };
    }

    if (entry.lockedUntil && entry.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
      return {
        limited: true,
        remainingAttempts: 0,
        retryAfterSeconds,
        totalAttempts: entry.failedAttempts.length,
      };
    }

    const activeAttempts = entry.failedAttempts.filter((t) => now - t < this.windowMs);
    entry.failedAttempts = activeAttempts;

    if (activeAttempts.length >= this.maxAttempts) {
      entry.lockedUntil = now + this.lockoutMs;
      const retryAfterSeconds = Math.ceil(this.lockoutMs / 1000);
      return {
        limited: true,
        remainingAttempts: 0,
        retryAfterSeconds,
        totalAttempts: activeAttempts.length,
      };
    }

    return {
      limited: false,
      remainingAttempts: Math.max(0, this.maxAttempts - activeAttempts.length),
      totalAttempts: activeAttempts.length,
    };
  }

  public async recordAttempt(key: string, success: boolean): Promise<void> {
    if (!key || typeof key !== "string") return;

    if (success) {
      this.tracker.delete(key);
      return;
    }

    const now = Date.now();
    let entry = this.tracker.get(key);
    if (!entry) {
      entry = { failedAttempts: [] };
      this.tracker.set(key, entry);
    }

    entry.failedAttempts.push(now);
    entry.failedAttempts = entry.failedAttempts.filter((t) => now - t < this.windowMs);

    if (entry.failedAttempts.length >= this.maxAttempts) {
      entry.lockedUntil = now + this.lockoutMs;
    }
  }

  public async reset(key: string): Promise<void> {
    if (!key || typeof key !== "string") return;
    this.tracker.delete(key);
  }

  public clearAll(): void {
    this.tracker.clear();
  }
}

function redisNumber(reply: RedisReply, operation: string): number {
  if (typeof reply !== "number" || !Number.isSafeInteger(reply)) {
    throw new Error(`Redis ${operation} returned an invalid integer reply`);
  }
  return reply;
}

function redisNumberArray(reply: RedisReply, operation: string): number[] {
  if (!Array.isArray(reply)) throw new Error(`Redis ${operation} returned an invalid array reply`);
  return reply.map((value) => redisNumber(value, operation));
}

function validateLimiterConfiguration(maxAttempts: number, windowMs: number, lockoutMs: number): void {
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) throw new TypeError("maxAttempts must be a positive integer");
  if (!Number.isInteger(windowMs) || windowMs <= 0) throw new TypeError("windowMs must be a positive integer");
  if (!Number.isInteger(lockoutMs) || lockoutMs <= 0) throw new TypeError("lockoutMs must be a positive integer");
}

/**
 * Redis-backed brute-force protection.
 *
 * The caller's email/IP-derived key is SHA-256 digested before becoming a Redis
 * key, so Redis does not expose authentication identifiers in plaintext keys.
 * Lua scripts make pruning, counting, lockout creation, and reset atomic across
 * application instances.
 */
export class RedisRateLimiter implements IRateLimiter {
  private readonly redis: RedisWireClient;
  private readonly attemptsPrefix: string;
  private readonly lockPrefix: string;

  constructor(
    redisUrl: string,
    private readonly maxAttempts: number = 5,
    private readonly windowMs: number = 15 * 60 * 1000,
    private readonly lockoutMs: number = 15 * 60 * 1000,
    namespace: string = "apex-one:auth:rate-limit"
  ) {
    validateLimiterConfiguration(maxAttempts, windowMs, lockoutMs);
    this.redis = new RedisWireClient(redisUrl);
    this.attemptsPrefix = `${namespace}:attempts:`;
    this.lockPrefix = `${namespace}:lock:`;
  }

  private digestKey(key: string): string {
    return createHash("sha256").update(key, "utf8").digest("hex");
  }

  private keys(key: string): { attempts: string; lock: string } {
    const digest = this.digestKey(key);
    return {
      attempts: `${this.attemptsPrefix}${digest}`,
      lock: `${this.lockPrefix}${digest}`,
    };
  }

  public async isRateLimited(key: string): Promise<RateLimitResult> {
    if (!key || typeof key !== "string") {
      return { limited: false, remainingAttempts: this.maxAttempts, totalAttempts: 0 };
    }

    const keys = this.keys(key);
    const now = Date.now();
    const script = `
      local lockTtl = redis.call('PTTL', KEYS[2])
      if lockTtl > 0 then
        local count = redis.call('ZCARD', KEYS[1])
        return {1, 0, math.ceil(lockTtl / 1000), count}
      end

      redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', tonumber(ARGV[1]) - tonumber(ARGV[2]))
      local count = redis.call('ZCARD', KEYS[1])
      if count >= tonumber(ARGV[3]) then
        redis.call('SET', KEYS[2], '1', 'PX', ARGV[4])
        redis.call('PEXPIRE', KEYS[1], math.max(tonumber(ARGV[2]), tonumber(ARGV[4])))
        return {1, 0, math.ceil(tonumber(ARGV[4]) / 1000), count}
      end

      if count > 0 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
      return {0, tonumber(ARGV[3]) - count, 0, count}
    `;

    const [limited, remainingAttempts, retryAfterSeconds, totalAttempts] = redisNumberArray(
      await this.redis.execute([
        "EVAL",
        script,
        2,
        keys.attempts,
        keys.lock,
        now,
        this.windowMs,
        this.maxAttempts,
        this.lockoutMs,
      ]),
      "rate-limit check"
    );

    return {
      limited: limited === 1,
      remainingAttempts,
      retryAfterSeconds: retryAfterSeconds > 0 ? retryAfterSeconds : undefined,
      totalAttempts,
    };
  }

  public async recordAttempt(key: string, success: boolean): Promise<void> {
    if (!key || typeof key !== "string") return;
    if (success) {
      await this.reset(key);
      return;
    }

    const keys = this.keys(key);
    const now = Date.now();
    const member = `${now}:${randomBytes(12).toString("hex")}`;
    const script = `
      redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', tonumber(ARGV[1]) - tonumber(ARGV[2]))
      redis.call('ZADD', KEYS[1], ARGV[1], ARGV[5])
      local count = redis.call('ZCARD', KEYS[1])
      redis.call('PEXPIRE', KEYS[1], math.max(tonumber(ARGV[2]), tonumber(ARGV[4])))
      if count >= tonumber(ARGV[3]) then
        redis.call('SET', KEYS[2], '1', 'PX', ARGV[4])
      end
      return count
    `;

    await this.redis.execute([
      "EVAL",
      script,
      2,
      keys.attempts,
      keys.lock,
      now,
      this.windowMs,
      this.maxAttempts,
      this.lockoutMs,
      member,
    ]);
  }

  public async reset(key: string): Promise<void> {
    if (!key || typeof key !== "string") return;
    const keys = this.keys(key);
    await this.redis.execute(["DEL", keys.attempts, keys.lock]);
  }
}

class UnavailableRateLimiter implements IRateLimiter {
  constructor(private readonly message: string) {}
  private fail(): never { throw new Error(this.message); }
  public async isRateLimited(): Promise<RateLimitResult> { return this.fail(); }
  public async recordAttempt(): Promise<void> { return this.fail(); }
  public async reset(): Promise<void> { return this.fail(); }
}

export function createRateLimiterFromEnvironment(
  env: InfrastructureEnvironment = process.env
): IRateLimiter {
  const configuration = resolveInfrastructureConfiguration(env);
  if (configuration.rateLimit === "redis") {
    const redisUrl = env.REDIS_URL?.trim();
    return redisUrl
      ? new RedisRateLimiter(redisUrl)
      : new UnavailableRateLimiter("Redis rate-limit adapter selected but REDIS_URL is not configured");
  }
  return new InMemoryRateLimiter();
}

export const defaultAuthRateLimiter: IRateLimiter = createRateLimiterFromEnvironment();
