# DEVOS-347 — Gap 3 correction: no code change needed

**Priority:** P2 | **Estimate:** 0.5d (spent on investigation + revert, not the originally planned implementation)
**Depends on:** none.
**Depended on by:** DEVOS-349.

## Original scope (superseded — see "What actually happened" below)

Originally scoped, per Decision 3 (`specs/DEVOS-E31-GAP-CLOSURE-SPRINT.md` §6, "Add narrow exemption"), to close gap 3 (`specs/sprints/sprint-60/DEVOS-344.md`'s closing disclosure, itself citing `specs/sprints/sprint-59/DEVOS-340.md`): "a user who later disables their organisation's only LLM provider would see their organisation's own further mutations blocked again." The plan was a narrow `resolveOrganisationId` exemption on `PATCH .../llm-providers/:providerId`, letting a reactivation of an organisation's own last/only disabled provider through the initialisation gate even when the organisation is not currently `INITIALISED`.

## What actually happened

The exemption was implemented (a new `organisationIdForLlmProviderReactivation` resolver in `apps/api/src/http/organisation-scope.ts`, wired onto the `PATCH` route) and a route-level test was written to prove it. **The test failed** — not because the exemption logic was wrong, but because its own premise was: `getOrganisationInitialisationStatus` (`packages/application/src/organisations/get-organisation-initialisation-status.ts:61`) computes `hasLlmProvider` as `llmProviders.length > 0` — **row existence, never `status`**. Disabling a provider (`PATCH .../llm-providers/:providerId` with `{status: 'DISABLED'}`) does not delete the row; it only changes its `status` column. `listForOrganisation` still returns it, so `hasLlmProvider` stays `true`, and the organisation never actually loses `INITIALISED` status from disabling its only provider.

The "disable your only provider, then get stuck" scenario `DEVOS-340.md`/`DEVOS-344.md` disclosed — and that this sprint's own scoping document (`DEVOS-E31-GAP-CLOSURE-SPRINT.md` §2.3) repeated and traced further without independently verifying this specific computation — **does not reproduce against the real code**. It was a factually inaccurate disclosure carried forward across three sprints (59 → 60 → 61's own scoping) without anyone tracing `hasLlmProvider`'s actual implementation until this task's own real-server test caught it.

Per the user's explicit resolution (asked directly once this was discovered, 2026-09-29): **drop the exemption, correct the record, no code change.** The resolver and its route wiring were fully reverted (`organisation-scope.ts`, `apps/api/src/routes/organisation-llm-providers.ts` both restored to their pre-task state). The route-level test was kept, rewritten to assert the *actual*, correct behavior — disabling an organisation's only provider does not lose `INITIALISED` status — as a permanent regression guard against this specific misunderstanding recurring.

## Real bugs found

None in the running system. The "bug" was in three sprints' own prior disclosure text (`DEVOS-340.md`, `DEVOS-344.md`, and this sprint's own `DEVOS-E31-GAP-CLOSURE-SPRINT.md` §2.3), not in the code — `hasLlmProvider`'s row-existence-only semantics is Sprint 58's own original, correctly-implemented design (`specs/sprints/sprint-58/README.md`'s own disclosed persistence-shape decision), just never previously cross-checked against this specific edge case's own disclosed narrative.

## Files touched (net: reverted to original state, plus one corrected test)

- `apps/api/src/http/organisation-scope.ts` — added then fully reverted.
- `apps/api/src/routes/organisation-llm-providers.ts` — added then fully reverted.
- `apps/api/tests/app.test.ts` — one test added, asserting the corrected understanding (disabling an organisation's only provider does not un-initialise it), not the originally-planned exemption behavior.

## Acceptance

A real, passing test proves the corrected understanding against a live server: disabling an organisation's only LLM provider leaves the organisation `INITIALISED`. `pnpm --filter @devos/api typecheck lint test build` clean, byte-identical to before this task's `organisation-scope.ts`/`organisation-llm-providers.ts` changes were reverted.
