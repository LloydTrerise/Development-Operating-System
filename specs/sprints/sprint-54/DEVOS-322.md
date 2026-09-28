# DEVOS-322 — Validation, documentation, and gap disclosure

**Priority:** P1
**Depends on:** DEVOS-319, DEVOS-320, DEVOS-321.

## Scope

Full monorepo validation; live-verified fallback ordering and access gating against real Postgres; explicit written confirmation of what changed and what didn't; disclosure of any real gaps found.

## Planned validation

Package-scoped, in dependency order: `@devos/contracts` (unchanged), `@devos/domain`, `@devos/database`, `@devos/agents`, `@devos/application`, `@devos/api`, `@devos/worker`, `@devos/web`. Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests' --force`. The full real `tests/e2e` suite, confirming zero regression against Sprint 53's own baseline.

## Planned real end-to-end proof

Against a real running `apps/api`/`apps/worker` and real Postgres: an organisation configured with two real provider rows (one deliberately given an unresolvable `credentialReference`, one real/working, at different priorities) proves the fallback chain genuinely skips the unconfigured entry and uses the working one; a non-admin principal's attempt to add/update/delete/reorder a provider is genuinely rejected over real HTTP; an admin's full add → reorder → disable → remove lifecycle succeeds over real HTTP and is confirmed via direct Postgres query at each step.

## Real gap found and fixed during this sprint (not a production bug)

`createResolvingModelAdapter`'s own new "failing" fallthrough was originally written as a bare `try`/`catch` around `adapter.invoke()`. Live-testing against the real Gemini/Anthropic adapters (`gemini.ts`/`anthropic.ts`) showed both already catch their own network/HTTP errors internally and return a `{status: 'FAILED', errorMessage}` result rather than throwing — so a `catch` block alone never actually triggered for a real failing candidate. Fixed by also checking `result.status === 'SUCCEEDED'` before returning, falling through to the next candidate on `FAILED` too. Found by the new unit tests in `resolving-model-adapter.test.ts` (`mockRejectedValueOnce` alone didn't reproduce a real failure path), not by manual inspection — confirming the real provider adapters' own error-handling contract rather than assuming it.

## Validation

Package-scoped, in dependency order, all clean:

- `@devos/agents` — build/typecheck/lint/test: **61/61 tests** (up from 54 — 7 new `resolving-model-adapter.test.ts` cases for the ranked fallback chain).
- `@devos/domain`/`@devos/database` — build/typecheck/lint clean. No new `@devos/database` test file added — this package has exactly one test file (`client.test.ts`) covering none of its individual repositories; correctness for `update`/`delete`/the reorder primitive is proven by `@devos/application`'s own use-case tests (in-memory fakes) and this task's own live Postgres verification below, matching this codebase's established convention (confirmed by inspection before writing any test here).
- `@devos/application` — build/typecheck/lint/test: **398/398 tests** (up from 389 — 9 new cases in `organisation-llm-providers.test.ts` covering all five use cases, admin gating, cross-organisation rejection, and audit-record coverage).
- `@devos/api` — build/typecheck/lint/test: **118/118 tests** (up from 117 — 1 new route-level test in `app.test.ts` covering create/list/update/reorder/delete, non-admin rejection at every write route, unregistered-provider/partial-reorder rejection).
- `@devos/web` — build/typecheck/lint/test: **71/71 tests**, including 5 new `api-client.test.ts` cases for the five new client wrappers.
- `@devos/worker` — build/typecheck clean (the new `organisationLlmProviders` repository construction and `createResolvingModelAdapter` wiring).

Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests' --force` **76/76 green** (forced/uncached), matching Sprint 53's own baseline exactly. The full real `tests/e2e` suite (`pnpm --filter @devos/e2e-tests test`) **27/27 files, 52/52 tests green**, zero regression.

`prettier --write` applied to every file this sprint touched or added (26 files, including the 4 spec documents); re-verified clean via `prettier --check`.

## Real end-to-end proof

