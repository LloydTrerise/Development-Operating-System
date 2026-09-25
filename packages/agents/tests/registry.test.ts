import { describe, expect, it, vi } from 'vitest';
import {
  createModelAdapterForProvider,
  isLlmProviderKey,
  LLM_PROVIDER_KEYS,
} from '../src/providers/registry.js';
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

describe('LLM provider registry', () => {
  it('DEVOS-314: registers exactly gemini and anthropic', () => {
    expect(LLM_PROVIDER_KEYS).toEqual(['gemini', 'anthropic']);
  });

  it('isLlmProviderKey recognizes registered keys and rejects unknown strings', () => {
    expect(isLlmProviderKey('gemini')).toBe(true);
    expect(isLlmProviderKey('anthropic')).toBe(true);
    expect(isLlmProviderKey('openai')).toBe(false);
  });

  it('createModelAdapterForProvider("gemini") builds a real Gemini-shaped adapter', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: '{}' }] }, finishReason: 'STOP' }],
      }),
    );
    const adapter = createModelAdapterForProvider('gemini', { apiKey: 'k', fetchImpl });
    await adapter.invoke(REQUEST);
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain('generativelanguage.googleapis.com');
  });

  it('createModelAdapterForProvider("anthropic") builds a real Anthropic-shaped adapter', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn' }),
      );
    const adapter = createModelAdapterForProvider('anthropic', { apiKey: 'k', fetchImpl });
    await adapter.invoke(REQUEST);
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain('api.anthropic.com');
  });
});
