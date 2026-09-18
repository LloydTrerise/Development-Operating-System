import { describe, expect, it, vi } from 'vitest';
import { createRenderDeploymentProvider } from '../src/deployment/render-deployment-provider.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createRenderDeploymentProvider', () => {
  it('triggers a deploy, polls until live, and resolves the real service URL', async () => {
    const fetchImpl = vi
      .fn()
      // POST trigger
      .mockResolvedValueOnce(jsonResponse(201, { id: 'dep-1', status: 'build_in_progress' }))
      // poll #1: still in progress
      .mockResolvedValueOnce(jsonResponse(200, { id: 'dep-1', status: 'build_in_progress' }))
      // poll #2: live
      .mockResolvedValueOnce(jsonResponse(200, { id: 'dep-1', status: 'live' }))
      // GET service
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'srv-1',
          serviceDetails: { url: 'https://devos-pilot.onrender.com' },
        }),
      );

    const provider = createRenderDeploymentProvider({
      apiKey: 'render-test-key',
      serviceId: 'srv-1',
      fetchImpl,
      pollIntervalMs: 0,
    });

    const record = await provider.deploy({ environment: 'staging', revision: 'abc123' });

    expect(record).toEqual({
      id: 'dep-1',
      environment: 'staging',
      revision: 'abc123',
      url: 'https://devos-pilot.onrender.com',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);

    const [postUrl, postInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(postUrl).toBe('https://api.render.com/v1/services/srv-1/deploys');
    expect((postInit.headers as Record<string, string>).authorization).toBe(
      'Bearer render-test-key',
    );
    expect(JSON.parse(postInit.body as string)).toEqual({ commitId: 'abc123' });
  });

  it('throws when the deploy ends in a failure status, without exposing the API key', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, { id: 'dep-2', status: 'build_in_progress' }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'dep-2', status: 'build_failed' }));

    const provider = createRenderDeploymentProvider({
      apiKey: 'super-secret-render-key',
      serviceId: 'srv-1',
      fetchImpl,
      pollIntervalMs: 0,
    });

    await expect(provider.deploy({ environment: 'staging', revision: 'abc123' })).rejects.toThrow(
      /status "build_failed"/,
    );
    await expect(
      provider.deploy({ environment: 'staging', revision: 'abc123' }),
    ).rejects.not.toThrow(/super-secret-render-key/);
  });

  it('throws when the deploy never reaches a terminal state within maxPollAttempts', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, { id: 'dep-3', status: 'build_in_progress' }))
      .mockImplementation(() =>
        Promise.resolve(jsonResponse(200, { id: 'dep-3', status: 'build_in_progress' })),
      );

    const provider = createRenderDeploymentProvider({
      apiKey: 'render-test-key',
      serviceId: 'srv-1',
      fetchImpl,
      pollIntervalMs: 0,
      maxPollAttempts: 3,
    });

    await expect(provider.deploy({ environment: 'staging', revision: 'abc123' })).rejects.toThrow(
      /did not reach a terminal state/,
    );
  });

  it('throws with status and body, without exposing the API key, on a failed trigger request', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response('forbidden', { status: 403 }));

    const provider = createRenderDeploymentProvider({
      apiKey: 'super-secret-render-key',
      serviceId: 'srv-1',
      fetchImpl,
      pollIntervalMs: 0,
    });

    await expect(provider.deploy({ environment: 'staging', revision: 'abc123' })).rejects.toThrow(
      /status 403/,
    );
  });
});
