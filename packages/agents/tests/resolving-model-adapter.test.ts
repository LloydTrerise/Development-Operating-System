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

  describe('ranked fallback chain (DEVOS-319)', () => {
    function geminiOkResponse(): Response {
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: '{"from":"gemini"}' }] }, finishReason: 'STOP' }],
      });
    }

    function anthropicOkResponse(): Response {
      return jsonResponse({
        content: [{ type: 'text', text: '{"from":"anthropic"}' }],
        stop_reason: 'end_turn',
      });
    }

    it('falls through to the platform default when no candidate list is supplied (Sprint 53 behavior unchanged)', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(geminiOkResponse());
      const adapter = createResolvingModelAdapter({
        defaultProvider: 'gemini',
        defaultCredential: 'default-key',
        fetchImpl,
      });

      const result = await adapter.invoke(REQUEST);

      expect(result.result).toEqual({ from: 'gemini' });
      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('default-key');
    });

    it('falls through to the platform default when the candidate list is empty', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(geminiOkResponse());
      const adapter = createResolvingModelAdapter({
        defaultProvider: 'gemini',
        defaultCredential: 'default-key',
        listProvidersForOrganisation: async () => [],
        resolveCredential: async () => 'unused',
        fetchImpl,
      });

      await adapter.invoke(REQUEST);

      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('default-key');
    });

    it('uses the top-priority organisation candidate instead of the platform default', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(anthropicOkResponse());
      const adapter = createResolvingModelAdapter({
        defaultProvider: 'gemini',
        defaultCredential: 'default-key',
        listProvidersForOrganisation: async () => [
          { provider: 'anthropic', credentialReference: 'org-anthropic-ref' },
        ],
        resolveCredential: async (reference) =>
          reference === 'org-anthropic-ref' ? 'org-anthropic-key' : null,
        fetchImpl,
      });

      const result = await adapter.invoke(REQUEST);

      expect(result.result).toEqual({ from: 'anthropic' });
      const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('api.anthropic.com');
      expect((init.headers as Record<string, string>)['x-api-key']).toBe('org-anthropic-key');
    });

    it('skips a candidate whose credential is unconfigured (resolves to null) and falls to the next', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(anthropicOkResponse());
      const adapter = createResolvingModelAdapter({
        defaultProvider: 'gemini',
        defaultCredential: 'default-key',
        listProvidersForOrganisation: async () => [
          { provider: 'gemini', credentialReference: 'unconfigured-ref' },
          { provider: 'anthropic', credentialReference: 'org-anthropic-ref' },
        ],
        resolveCredential: async (reference) =>
          reference === 'org-anthropic-ref' ? 'org-anthropic-key' : null,
        fetchImpl,
      });

      const result = await adapter.invoke(REQUEST);

      expect(result.result).toEqual({ from: 'anthropic' });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('skips a candidate whose invoke() throws (failing) and falls to the next', async () => {
      const fetchImpl = vi
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce(anthropicOkResponse());
      const adapter = createResolvingModelAdapter({
        defaultProvider: 'gemini',
        defaultCredential: 'default-key',
        listProvidersForOrganisation: async () => [
          { provider: 'gemini', credentialReference: 'flaky-ref' },
          { provider: 'anthropic', credentialReference: 'org-anthropic-ref' },
        ],
        resolveCredential: async () => 'some-key',
        fetchImpl,
      });

      const result = await adapter.invoke(REQUEST);

      expect(result.result).toEqual({ from: 'anthropic' });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('falls through to the platform default when every candidate is unconfigured or failing', async () => {
      const fetchImpl = vi
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce(geminiOkResponse());
      const adapter = createResolvingModelAdapter({
        defaultProvider: 'gemini',
        defaultCredential: 'default-key',
        listProvidersForOrganisation: async () => [
          { provider: 'anthropic', credentialReference: 'unconfigured-ref' },
          { provider: 'gemini', credentialReference: 'flaky-ref' },
        ],
        resolveCredential: async (reference) => (reference === 'flaky-ref' ? 'flaky-key' : null),
        fetchImpl,
      });

      const result = await adapter.invoke(REQUEST);

      expect(result.result).toEqual({ from: 'gemini' });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      const [, secondInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
      expect((secondInit.headers as Record<string, string>)['x-goog-api-key']).toBe('default-key');
    });

    it('skips a candidate registering an unknown provider key', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(anthropicOkResponse());
      const adapter = createResolvingModelAdapter({
        defaultProvider: 'gemini',
        defaultCredential: 'default-key',
        listProvidersForOrganisation: async () => [
          { provider: 'openai', credentialReference: 'unregistered-ref' },
          { provider: 'anthropic', credentialReference: 'org-anthropic-ref' },
        ],
        resolveCredential: async () => 'some-key',
        fetchImpl,
      });

      const result = await adapter.invoke(REQUEST);

      expect(result.result).toEqual({ from: 'anthropic' });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });
});
