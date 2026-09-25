import { describe, expect, it, vi } from 'vitest';
import { createResolvingModelAdapter } from '../src/providers/resolving-model-adapter.js';
import type { AgentInvocationRequest } from '../src/model-adapter.js';

const REQUEST: AgentInvocationRequest = {
  configuration: {
    role: 'REQUIREMENTS',
    provider: 'gemini',
    modelRef: 'some-model',
    allowedCapabilities: [],
  },
  organisationId: 'org-1' as AgentInvocationRequest['organisationId'],
  objective: 'Produce a PRD.',
  input: {},
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createResolvingModelAdapter (DEVOS-316)', () => {
  it('resolves and invokes the configured default provider on every call — a fresh adapter per call, not a memoized one', async () => {
    const fetchImpl = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: 'STOP' }],
        }),
      ),
    );
    const adapter = createResolvingModelAdapter({
      defaultProvider: 'gemini',
      defaultCredential: 'test-key',
      fetchImpl,
    });

    const first = await adapter.invoke(REQUEST);
    const second = await adapter.invoke(REQUEST);

    expect(first).toEqual({
      status: 'SUCCEEDED',
      result: { ok: true },
      modelReference: 'some-model',
    });
    expect(second).toEqual(first);
    // Real per-call resolution: fetch was called once per invocation, not
    // cached/short-circuited by a memoized adapter instance.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('routes to the anthropic provider when configured as the default', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn' }),
      );
    const adapter = createResolvingModelAdapter({
      defaultProvider: 'anthropic',
      defaultCredential: 'test-key',
      fetchImpl,
    });

    const result = await adapter.invoke(REQUEST);

    expect(result).toEqual({
      status: 'SUCCEEDED',
      result: { ok: true },
      modelReference: 'some-model',
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('api.anthropic.com');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('test-key');
  });

  it('applies a per-provider baseUrl override when given', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: '{}' }] }, finishReason: 'STOP' }],
      }),
    );
    const adapter = createResolvingModelAdapter({
      defaultProvider: 'gemini',
      defaultCredential: 'test-key',
      baseUrlsByProvider: { gemini: 'http://localhost:9999/fake-gemini' },
      fetchImpl,
    });

    await adapter.invoke(REQUEST);

    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain('http://localhost:9999/fake-gemini');
  });
});
