import { describe, expect, it, vi } from 'vitest';
import { createAnthropicModelAdapter } from '../src/providers/anthropic.js';
import type { AgentInvocationRequest } from '../src/model-adapter.js';

const REQUEST: AgentInvocationRequest = {
  configuration: {
    role: 'REQUIREMENTS',
    provider: 'anthropic',
    modelRef: 'claude-sonnet-5',
    allowedCapabilities: [],
  },
  organisationId: 'org-1' as AgentInvocationRequest['organisationId'],
  objective: 'Produce a PRD.',
  input: { workItemId: 'wi-1' },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createAnthropicModelAdapter', () => {
  it('sends the API key and model, and parses a JSON text block into result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        content: [{ type: 'text', text: '{"summary":"A validated PRD."}' }],
        stop_reason: 'end_turn',
      }),
    );

    const adapter = createAnthropicModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result).toEqual({
      status: 'SUCCEEDED',
      result: { summary: 'A validated PRD.' },
      modelReference: 'claude-sonnet-5',
    });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('test-key');
    expect((init.headers as Record<string, string>)['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('claude-sonnet-5');
    expect(body.messages[0].content).toContain(REQUEST.objective);
  });

  it('separates a top-level uncertainty array from the rest of the result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'Partial PRD.',
              uncertainty: [{ statement: 'Target API is undocumented.', severity: 'MEDIUM' }],
            }),
          },
        ],
        stop_reason: 'end_turn',
      }),
    );

    const adapter = createAnthropicModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.status).toBe('SUCCEEDED');
    expect(result.result).toEqual({ summary: 'Partial PRD.' });
    expect(result.uncertainty).toEqual([
      { statement: 'Target API is undocumented.', severity: 'MEDIUM' },
    ]);
  });

  it('falls back to a text-wrapped result when the text block is not valid JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        content: [{ type: 'text', text: 'not json' }],
        stop_reason: 'end_turn',
      }),
    );

    const adapter = createAnthropicModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result).toMatchObject({ status: 'SUCCEEDED', result: { text: 'not json' } });
  });

  it('reports FAILED on a non-ok HTTP response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(500, { error: { type: 'api_error', message: 'boom' } }));

    const adapter = createAnthropicModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('500');
  });

  it('reports FAILED when no text content block is present', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { content: [], stop_reason: 'end_turn' }));

    const adapter = createAnthropicModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('no text content block');
  });

  it('reports FAILED when stop_reason is not end_turn', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        content: [{ type: 'text', text: '{}' }],
        stop_reason: 'max_tokens',
      }),
    );

    const adapter = createAnthropicModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('max_tokens');
  });

  it("DEVOS-089 parity: records real token usage from the response's usage block", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        content: [{ type: 'text', text: '{"summary":"A validated PRD."}' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 123, output_tokens: 45 },
      }),
    );

    const adapter = createAnthropicModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.usage).toEqual({ promptTokens: 123, candidatesTokens: 45, totalTokens: 168 });
  });

  it('omits usage when the response has no usage block', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        content: [{ type: 'text', text: '{}' }],
        stop_reason: 'end_turn',
      }),
    );

    const adapter = createAnthropicModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.usage).toBeUndefined();
  });

  it('reports FAILED when fetch itself rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('DNS lookup failed'));

    const adapter = createAnthropicModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('DNS lookup failed');
  });
});
