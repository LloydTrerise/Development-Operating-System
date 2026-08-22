import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createWorker } from '../src/worker.js';

describe('worker bootstrap', () => {
  it('starts in a ready state', () => {
    const worker = createWorker();
    expect(worker.status()).toBe('ready');
  });

  it('consumes a test job through a registered handler', async () => {
    const worker = createWorker();
    const received: unknown[] = [];
    worker.registerHandler('test.job', (payload) => {
      received.push(payload);
    });

    await worker.enqueue({ id: randomUUID(), type: 'test.job', payload: { hello: 'world' } });
    const result = await worker.processNext();

    expect(result).toEqual({ jobId: expect.any(String), type: 'test.job', outcome: 'succeeded' });
    expect(received).toEqual([{ hello: 'world' }]);
  });

  it('reports a failed outcome when no handler is registered', async () => {
    const worker = createWorker();
    await worker.enqueue({ id: randomUUID(), type: 'unknown.job', payload: {} });

    const result = await worker.processNext();

    expect(result?.outcome).toBe('failed');
    expect(result?.error).toContain('unknown.job');
  });

  it('reports a failed outcome when the handler throws', async () => {
    const worker = createWorker();
    worker.registerHandler('boom', () => {
      throw new Error('handler exploded');
    });
    await worker.enqueue({ id: randomUUID(), type: 'boom', payload: {} });

    const result = await worker.processNext();

    expect(result).toEqual({
      jobId: expect.any(String),
      type: 'boom',
      outcome: 'failed',
      error: 'handler exploded',
    });
  });

  it('starts consuming, processes an enqueued job, and stops gracefully', async () => {
    const worker = createWorker({ pollIntervalMs: 5 });
    let processed = false;
    worker.registerHandler('test.job', () => {
      processed = true;
    });

    worker.start();
    expect(worker.status()).toBe('running');

    await worker.enqueue({ id: randomUUID(), type: 'test.job', payload: {} });
    await vi.waitFor(() => expect(processed).toBe(true));

    await worker.stop();
    expect(worker.status()).toBe('stopped');
  });
});
