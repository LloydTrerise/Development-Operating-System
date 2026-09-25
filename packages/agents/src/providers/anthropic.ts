import type { AgentUncertainty } from '@devos/contracts';
import type {
  AgentInvocationRequest,
  AgentInvocationResult,
  AgentModelAdapter,
} from '../model-adapter.js';
import { buildAgentPrompt, parseJsonResultText } from './shared-prompt.js';

const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
/** No spec/backlog names a token ceiling for this call — a generous, disclosed default, matching Gemini's own adapter having no explicit output cap either. */
const DEFAULT_MAX_TOKENS = 8192;

export interface AnthropicAdapterOptions {
  apiKey: string;
  baseUrl?: string;
  /** Injectable for tests — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface AnthropicMessagesResponse {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  usage?: AnthropicUsage;
  error?: { type: string; message: string };
}

/**
 * DEVOS-315 (Sprint 53, candidate E30 part 2): a second real
 * `AgentModelAdapter`, backed by the real Anthropic Messages API, behind the
 * same unchanged port `createGeminiModelAdapter` (DEVOS-027) implements —
 * proves the DEVOS-314 registry is real, not aspirational, mirroring
 * DEVOS-195's own "second real adapter behind the same port" precedent
 * (a real GitLab `PullRequestProvider` alongside the real GitHub one).
 * Anthropic was the disclosed implementation choice for this sprint's own
 * flagged-open "which second provider" decision (see `specs/sprints/
 * sprint-53/README.md`).
 *
 * Uses the plain REST API via fetch, exactly like `createGeminiModelAdapter`
 * — no `@anthropic-ai/sdk` dependency, keeping the adapter boundary
 * (packages/agents) free of any provider SDK leaking into the rest of the
 * codebase, matching the Gemini adapter's own stated rationale.
 *
 * Builds the exact same prompt text as Gemini's adapter (`buildAgentPrompt`,
 * shared) and asks for a single JSON object in response, since Anthropic's
 * Messages API has no equivalent to Gemini's `responseMimeType:
 * "application/json"` generation-config field — the instruction embedded in
 * the prompt text is the only mechanism available.
 */
export function createAnthropicModelAdapter(options: AnthropicAdapterOptions): AgentModelAdapter {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async invoke(request: AgentInvocationRequest): Promise<AgentInvocationResult> {
      const model = request.configuration.modelRef;
      const url = `${baseUrl}/messages`;

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': options.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model,
            max_tokens: DEFAULT_MAX_TOKENS,
            messages: [{ role: 'user', content: buildAgentPrompt(request) }],
          }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown network error.';
        return { status: 'FAILED', errorMessage: `Anthropic request failed: ${message}` };
      }

      const body = (await response.json().catch(() => undefined)) as
        AnthropicMessagesResponse | undefined;

      if (!response.ok) {
        const message = body?.error?.message ?? `${response.status} ${response.statusText}`;
        return {
          status: 'FAILED',
          errorMessage: `Anthropic returned ${response.status} ${response.statusText}: ${message}`,
        };
      }

      const text = body?.content?.find((block) => block.type === 'text')?.text;
      if (text === undefined) {
        return { status: 'FAILED', errorMessage: 'Anthropic returned no text content block.' };
      }

      if (body?.stop_reason !== undefined && body.stop_reason !== 'end_turn') {
        return {
          status: 'FAILED',
          errorMessage: `Anthropic finished with stop_reason "${body.stop_reason}" instead of "end_turn".`,
        };
      }

      const parsed = parseJsonResultText(text);
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
      const usage = body?.usage;
      if (usage?.input_tokens !== undefined && usage.output_tokens !== undefined) {
        invocationResult = {
          ...invocationResult,
          usage: {
            promptTokens: usage.input_tokens,
            candidatesTokens: usage.output_tokens,
            totalTokens: usage.input_tokens + usage.output_tokens,
          },
        };
      }
      return invocationResult;
    },
  };
}
