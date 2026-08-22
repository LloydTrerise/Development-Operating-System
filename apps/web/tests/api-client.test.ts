import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEV_PRINCIPAL_ID, getHealth, listProjects, startRun } from '../src/api-client.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns health data on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { data: { status: 'ok' }, meta: { requestId: 'req-1' } }),
        ),
    );

    const result = await getHealth();

    expect(result).toEqual({ ok: true, data: { status: 'ok' }, requestId: 'req-1' });
  });

  it('returns the standard error envelope when the API reports an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(500, {
          error: { code: 'DEVOS_INTERNAL_ERROR', message: 'boom' },
          meta: { requestId: 'req-2' },
        }),
      ),
    );

    const result = await getHealth();

    expect(result).toEqual({
      ok: false,
      error: { code: 'DEVOS_INTERNAL_ERROR', message: 'boom' },
      requestId: 'req-2',
    });
  });

  it('sends the dev principal as a bearer token on authenticated requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: [], meta: { requestId: 'req-3' } }));
    vi.stubGlobal('fetch', fetchMock);

    await listProjects();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${DEV_PRINCIPAL_ID}`,
    );
  });

  it('reports a network error without throwing when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    const result = await listProjects();

    expect(result).toEqual({
      ok: false,
      error: { code: 'DEVOS_NETWORK_ERROR', message: 'connection refused' },
      requestId: '',
    });
  });

  it('starts a run with the given work item and a generated idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'run-1', status: 'PENDING' },
        meta: { requestId: 'req-4' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await startRun('workflow-1', {
      workItemId: 'work-item-1',
      idempotencyKey: 'idem-1',
    });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/workflows/workflow-1/runs');
    expect(JSON.parse(init.body as string)).toEqual({
      inputs: {},
      workItemId: 'work-item-1',
      idempotencyKey: 'idem-1',
    });
  });
});
