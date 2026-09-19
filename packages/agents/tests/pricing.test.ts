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

  it('uses the default rate when no modelReference is given (DEVOS-149)', () => {
    const usage = { promptTokens: 1000, candidatesTokens: 1000, totalTokens: 2000 };
    expect(estimateCostUsd(usage, undefined)).toBeCloseTo(estimateCostUsd(usage), 10);
  });

  it('uses the default rate for gemini-3.6-flash, unchanged from before DEVOS-149', () => {
    const usage = { promptTokens: 1000, candidatesTokens: 1000, totalTokens: 2000 };
    expect(estimateCostUsd(usage, 'gemini-3.6-flash')).toBeCloseTo(estimateCostUsd(usage), 10);
  });

  it('uses a distinct, higher rate for gemini-3.6-pro', () => {
    const usage = { promptTokens: 1000, candidatesTokens: 1000, totalTokens: 2000 };
    const flashCost = estimateCostUsd(usage, 'gemini-3.6-flash');
    const proCost = estimateCostUsd(usage, 'gemini-3.6-pro');
    expect(proCost).toBeGreaterThan(flashCost);
    expect(proCost).toBeCloseTo(0.00125 + 0.005, 10);
  });

  it('falls back to the default rate for an unrecognised modelReference', () => {
    const usage = { promptTokens: 1000, candidatesTokens: 1000, totalTokens: 2000 };
    expect(estimateCostUsd(usage, 'some-unknown-model')).toBeCloseTo(estimateCostUsd(usage), 10);
  });
});
