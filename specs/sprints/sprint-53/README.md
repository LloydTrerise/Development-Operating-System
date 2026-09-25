# Sprint 53 — Provider Gateway & Per-Task Resolution

**Source:** `specs/DEVOS-LLM-CREDENTIAL-MANAGEMENT-BACKLOG.md` §5.2 (candidate epic E30, Organisation LLM Provider & Credential Gateway).
**Conversion date:** 2026-09-25
**Status:** Converted and executed per explicit user authorization ("mark complete cimmit and push then Proceed with sprint. Run through sprint fully without waiting for authorisation after each task. Stop once sprint is done", 2026-09-25), in direct response to a position report confirming Sprint 52 complete and Sprint 53 as the recorded next item.

## Goal

Replace the single hardcoded Gemini `AgentModelAdapter`, memoized once at `apps/worker` boot (`specs/DEVOS-LLM-CREDENTIAL-MANAGEMENT-BACKLOG.md` §2.1), with a real, provider-keyed registry; prove it with a second real provider behind the same port; and replace the boot-time constant with real per-task adapter resolution. Sprint 54 (Ranked Fallback & Access Control UI) is what makes that per-task resolution actually vary by organisation, reading Sprint 52's own dormant `organisation_llm_providers` table — this sprint builds the real mechanism that Sprint 54 wires real per-organisation data into.

## Grounding (confirmed by direct code inspection at conversion time)

- `apps/worker/src/main.ts:201-246`'s `resolveAgentModelAdapter()` constructs exactly one `AgentModelAdapter` at process boot (`createGeminiModelAdapter({ apiKey })` or, under `AGENT_MODEL_ADAPTER=fixture`, `createFixtureModelAdapter(...)`) and captures it into a plain top-level `const modelAdapter`, reused for the process's lifetime — the real gap this sprint closes.
- `packages/application/src/tasks/run-agent-task.ts` is the sole production caller of `AgentModelAdapter.invoke()` (confirmed by grep across the monorepo); `deps.modelAdapter: AgentModelAdapter` (`packages/application/src/tasks/deps.ts`) is consumed by exactly one line (`deps.modelAdapter.invoke({...})`, line 393). `deps.projects: ProjectRepository` is already a required field on the same `AgentTaskHandlerDeps` interface — `run-agent-task.ts` already independently resolves `project.organisationId` via a second, separate `deps.projects.getById()` call inside `maybeAlertOnBudgetExceeded` (the exact value DEVOS-316 needs), so no new dependency is required to thread `organisationId` through — only an earlier lookup of the same, already-available repository.
- Widening `AgentTaskHandlerDeps.modelAdapter`'s own *type* was considered and rejected: 7 test files (`run-*-agent-task.test.ts`) construct a fake `{ invoke: async (...) => ... }` object satisfying the plain `AgentModelAdapter` interface directly. Keeping that field's type completely unchanged — and instead making `apps/worker/src/main.ts`'s own *construction* of the single object assigned to it do real per-call resolution internally — means all 7 fakes stay valid unchanged, mirroring this codebase's own strong, repeated "optional and additive" precedent for exactly this situation (e.g. DEVOS-098's `auditRecords?`, DEVOS-155's `organisations?`).
- `DEVOS-195`'s own real second-adapter precedent (`createGitLabPullRequestProvider`, Sprint 27, behind the unchanged `PullRequestProvider` port `createGitHubPullRequestProvider` already implements) is the closest structural precedent for DEVOS-315's own second `AgentModelAdapter`.
- No real `ANTHROPIC_API_KEY` (or any second LLM provider credential) is configured anywhere in this environment (confirmed: `.env` has `GEMINI_API_KEY` only) — mirroring Sprint 27's own disclosed "no live GitHub/GitLab credential exists in this environment" finding for DEVOS-196's pilot, this sprint's own live end-to-end proof for the second provider substitutes a real local HTTP server standing in for the real Anthropic Messages API, per that same established precedent.

