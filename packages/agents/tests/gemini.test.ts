import { describe, expect, it, vi } from 'vitest';
import { createGeminiModelAdapter } from '../src/providers/gemini.js';
import type { AgentInvocationRequest } from '../src/model-adapter.js';

const REQUEST: AgentInvocationRequest = {
  configuration: {
    role: 'REQUIREMENTS',
    provider: 'gemini',
    modelRef: 'gemini-3.6-flash',
    allowedCapabilities: [],
  },
  objective: 'Produce a PRD.',
  input: { workItemId: 'wi-1' },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createGeminiModelAdapter', () => {
  it('sends the API key and model, and parses a JSON candidate into result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        candidates: [
          {
            content: { parts: [{ text: '{"summary":"A validated PRD."}' }] },
            finishReason: 'STOP',
          },
        ],
      }),
    );

    const adapter = createGeminiModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result).toEqual({
      status: 'SUCCEEDED',
      result: { summary: 'A validated PRD.' },
      modelReference: 'gemini-3.6-flash',
    });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/models/gemini-3.6-flash:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].text).toContain(REQUEST.objective);
  });

  it('separates a top-level uncertainty array from the rest of the result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: 'Partial PRD.',
                    uncertainty: [{ statement: 'Target API is undocumented.', severity: 'MEDIUM' }],
                  }),
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      }),
    );

    const adapter = createGeminiModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.status).toBe('SUCCEEDED');
    expect(result.result).toEqual({ summary: 'Partial PRD.' });
    expect(result.uncertainty).toEqual([
      { statement: 'Target API is undocumented.', severity: 'MEDIUM' },
    ]);
  });

  it('falls back to a text-wrapped result when the candidate text is not valid JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: 'not json' }] }, finishReason: 'STOP' }],
      }),
    );

    const adapter = createGeminiModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result).toMatchObject({ status: 'SUCCEEDED', result: { text: 'not json' } });
  });

  it('reports FAILED on a non-ok HTTP response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('server error', { status: 500 }));

    const adapter = createGeminiModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('500');
  });

  it('reports FAILED when the prompt is blocked', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } }));

    const adapter = createGeminiModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('SAFETY');
  });

  it('reports FAILED when the candidate finishes for a reason other than STOP', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: '{}' }] }, finishReason: 'MAX_TOKENS' }],
      }),
    );

    const adapter = createGeminiModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('MAX_TOKENS');
  });

  it("DEVOS-089: records real token usage from the response's usageMetadata", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        candidates: [
          {
            content: { parts: [{ text: '{"summary":"A validated PRD."}' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 123,
          candidatesTokenCount: 45,
          totalTokenCount: 168,
        },
      }),
    );

    const adapter = createGeminiModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.usage).toEqual({ promptTokens: 123, candidatesTokens: 45, totalTokens: 168 });
  });

  it('DEVOS-089: omits usage when the response has no usageMetadata', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: '{}' }] }, finishReason: 'STOP' }],
      }),
    );

    const adapter = createGeminiModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.usage).toBeUndefined();
  });

  it('reports FAILED when fetch itself rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('DNS lookup failed'));

    const adapter = createGeminiModelAdapter({ apiKey: 'test-key', fetchImpl });
    const result = await adapter.invoke(REQUEST);

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('DNS lookup failed');
  });
});
