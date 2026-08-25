import type { AgentInvocationUsage } from './model-adapter.js';

/**
 * DEVOS-089: no per-token pricing table is specified anywhere in the spec
 * corpus, and `specs/api/poc-api-contracts.md` §51 explicitly defers
 * "advanced cost/budget contracts" — this is a real, but explicitly
 * approximate, estimate, not an authoritative billing figure. Rates below
 * are Gemini's own published free/paid-tier flash-model pricing at the
 * time of writing (USD per 1,000 tokens); an unrecognised `modelRef` falls
 * back to the default rate rather than throwing, since the point is a
 * rough estimate, not exact accounting.
 */
const USD_PER_1K_PROMPT_TOKENS = 0.000075;
const USD_PER_1K_CANDIDATES_TOKENS = 0.0003;

export function estimateCostUsd(usage: AgentInvocationUsage): number {
  const promptCost = (usage.promptTokens / 1000) * USD_PER_1K_PROMPT_TOKENS;
  const candidatesCost = (usage.candidatesTokens / 1000) * USD_PER_1K_CANDIDATES_TOKENS;
  return promptCost + candidatesCost;
}
