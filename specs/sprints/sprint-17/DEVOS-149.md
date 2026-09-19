# DEVOS-149 — Real per-model cost estimation

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-089 (existing `usage`/`modelReference` capture, already real).
**Depended on by:** DEVOS-150 (breakdown queries read the same `estimated_cost_usd` this task computes).

## Scope

`estimateCostUsd` (`packages/agents/src/pricing.ts`) gains a `modelReference` parameter and a real, disclosed-approximate per-model rate table, falling back to today's single default rate for any unrecognised reference — byte-for-byte identical output for the one model in production use today.

## Implementation

- `estimateCostUsd(usage: AgentInvocationUsage, modelReference?: string): number`.
- New `MODEL_RATES: Record<string, { usdPer1kPromptTokens: number; usdPer1kCandidatesTokens: number }>` keyed by real model identifiers (`gemini-3.6-flash` at minimum, matching `packages/agents/tests/gemini.test.ts`'s own fixture). The existing `USD_PER_1K_PROMPT_TOKENS`/`USD_PER_1K_CANDIDATES_TOKENS` constants become the default/fallback rate, used when `modelReference` is `undefined` or absent from `MODEL_RATES`.
- `packages/application/src/tasks/run-agent-task.ts`'s call site (`estimateCostUsd(invocation.usage)`) becomes `estimateCostUsd(invocation.usage, invocation.modelReference)`.

## Out of scope

A multi-provider rate table for any provider other than Gemini (none exists in this codebase). Fetching live pricing from a provider API (no such API is integrated).

## Acceptance

Every existing `pricing.test.ts`/`gemini.test.ts`/`run-agent-task.test.ts` case passes unmodified. A new `pricing.test.ts` case proves a recognised `modelReference` produces a different (and correct, per `MODEL_RATES`) cost than the default rate, and an unrecognised one falls back to the default rate byte-for-byte.
