/**
 * APEX ONE — Authentication Rate Limiting Abstraction
 * 
 * Provides an enterprise rate-limiting contract to protect authentication endpoints
 * against brute-force attacks, credential stuffing, and dictionary enumeration.
 * 
 * Architecture:
 * - Clean IRateLimiter interface allows seamless transition from in-memory to distributed Redis/cluster store.
 * - Tracks failed attempts with sliding-window expiry and dynamic lockout windows.
 * - Resets on successful authentication for the specific identity key.
 */

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
    private readonly windowMs: number = 15 * 60 * 1000, // 15 minutes
    private readonly lockoutMs: number = 15 * 60 * 1000 // 15 minutes lockout
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

    // Check active lockout
    if (entry.lockedUntil && entry.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
      return {
        limited: true,
        remainingAttempts: 0,
        retryAfterSeconds,
        totalAttempts: entry.failedAttempts.length,
      };
    }

    // Prune attempts outside the sliding window
    const activeAttempts = entry.failedAttempts.filter((t) => now - t < this.windowMs);
    entry.failedAttempts = activeAttempts;

    if (activeAttempts.length >= this.maxAttempts) {
      // Trigger lockout
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
      // Reset rate limit state upon successful authentication
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

    // Prune stale attempts
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

export const defaultAuthRateLimiter: IRateLimiter = new InMemoryRateLimiter();
