import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type {
  WorkflowDefinition,
  WorkflowDefinitionRepository,
  WorkflowVersion,
  WorkflowVersionRepository,
} from '@devos/domain';
import { createMetricsRegistry } from '@devos/observability';
import { afterEach, describe, expect, it } from 'vitest';
import type { GetSlowestWorkflowsDeps } from '../src/get-slowest-workflows.js';
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

  it('DEVOS-170: serves a real ranked slowest-workflows JSON list on GET /slowest-workflows when deps are supplied', async () => {
    const metrics = createMetricsRegistry();
    const workflowVersionId = randomUUID() as WorkflowVersion['id'];
    const workflowDefinitionId = randomUUID() as WorkflowDefinition['id'];

    metrics.observeHistogram('workflow_task.duration_ms', 500, {
      taskType: 'AGENT_TASK',
      workflowVersionId,
    });
    metrics.observeHistogram('workflow_task.duration_ms', 1500, {
      taskType: 'TOOL_TASK',
      workflowVersionId,
    });

    const version: WorkflowVersion = {
      id: workflowVersionId,
      workflowDefinitionId,
      version: 1,
      status: 'PUBLISHED',
      definition: {
        name: 'Test Workflow',
        trigger: { type: 'WORK_ITEM_MANUAL' },
        inputs: [],
        nodes: [],
        edges: [],
        policies: [],
        outputs: [],
      },
      publishedAt: new Date().toISOString(),
      createdBy: 'test',
      createdAt: new Date().toISOString(),
    };
    const definition: WorkflowDefinition = {
      id: workflowDefinitionId,
      projectId: randomUUID() as WorkflowDefinition['projectId'],
      key: 'test-workflow',
      name: 'Test Workflow',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const workflowVersions: WorkflowVersionRepository = {
      getById: async (id) => (id === version.id ? version : null),
      getByDefinitionAndVersion: async () => null,
      getLatestForDefinition: async () => null,
      listForDefinition: async () => [],
      create: async () => {},
    };
    const workflowDefinitions: WorkflowDefinitionRepository = {
      getById: async (id) => (id === definition.id ? definition : null),
      getByProjectAndKey: async () => null,
      listForProject: async () => [],
      create: async () => {},
    };
    const deps: GetSlowestWorkflowsDeps = { workflowVersions, workflowDefinitions };

    server = startMetricsServer(metrics, 0, deps);
    const port = (server.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/slowest-workflows`);
    const body = (await response.json()) as {
      workflowVersionId: string;
      workflowDefinitionName: string;
      meanDurationMs: number;
      taskCount: number;
    }[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]!.workflowVersionId).toBe(workflowVersionId);
    expect(body[0]!.workflowDefinitionName).toBe('Test Workflow');
    expect(body[0]!.meanDurationMs).toBe(1000);
    expect(body[0]!.taskCount).toBe(2);
  });

  it('returns 404 for /slowest-workflows when no deps are supplied (existing /metrics-only behaviour unaffected)', async () => {
    const metrics = createMetricsRegistry();
    server = startMetricsServer(metrics, 0);
    const port = (server.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/slowest-workflows`);
    expect(response.status).toBe(404);
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
