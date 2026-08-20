import { describe, expect, it } from 'vitest';
import { createWorker } from '../src/worker.js';

describe('worker bootstrap', () => {
  it('creates a ready worker', () => {
    expect(createWorker()).toEqual({ status: 'ready' });
  });
});
