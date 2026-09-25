# DEVOS-316 — Per-task adapter resolution, replacing the boot-time constant

**Priority:** P1
**Depends on:** DEVOS-314 (registry), DEVOS-315 (a second real provider to actually route to).
**Depended on by:** Sprint 54's own real per-organisation fallback-chain resolution (extends the same seam this task builds).

## Scope

`AgentInvocationRequest` widened to carry `organisationId`; `run-agent-task.ts` resolves and supplies it; `apps/worker/src/main.ts`'s boot-time `modelAdapter` const (§2.1's own named gap) replaced with a real per-task-resolving adapter.

## Design choice disclosed: what "per-task" resolves to in this sprint

Sprint 54 (not this sprint) owns reading `organisation_llm_providers` and the ranked fallback chain (epic map, `specs/DEVOS-LLM-CREDENTIAL-MANAGEMENT-BACKLOG.md` §4). This sprint's own resolution — for every `organisationId` — still resolves to the same platform-wide default provider (selected via the new `LLM_DEFAULT_PROVIDER` config value, defaulting to `'gemini'`, today's exact behavior). `organisationId` is threaded through and available on every request but **not yet consulted** for provider selection. Disclosed exactly like Sprint 52's own "dormant, zero visible behavior change" framing, one layer up: the real per-task resolution mechanism this task builds has nothing yet to differentiate on, but is genuinely real — a concrete provider adapter is constructed fresh on every call, not memoized once at boot.

## Design choice disclosed: `AgentTaskHandlerDeps.modelAdapter`'s own type stays unchanged

Widening that field's own type (e.g. to a resolver function) was considered and rejected: 7 test files (`run-*-agent-task.test.ts`) construct a fake `{ invoke: async (...) => ... }` object satisfying the plain `AgentModelAdapter` interface directly. Keeping the field's type unchanged — and instead making `apps/worker/src/main.ts`'s own *construction* of the object assigned to it do real per-call resolution internally — means all 7 fakes stay valid unchanged, mirroring this codebase's own strong "optional and additive" precedent for exactly this situation.

## Implementation

- `packages/agents/src/model-adapter.ts` — `AgentInvocationRequest` gains a required `organisationId: OrganisationId` field.
- `packages/agents/src/providers/resolving-model-adapter.ts` (new) — `createResolvingModelAdapter({ defaultProvider, defaultCredential, baseUrlsByProvider?, fetchImpl? }): AgentModelAdapter`. Its `invoke()` constructs a concrete provider adapter fresh via `createModelAdapterForProvider` on every call, then delegates — real per-call construction, not a placeholder.
- `packages/application/src/tasks/run-agent-task.ts` — resolves `deps.projects.getById(run.projectId)` early (a new, additional lookup; `maybeAlertOnBudgetExceeded`'s own later, separate lookup is unchanged) and passes `organisationId: project.organisationId` into the `deps.modelAdapter.invoke({...})` call.
- `apps/worker/src/main.ts` — `resolveAgentModelAdapter()`'s non-fixture branch replaced: resolves `LLM_DEFAULT_PROVIDER` (validated via `isLlmProviderKey`, defaulting to `'gemini'`), builds a `credentialsByProvider` map from `config.agents.geminiApiKey`/`anthropicApiKey`, and returns `createResolvingModelAdapter(...)` (or `undefined`, unchanged, when no credential is configured for the resolved default provider).
- `packages/config` — `AgentsConfig` gains `anthropicApiKey?`/`defaultProvider?`; `environment.ts`/`validation.ts`/`config.ts` wired for `ANTHROPIC_API_KEY`/`LLM_DEFAULT_PROVIDER`, mirroring `GEMINI_API_KEY`'s exact existing shape.

## Real, disclosed test-fixture gap found and fixed (not a production bug)

Five existing test files (`run-discovery-agent-task.test.ts`, `run-requirements-agent-task.test.ts`, `run-technical-design-agent-task.test.ts`, `run-planning-agent-task.test.ts`, `agent-fixtures-regression.test.ts`) each supplied a `ProjectRepository` fake whose `getById` always returned `null` — previously harmless, since `deps.projects` was only actually read by the *optional*, gated `maybeAlertOnBudgetExceeded` path (none of these 5 files supply `auditRecords`, so it never ran). This task's own new, unconditional `deps.projects.getById(run.projectId)` lookup made that latent gap surface as a real `Project ... not found` failure in all 5 files. Fixed by giving each scenario a real, matching `Project` object (mirroring `run-agent-task.test.ts`'s own already-correct pattern) — not a change to any assertion, just a previously-unexercised fake made real.

## Out of scope

Reading `organisation_llm_providers` (Sprint 54). Access-role gating (Sprint 54). Any UI.

## Acceptance

`pnpm --filter @devos/agents`/`@devos/application`/`@devos/config`/`@devos/worker` typecheck/lint/test/build clean. A real unit test (`resolving-model-adapter.test.ts`) confirms: the configured default provider is genuinely invoked on every call (fetch called once per `.invoke()`, not memoized); routing to `'anthropic'` when configured; a per-provider `baseUrl` override is honored.

## Actual results

Implemented as planned. All 5 application-package test files fixed (see the disclosed gap above); full application suite re-ran clean at **389/389**, matching Sprint 51's own baseline exactly (no application-layer test was added or removed net — the 5 fixture fixes are corrections, not new coverage; `resolving-model-adapter.test.ts`'s own 3 new tests live in `@devos/agents`, not `@devos/application`). `pnpm --filter @devos/worker`/`@devos/config` typecheck/lint/test/build all clean. Full monorepo validation and the real end-to-end proof are recorded in `DEVOS-318.md`.
