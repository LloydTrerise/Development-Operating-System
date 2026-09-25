import type { AgentModelAdapter } from '../model-adapter.js';
import { createAnthropicModelAdapter } from './anthropic.js';
import { createGeminiModelAdapter } from './gemini.js';

/**
 * DEVOS-314 (Sprint 53): the real provider-keyed factory the backlog's own
 * §2.3/§5.2 names — replaces `apps/worker/src/main.ts`'s own single
 * hardcoded `createGeminiModelAdapter({ apiKey })` call with a registry
 * where Gemini is one registered provider among others, not a special case.
 * Both registered adapters share the exact same credential-options shape
 * (`apiKey`/`baseUrl?`/`fetchImpl?`), so one factory signature covers both.
 */
export const LLM_PROVIDER_KEYS = ['gemini', 'anthropic'] as const;

export type LlmProviderKey = (typeof LLM_PROVIDER_KEYS)[number];

export function isLlmProviderKey(value: string): value is LlmProviderKey {
  return (LLM_PROVIDER_KEYS as readonly string[]).includes(value);
}

export interface ModelAdapterCredentialOptions {
  apiKey: string;
  baseUrl?: string;
  /** Injectable for tests — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

const MODEL_ADAPTER_FACTORIES: Record<
  LlmProviderKey,
  (options: ModelAdapterCredentialOptions) => AgentModelAdapter
> = {
  gemini: createGeminiModelAdapter,
  anthropic: createAnthropicModelAdapter,
};

export function createModelAdapterForProvider(
  provider: LlmProviderKey,
  options: ModelAdapterCredentialOptions,
): AgentModelAdapter {
  return MODEL_ADAPTER_FACTORIES[provider](options);
}
