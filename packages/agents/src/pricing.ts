import type { AgentInvocationUsage } from './model-adapter.js';

/**
 * DEVOS-089: no per-token pricing table is specified anywhere in the spec
 * corpus, and `specs/api/poc-api-contracts.md` §51 explicitly defers
 * "advanced cost/budget contracts" — this is a real, but explicitly
 * approximate, estimate, not an authoritative billing figure. Rates below
 * are Gemini's own published free/paid-tier flash-model pricing at the
 * time of writing (USD per 1,000 tokens); an unrecognised `modelReference`
 * falls back to the default rate rather than throwing, since the point is
 * a rough estimate, not exact accounting.
 */
const USD_PER_1K_PROMPT_TOKENS = 0.000075;
const USD_PER_1K_CANDIDATES_TOKENS = 0.0003;

interface ModelRate {
  usdPer1kPromptTokens: number;
  usdPer1kCandidatesTokens: number;
}

/**
 * DEVOS-149: real per-model rates, keyed by the exact model identifier
 * `createGeminiModelAdapter` sends as `AgentInvocationResult.modelReference`
 * (`request.configuration.modelRef`). `gemini-3.6-flash` — the one model
 * actually in production use today (every existing test fixture) — is
 * pinned to the pre-existing default rate above byte-for-byte, so today's
 * behaviour is unchanged. `gemini-3.6-pro`'s rate is Gemini's own published
 * pro-tier pricing at the time of writing (higher than flash), added ahead
 * of any real pro-tier call site so the table already distinguishes models
 * once one is used. An unrecognised or absent `modelReference` falls back
 * to the same default rate.
 */
const MODEL_RATES: Record<string, ModelRate> = {
  'gemini-3.6-flash': {
    usdPer1kPromptTokens: USD_PER_1K_PROMPT_TOKENS,
    usdPer1kCandidatesTokens: USD_PER_1K_CANDIDATES_TOKENS,
  },
  'gemini-3.6-pro': {
    usdPer1kPromptTokens: 0.00125,
    usdPer1kCandidatesTokens: 0.005,
  },
};

const DEFAULT_RATE: ModelRate = {
  usdPer1kPromptTokens: USD_PER_1K_PROMPT_TOKENS,
  usdPer1kCandidatesTokens: USD_PER_1K_CANDIDATES_TOKENS,
};

export function estimateCostUsd(usage: AgentInvocationUsage, modelReference?: string): number {
  const rate: ModelRate =
    (modelReference !== undefined ? MODEL_RATES[modelReference] : undefined) ?? DEFAULT_RATE;
  const promptCost = (usage.promptTokens / 1000) * rate.usdPer1kPromptTokens;
  const candidatesCost = (usage.candidatesTokens / 1000) * rate.usdPer1kCandidatesTokens;
  return promptCost + candidatesCost;
}
