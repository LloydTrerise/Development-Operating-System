import { describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from '../src/http/rate-limiter.js';

describe('createRateLimiter', () => {
  it('allows requests up to the limit, then rejects further ones in the same window', () => {
    const limiter = createRateLimiter(3, 10_000);

    expect(limiter.tryAcquire('alice')).toBe(true);
    expect(limiter.tryAcquire('alice')).toBe(true);
    expect(limiter.tryAcquire('alice')).toBe(true);
    expect(limiter.tryAcquire('alice')).toBe(false);
  });

  it('tracks each key independently', () => {
    const limiter = createRateLimiter(1, 10_000);

    expect(limiter.tryAcquire('alice')).toBe(true);
    expect(limiter.tryAcquire('bob')).toBe(true);
    expect(limiter.tryAcquire('alice')).toBe(false);
    expect(limiter.tryAcquire('bob')).toBe(false);
  });

  it('allows requests again once the window has passed', () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter(1, 1_000);

      expect(limiter.tryAcquire('alice')).toBe(true);
      expect(limiter.tryAcquire('alice')).toBe(false);

      vi.advanceTimersByTime(1_001);

      expect(limiter.tryAcquire('alice')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
