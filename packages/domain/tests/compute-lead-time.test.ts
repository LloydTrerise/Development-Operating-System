import { describe, expect, it } from 'vitest';
import {
  computeLeadTimeMs,
  summarizeLeadTimes,
} from '../src/engineering-intelligence/compute-lead-time.js';

describe('computeLeadTimeMs', () => {
  it('computes a correct millisecond interval between two real ISO timestamps', () => {
    const ms = computeLeadTimeMs('2026-09-01T00:00:00.000Z', '2026-09-01T01:00:00.000Z');
    expect(ms).toBe(60 * 60 * 1000);
  });
});

describe('summarizeLeadTimes', () => {
  it('computes a real median and mean over an odd-length sample set', () => {
    const summary = summarizeLeadTimes([1000, 3000, 2000]);
    expect(summary.sampleCount).toBe(3);
    expect(summary.leadTimeMsP50).toBe(2000);
    expect(summary.leadTimeMsMean).toBeCloseTo(2000, 6);
  });

  it('computes a real median over an even-length sample set (average of the two middle values)', () => {
    const summary = summarizeLeadTimes([1000, 2000, 3000, 4000]);
    expect(summary.leadTimeMsP50).toBe(2500);
  });

  it('reports zero, not NaN, for an empty sample set', () => {
    const summary = summarizeLeadTimes([]);
    expect(summary.sampleCount).toBe(0);
    expect(summary.leadTimeMsP50).toBe(0);
    expect(summary.leadTimeMsMean).toBe(0);
  });
});
