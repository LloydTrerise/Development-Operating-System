import { describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from '../src/http/rate-limiter.js';

describe('createRateLimiter', () => {
  it('allows requests up to the limit, then rejects further ones in the same window', async () => {
    const limiter = createRateLimiter(3, 10_000);

    expect(await limiter.tryAcquire('alice')).toBe(true);
    expect(await limiter.tryAcquire('alice')).toBe(true);
    expect(await limiter.tryAcquire('alice')).toBe(true);
    expect(await limiter.tryAcquire('alice')).toBe(false);
  });

  it('tracks each key independently', async () => {
    const limiter = createRateLimiter(1, 10_000);

    expect(await limiter.tryAcquire('alice')).toBe(true);
    expect(await limiter.tryAcquire('bob')).toBe(true);
    expect(await limiter.tryAcquire('alice')).toBe(false);
    expect(await limiter.tryAcquire('bob')).toBe(false);
  });

  it('allows requests again once the window has passed', async () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter(1, 1_000);

      expect(await limiter.tryAcquire('alice')).toBe(true);
      expect(await limiter.tryAcquire('alice')).toBe(false);

      vi.advanceTimersByTime(1_001);

      expect(await limiter.tryAcquire('alice')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