## Design choice disclosed: which second provider (backlog §8's own named open decision)

The backlog left "which second provider to build first" open (Anthropic, OpenAI, Azure OpenAI all named as plausible), flagged for confirmation at Sprint 53 conversion time. Resolved here: **Anthropic**, via the real Messages API (`POST /v1/messages`). Reasoning, disclosed: Anthropic's request/response shape (a single `messages` array, a `content` block array in the response, `usage.input_tokens`/`usage.output_tokens`, a `stop_reason` field) maps onto this codebase's existing `AgentInvocationRequest`/`AgentInvocationResult` contract at least as directly as Gemini's own `generateContent` shape does, and its pricing is publicly documented and stable enough to give DEVOS-317 a real second rate table entry.

## Design choice disclosed: what "per-task resolution" resolves to in this sprint

Per the epic map (`specs/DEVOS-LLM-CREDENTIAL-MANAGEMENT-BACKLOG.md` §4), Sprint 54 — not this sprint — owns reading `organisation_llm_providers` and the ranked fallback chain. This sprint's own real, disclosed scope is narrower: `AgentInvocationRequest` is widened to carry `organisationId` (so it is available to any future per-call resolution logic), and `apps/worker/src/main.ts`'s boot-time singleton is replaced with a real `AgentModelAdapter` (`createResolvingModelAdapter`, `packages/agents`) whose `invoke()` constructs a concrete provider adapter fresh on every call via the new registry, instead of once at boot. For this sprint, that per-call resolution still always resolves to the same platform-wide default provider (selected via a new `LLM_DEFAULT_PROVIDER` config value, defaulting to `gemini` — today's exact behavior, unchanged) — `organisationId` is threaded through and available on every request but **not yet consulted** for provider selection; that is Sprint 54's own explicitly scoped job. Disclosed exactly like Sprint 52's own "dormant, zero visible behavior change" framing, one layer up: the real per-task resolution mechanism this sprint builds has nothing yet to differentiate on, but is genuinely real (a fresh adapter is constructed per call, not memoized) and genuinely per-call, not a placeholder.

## In scope

- **DEVOS-314** — A real provider registry / `AgentModelAdapter` factory in `packages/agents`.
- **DEVOS-315** — A second real provider adapter (Anthropic Messages API), behind the same unchanged `AgentModelAdapter` port.
- **DEVOS-316** — `AgentInvocationRequest` widened to carry `organisationId`; `run-agent-task.ts` resolves and supplies it; `apps/worker/src/main.ts`'s boot-time `modelAdapter` const replaced with a real per-task-resolving adapter.
- **DEVOS-317** — `packages/agents/src/pricing.ts` widened to a real per-provider/per-model rate table, covering the new Anthropic model(s) alongside the existing Gemini ones.
- **DEVOS-318** — Validation, documentation, gap disclosure, and a real end-to-end proof that each registered provider is genuinely invoked when selected.

## Out of scope

Everything Sprint 54 (fallback-chain resolution reading `organisation_llm_providers`, access-role gating, "AI Providers" settings UI) and Sprint 55 (full-epic pilot, closing disclosure) own. No change to `AgentTaskHandlerDeps`'s own field shapes. No UI. No real per-organisation differentiation in provider selection yet.

## Task index

| ID        | Story                                                              | File           |
| --------- | ------------------------------------------------------------------- | -------------- |
| DEVOS-314 | Provider registry / `AgentModelAdapter` factory                     | `DEVOS-314.md` |
| DEVOS-315 | Second real provider adapter (Anthropic)                            | `DEVOS-315.md` |
| DEVOS-316 | Per-task adapter resolution, replacing the boot-time constant       | `DEVOS-316.md` |
| DEVOS-317 | Per-provider pricing                                                 | `DEVOS-317.md` |
| DEVOS-318 | Validation, documentation, and gap disclosure                       | `DEVOS-318.md` |