**Part 1 — DEVOS-319's ranked fallback chain, against real Postgres and real local HTTP servers** (`packages/agents/debug-devos319.mjs`, deleted immediately after use, mirroring `DEVOS-311.md`/`DEVOS-318.md`'s own established disposable-script convention): a real, throwaway organisation and two real `organisation_llm_providers` rows were created directly against real Postgres (a top-priority `gemini` row with an unresolvable `credentialReference`, a second-priority `anthropic` row with a real, resolvable one); `createResolvingModelAdapter`, wired to the real repository and a real `CredentialResolver`, was invoked against two real local `node:http` servers standing in for Gemini/Anthropic (no live `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` exists in this environment, mirroring Sprint 53's own identical disclosed finding). Four real assertions, all passing: (1) the unconfigured top-priority candidate was genuinely skipped and the working second candidate was genuinely used, confirmed by which real HTTP endpoint was actually hit; (2) disabling the working candidate via a real `UPDATE` and re-invoking fell through all the way to the platform-wide default, confirmed the same way; (3) re-enabling and configuring the first candidate, then calling the real transactional `reorderOrganisationLlmProviders` to move it to top priority, was confirmed via a direct re-read of the row order and then by the adapter genuinely using it; (4) a third `create()` reusing an already-taken priority for the same organisation was rejected by Postgres itself (`organisation_llm_providers_org_priority_key`), confirming the invariant guarding the reorder primitive's own two-phase technique is still database-enforced. All test rows deleted afterward; a final `listForOrganisation()` confirmed zero remaining rows.

**Part 2 — DEVOS-320/321's routes and access gating, against a real running `apps/api` (port 3102) and real Postgres**: a real organisation was created via the real, unmodified `POST /organisations` route (the creator becoming its real `ORGANISATION_ADMIN`); a real project and a real non-admin `MEMBER` were added. Over real HTTP: the non-admin's create/update/delete attempts were all genuinely rejected (`404`, matching `resolveOrganisationAdminMembership`'s established "no project-level fallback" behavior — the identical shape the job-roles routes already exhibit, not a new gating bug); an unregistered `provider` value was genuinely rejected (`400`); the admin's create (auto-assigned priorities 1/2), list (any org member, correct priority order), update (status → `DISABLED`), reorder (a genuine priority swap, confirmed in the response), and delete all succeeded for real; a partial/mismatched `orderedIds` reorder attempt was genuinely rejected (`400`). A direct Postgres query confirmed the real, correctly-attributed audit trail for every write (`organisation_llm_provider.created` ×2/`updated`/`reordered`/`deleted` ×2, alongside the pre-existing `project.created`/`membership.added`). All real test data (1 organisation, 1 project, 4 cloned workflow definitions/versions, 6 cloned agents and their own `agent_profiles`/principals, 3 human-actor principals, 8 audit records, 2 provider rows) was fully cleaned up afterward via direct Postgres deletes in correct FK order, confirmed zero remaining rows for every one of those tables/ids; the real `apps/api` process was stopped and confirmed via `tasklist` that no stray `node` process remained.

## Gap disclosure

- `OrganisationLlmProviderRepository.update` deliberately does not accept `priority` — a provider's rank only ever changes through the dedicated `reorderOrganisationLlmProviders` transactional primitive (disclosed as a design choice in `specs/sprints/sprint-54/README.md`, not a limitation).
- The "AI Providers" panel's credential-reference field shows the reference name in plain text, matching `IntegrationsPage.tsx`'s own established precedent for the identical class of field — the backlog's own "masked" acceptance language was interpreted (and disclosed at conversion time, `README.md`) as "never displays a resolved secret" (already true), not a literal obfuscation of the non-secret reference name.
- The panel's write controls (add/toggle-status/reorder/remove) render unconditionally for every viewer, relying on the server-side `resolveOrganisationAdminMembership`/`canUpdateOrganisation` gate and an `actionError` surface on rejection — this is a disclosed correction from `DEVOS-321.md`'s own original plan (which proposed client-side hiding via `isCurrentUserOwner`); the actual, simpler behavior instead mirrors `MembersPanel`'s own real, already-shipped Add/Remove convention exactly (only "Transfer ownership" there is client-hidden, and only because it needs to know the single transferable owner, not because of the access gate itself).
- No dynamic/cost/quality/latency-based routing exists — the chain is exactly the manually-ranked, admin-ordered list the backlog's own §9.5 decision settled on, unchanged.
- `AgentExecution.estimatedCostUsd`/`Organisation.budgetUsd` still do not distinguish which provider was actually used when it was the organisation's own configured one vs. the platform default — informational only, unchanged, per the backlog's own §9.6 decision. Sprint 55 (DEVOS-323) is the sprint whose own pilot explicitly proves cost attribution reflects the provider actually used.
- The pre-existing, cross-cutting API `500` handler observability gap (disclosed and declined for fixing in Sprints 49–53) remains unrelated and untouched.

Per the user's own established governance, no further sprint begins automatically; awaiting explicit authorization before Sprint 55 (Full-Epic Pilot & Close-Out) and before this sprint itself may be marked complete in `DEVOS-ROADMAP.md`/`DEVOS-BUILD-STATE.md`.
