import type {
  AgentInvocationRequest,
  AgentInvocationResult,
  AgentModelAdapter,
} from '../model-adapter.js';
import { createModelAdapterForProvider, type LlmProviderKey } from './registry.js';

export interface ResolvingModelAdapterOptions {
  /**
   * The platform-wide default provider/credential — `apps/worker`'s own
   * resolved `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` today, selected via the
   * new `LLM_DEFAULT_PROVIDER` config value (defaults to `'gemini'`,
   * preserving today's exact behavior).
   */
  defaultProvider: LlmProviderKey;
  defaultCredential: string;
  /** Per-provider base URL override — tests/pilots only; unset uses each provider's own real default. */
  baseUrlsByProvider?: Partial<Record<LlmProviderKey, string>>;
  /** Injectable for tests — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * DEVOS-316 (Sprint 53): replaces `apps/worker/src/main.ts`'s own boot-time
 * `const modelAdapter = await resolveAgentModelAdapter()` (the backlog's own
 * §2.1-named gap) — this `AgentModelAdapter`'s `invoke()` constructs a real
 * concrete provider adapter fresh on every call via the DEVOS-314 registry,
 * instead of one instance built once at boot and reused for the process's
 * lifetime. Real per-task resolution, not a placeholder — but, per this
 * sprint's own disclosed scope (`specs/sprints/sprint-53/README.md`), every
 * `request.organisationId` resolves to the same real platform-wide default
 * given here: Sprint 54's own `organisation_llm_providers`-backed ranked
 * fallback chain is what makes that value start actually differentiating
 * which provider gets used.
 */
export function createResolvingModelAdapter(
  options: ResolvingModelAdapterOptions,
): AgentModelAdapter {
  return {
    async invoke(request: AgentInvocationRequest): Promise<AgentInvocationResult> {
      const provider = options.defaultProvider;
      const baseUrl = options.baseUrlsByProvider?.[provider];
      const adapter = createModelAdapterForProvider(provider, {
        apiKey: options.defaultCredential,
        ...(baseUrl !== undefined ? { baseUrl } : {}),
        ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
      });
      return adapter.invoke(request);
    },
  };
}
