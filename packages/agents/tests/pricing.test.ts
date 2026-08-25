import { describe, expect, it } from 'vitest';
import { estimateCostUsd } from '../src/pricing.js';

describe('estimateCostUsd', () => {
  it('computes a cost proportional to prompt and candidates tokens', () => {
    const cost = estimateCostUsd({
      promptTokens: 1000,
      candidatesTokens: 1000,
      totalTokens: 2000,
    });

    expect(cost).toBeCloseTo(0.000075 + 0.0003, 10);
  });

  it('returns 0 for zero-token usage', () => {
    const cost = estimateCostUsd({ promptTokens: 0, candidatesTokens: 0, totalTokens: 0 });

    expect(cost).toBe(0);
  });

  it('scales linearly with token count', () => {
    const small = estimateCostUsd({ promptTokens: 100, candidatesTokens: 0, totalTokens: 100 });
    const large = estimateCostUsd({ promptTokens: 1000, candidatesTokens: 0, totalTokens: 1000 });

    expect(large).toBeCloseTo(small * 10, 10);
  });
});
