import type { AddressInfo } from 'node:net';
import { createMetricsRegistry } from '@devos/observability';
import { afterEach, describe, expect, it } from 'vitest';
import { startMetricsServer } from '../src/metrics-server.js';

describe('startMetricsServer (DEVOS-117, real HTTP server on a real ephemeral port)', () => {
  let server: ReturnType<typeof startMetricsServer> | undefined;

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  });

  it('serves the real registry snapshot as Prometheus text on GET /metrics', async () => {
    const metrics = createMetricsRegistry();
    metrics.incrementCounter('task_queue.claimed', { taskType: 'TOOL_TASK' }, 2);

    // Port 0: the OS assigns a real free ephemeral port — no fixed-port
    // collision risk across concurrent test files.
    server = startMetricsServer(metrics, 0);
    const port = (server.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/metrics`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(body).toContain('task_queue_claimed{taskType="TOOL_TASK"} 2');
  });

  it('reflects a metric recorded after the server started (reads the live registry, not a snapshot taken at startup)', async () => {
    const metrics = createMetricsRegistry();
    server = startMetricsServer(metrics, 0);
    const port = (server.address() as AddressInfo).port;

    metrics.incrementCounter('workflow_run_completed');
    const response = await fetch(`http://127.0.0.1:${port}/metrics`);
    const body = await response.text();

    expect(body).toContain('workflow_run_completed 1');
  });

  it('returns 404 for any other path or method', async () => {
    const metrics = createMetricsRegistry();
    server = startMetricsServer(metrics, 0);
    const port = (server.address() as AddressInfo).port;

    const wrongPath = await fetch(`http://127.0.0.1:${port}/not-metrics`);
    expect(wrongPath.status).toBe(404);

    const wrongMethod = await fetch(`http://127.0.0.1:${port}/metrics`, { method: 'POST' });
    expect(wrongMethod.status).toBe(404);
  });
});
