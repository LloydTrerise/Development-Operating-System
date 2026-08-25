import type { AgentUncertainty } from '@devos/contracts';
import type {
  AgentInvocationRequest,
  AgentInvocationResult,
  AgentModelAdapter,
} from '../model-adapter.js';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiAdapterOptions {
  apiKey: string;
  baseUrl?: string;
  /** Injectable for tests — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

interface GeminiCandidate {
  content?: { parts?: { text?: string }[] };
  finishReason?: string;
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: GeminiUsageMetadata;
}

function buildPrompt(request: AgentInvocationRequest): string {
  return [
    // DEVOS-028: resolved prompt text (from the agent version's
    // promptReference) leads, when present, so it genuinely shapes the
    // model's behavior rather than being inert metadata.
    request.systemInstructions,
    `You are an agent performing the "${request.configuration.role}" role in an automated software engineering pipeline.`,
    `Objective: ${request.objective}`,
    `Input (JSON): ${JSON.stringify(request.input)}`,
    'Respond with a single JSON object containing your result. Do not include any text outside the JSON object.',
    'If required information is missing or uncertain, include an "uncertainty" array of { "statement": string, "severity": "LOW" | "MEDIUM" | "HIGH" } entries rather than inventing a value.',
  ]
    .filter((part): part is string => part !== undefined)
    .join('\n\n');
}

function parseResultText(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { text };
  }
}

/**
 * Concrete AgentModelAdapter for Google Gemini (DEVOS-027) — this project's
 * chosen provider (free tier; see DEVOS-SPRINT1-DECISIONS.md-style project
 * memory for why). Uses the plain REST API via fetch rather than adding the
 * @google/genai SDK dependency: a single generateContent call doesn't need
 * an SDK, and this keeps the adapter boundary (packages/agents) free of any
 * provider SDK leaking into the rest of the codebase.
 *
 * promptReference (from the agent version) is not yet resolved into actual
 * stored prompt text — that's DEVOS-028 (prompt/version management), not
 * yet implemented. Until then, the prompt is built inline from the
 * objective/role/input every call.
 */
export function createGeminiModelAdapter(options: GeminiAdapterOptions): AgentModelAdapter {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async invoke(request: AgentInvocationRequest): Promise<AgentInvocationResult> {
      const model = request.configuration.modelRef;
      const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': options.apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: buildPrompt(request) }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown network error.';
        return { status: 'FAILED', errorMessage: `Gemini request failed: ${message}` };
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        return {
          status: 'FAILED',
          errorMessage: `Gemini returned ${response.status} ${response.statusText}: ${bodyText}`,
        };
      }

      const body = (await response.json()) as GeminiGenerateContentResponse;

      if (body.promptFeedback?.blockReason !== undefined) {
        return {
          status: 'FAILED',
          errorMessage: `Gemini blocked the request: ${body.promptFeedback.blockReason}`,
        };
      }

      const candidate = body.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      if (text === undefined) {
        return { status: 'FAILED', errorMessage: 'Gemini returned no candidate text.' };
      }

      if (candidate?.finishReason !== undefined && candidate.finishReason !== 'STOP') {
        return {
          status: 'FAILED',
          errorMessage: `Gemini finished with reason "${candidate.finishReason}" instead of STOP.`,
        };
      }

      const parsed = parseResultText(text);
      const uncertaintyRaw = parsed.uncertainty;
      const result: Record<string, unknown> = { ...parsed };
      delete result.uncertainty;

      let invocationResult: AgentInvocationResult = {
        status: 'SUCCEEDED',
        result,
        modelReference: model,
      };
      if (Array.isArray(uncertaintyRaw)) {
        invocationResult = {
          ...invocationResult,
          uncertainty: uncertaintyRaw as AgentUncertainty[],
        };
      }
      const usage = body.usageMetadata;
      if (
        usage?.promptTokenCount !== undefined &&
        usage.candidatesTokenCount !== undefined &&
        usage.totalTokenCount !== undefined
      ) {
        invocationResult = {
          ...invocationResult,
          usage: {
            promptTokens: usage.promptTokenCount,
            candidatesTokens: usage.candidatesTokenCount,
            totalTokens: usage.totalTokenCount,
          },
        };
      }
      return invocationResult;
    },
  };
}
