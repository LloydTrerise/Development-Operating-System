# DEVOS-314 — Provider registry / `AgentModelAdapter` factory

**Priority:** P1
**Depends on:** Sprint 52 (E30's own first sprint — no direct code dependency, continues the same epic).
**Depended on by:** DEVOS-315 (registers the second provider), DEVOS-316 (the resolving adapter built on top of this registry).

## Scope

A real, provider-keyed `AgentModelAdapter` factory in `packages/agents` — replaces `apps/worker/src/main.ts`'s own single hardcoded `createGeminiModelAdapter({ apiKey })` call with a registry where Gemini is one registered provider among others, not a special case.

## Implementation

`packages/agents/src/providers/registry.ts`:

- `LLM_PROVIDER_KEYS = ['gemini', 'anthropic'] as const` and its derived `LlmProviderKey` union type.
- `isLlmProviderKey(value: string): value is LlmProviderKey` — a real type guard, used by `apps/worker/src/main.ts` to validate the new `LLM_DEFAULT_PROVIDER` config value at startup.
- `ModelAdapterCredentialOptions` (`apiKey`/`baseUrl?`/`fetchImpl?`) — both registered adapters (`createGeminiModelAdapter`, `createAnthropicModelAdapter`) already share this exact shape, confirmed by direct inspection, so one factory signature covers both with no per-provider option-shape branching.
- `createModelAdapterForProvider(provider, options): AgentModelAdapter` — the real factory, a plain object lookup into `MODEL_ADAPTER_FACTORIES`.

Exported from `packages/agents/src/index.ts` alongside the two concrete providers.

## Out of scope

Any per-task/per-organisation selection logic (DEVOS-316/Sprint 54). Any UI. Any third provider.

## Acceptance

`pnpm --filter @devos/agents build`/`typecheck`/`lint`/`test` clean. A real unit test (`registry.test.ts`) confirms `isLlmProviderKey` correctly recognizes/rejects provider strings, and `createModelAdapterForProvider` builds a genuinely correct, distinctly-shaped adapter for each of `'gemini'`/`'anthropic'` (confirmed via each adapter's own real request URL when invoked with a mocked `fetchImpl`).

## Actual results

Implemented as planned. `pnpm --filter @devos/agents build`/`typecheck`/`lint` all clean. `registry.test.ts` (4 new tests) confirms both registered providers build correctly-routed adapters. Full monorepo validation (`DEVOS-318.md`) confirms zero regression. No real bugs found during this task.
