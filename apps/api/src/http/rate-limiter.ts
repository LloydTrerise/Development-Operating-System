import type { Redis } from 'ioredis';

/**
 * DEVOS-091: a real, in-process sliding-window rate limiter — closes the
 * gap the security review found (specs/api/poc-api-contracts.md §41
 * requires rate-limiting "expensive endpoints"; none existed anywhere).
 * `tryAcquire` is `Promise<boolean>` rather than plain `boolean` — DEVOS-118's
 * own real shared-store backend (below) needs a real network round trip, and
 * this is the one interface both implementations share, so the in-process
 * backend stays trivially compatible rather than needing two different
 * shapes for callers to distinguish between.
 */
export interface RateLimiter {
  /** Resolves true if the request is allowed, false if the caller should be rejected. */
  tryAcquire(key: string): Promise<boolean>;
}

export function createRateLimiter(maxRequests: number, windowMs: number): RateLimiter {
  const hitsByKey = new Map<string, number[]>();

  return {
    async tryAcquire(key) {
      const now = Date.now();
      const recentHits = (hitsByKey.get(key) ?? []).filter((hitAt) => now - hitAt < windowMs);

      if (recentHits.length >= maxRequests) {
        hitsByKey.set(key, recentHits);
        return false;
      }

      recentHits.push(now);
      hitsByKey.set(key, recentHits);
      return true;
    },
  };
}

/**
 * DEVOS-118: `createRateLimiter`'s real in-process implementation above
 * neither survives a restart nor coordinates across multiple `apps/api`
 * instances — both hold true before any real horizontal scaling of the API
 * ("a single-process deployment model was the only one ever authorized for
 * this POC," `DEVOS-PRODUCTION-READINESS-ROADMAP.md` B2). Redis is this
 * task's own recorded choice (the sprint README's own suggested example,
 * and a real, self-hosted-here backend, the same precedent DEVOS-106/117
 * already set for Vault/Prometheus rather than a managed cloud service) — a
 * sliding-window log kept in a Redis sorted set, scored by request
 * timestamp, so multiple real API processes sharing one real Redis
 * instance see and enforce exactly the same window for the same key.
 *
 * The read-count-then-write sequence is not safe to run as separate Redis
 * calls under real concurrent load from multiple processes (two
 * simultaneous requests could both read a count just under the limit, then
 * both write, exceeding it) — the entire check-and-increment runs as one
 * atomic Lua script via `EVAL`, the standard, correct way to make a
 * multi-step Redis operation atomic across concurrent real clients.
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count >= max then
  return 0
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return 1
`;

export function createRedisRateLimiter(
  redis: Redis,
  maxRequests: number,
  windowMs: number,
): RateLimiter {
  let sequence = 0;

  return {
    async tryAcquire(key) {
      const now = Date.now();
      // ZADD scores by `now` alone, but two real requests can land in the
      // same millisecond — a bare timestamp member would collide and
      // silently coalesce into one entry. A per-process monotonic sequence
      // appended to the member (not the score, which must stay a real,
      // comparable timestamp for ZREMRANGEBYSCORE to expire it correctly)
      // keeps every real acquisition attempt its own real set member.
      sequence += 1;
      const member = `${now}-${process.pid}-${sequence}`;

      const result = await redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        `devos:rate-limit:${key}`,
        now,
        windowMs,
        maxRequests,
        member,
      );
      return result === 1;
    },
  };
}
