/**
 * DEVOS-091: a real, in-process sliding-window rate limiter — closes the
 * gap the security review found (specs/api/poc-api-contracts.md §41
 * requires rate-limiting "expensive endpoints"; none existed anywhere).
 * Deliberately simple and in-memory, matching this POC's own precedent for
 * single-process mechanisms (e.g. DEVOS-087's metrics registry) rather than
 * a distributed limiter (Redis, etc.), which would be disproportionate
 * infrastructure for this stage.
 */
export interface RateLimiter {
  /** Returns true if the request is allowed, false if the caller should be rejected. */
  tryAcquire(key: string): boolean;
}

export function createRateLimiter(maxRequests: number, windowMs: number): RateLimiter {
  const hitsByKey = new Map<string, number[]>();

  return {
    tryAcquire(key) {
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
