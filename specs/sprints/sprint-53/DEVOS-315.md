# DEVOS-315 — Second real provider adapter (Anthropic)

**Priority:** P1
**Depends on:** DEVOS-314 (the registry this adapter registers into).
**Depended on by:** DEVOS-316 (real per-task resolution proves it can route here), DEVOS-317 (its own pricing rows), DEVOS-318 (its own live-provider proof).

## Scope

A second real `AgentModelAdapter`, backed by a real provider's API, behind the same unchanged port `createGeminiModelAdapter` (DEVOS-027) implements — proving DEVOS-314's registry is real, not aspirational. Mirrors DEVOS-195's own "second real adapter behind the same port" precedent (a real GitLab `PullRequestProvider` alongside the real GitHub one, Sprint 27).

## Design choice disclosed: which provider

The backlog's own §8 left "which second provider" open (Anthropic/OpenAI/Azure OpenAI all named as plausible), flagged for confirmation at conversion time. Resolved: **Anthropic**, via the real Messages API (`POST /v1/messages`). Its request/response shape (a `messages` array in, a `content` block array out, `usage.input_tokens`/`usage.output_tokens`, a `stop_reason` field) maps onto this codebase's existing `AgentInvocationRequest`/`AgentInvocationResult` contract at least as directly as Gemini's own `generateContent` shape, and its pricing is public and stable (used directly in DEVOS-317).

## Implementation

- `packages/agents/src/providers/shared-prompt.ts` (new) — `buildAgentPrompt`/`parseJsonResultText`, extracted from `gemini.ts` byte-for-byte unchanged, so both providers build the exact same prompt text and parse a JSON result the same way; `gemini.ts` updated to import these instead of its own local copies (zero behavior change, confirmed by `gemini.test.ts` staying green unmodified in substance).
- `packages/agents/src/providers/anthropic.ts` (new) — `createAnthropicModelAdapter({ apiKey, baseUrl?, fetchImpl? })`. Uses the plain REST API via `fetch` (no `@anthropic-ai/sdk` dependency), matching Gemini's own stated rationale for keeping the adapter boundary free of provider SDKs. Sends `x-api-key`/`anthropic-version: 2023-06-01` headers and a single-user-message body; asks for a JSON object in the prompt text itself, since the Messages API has no `responseMimeType` equivalent. Maps `stop_reason !== 'end_turn'` to `FAILED` (mirroring Gemini's `finishReason !== 'STOP'` check) and `usage.input_tokens`/`usage.output_tokens` to the existing `AgentInvocationUsage` shape.
- Registered in `packages/agents/src/providers/registry.ts` (DEVOS-314) and exported from `packages/agents/src/index.ts`.

## Out of scope

Any change to `CredentialResolver` (already confirmed unnecessary, Sprint 52 DEVOS-312). Any UI. Streaming, tool use, thinking/extended-reasoning parameters, or any other Anthropic API feature beyond a single non-streaming text turn — this adapter's job is parity with what the existing Gemini adapter already does, not new capability.

## Acceptance

`pnpm --filter @devos/agents build`/`typecheck`/`lint`/`test` clean. A real unit test (`anthropic.test.ts`, mirroring `gemini.test.ts`'s own structure with a mocked `fetchImpl`) proves: correct API key/model/URL sent; JSON result parsing; uncertainty-array separation; non-JSON-text fallback; non-ok HTTP handling; missing-text-block handling; non-`end_turn` handling; usage mapping; network-rejection handling.

## Actual results

Implemented as planned. `pnpm --filter @devos/agents build`/`typecheck`/`lint` all clean. `anthropic.test.ts` (9 new tests) all green, mirroring `gemini.test.ts`'s own 9-test coverage shape exactly. Live-verified for real (not just mocked) in `DEVOS-318.md`, via a real local HTTP server (no real `ANTHROPIC_API_KEY` exists in this environment — disclosed, mirroring Sprint 27's own identical finding for GitHub/GitLab). No real bugs found during this task.
