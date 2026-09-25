# DEVOS-313 — Validation, documentation, and gap disclosure

**Priority:** P1
**Depends on:** DEVOS-311, DEVOS-312.

## Scope

Full monorepo validation; live verification against real Postgres proving DEVOS-311's schema/constraints and DEVOS-312's credential-resolution claim; explicit written confirmation that no existing route's, use case's, or agent task's behavior changed; disclosure of any real gaps found.

## Real bugs found

None. Unlike Sprints 48/49/50, this sprint's own migration, domain types, and repository passed live verification clean on the first pass — the smallest sprint in this codebase's history by surface area (one new table, zero application/route/UI layer), with correspondingly little room for the class of bug those larger sprints found.

## Validation

Package-scoped, run in dependency order:

- `pnpm --filter @devos/contracts build` — clean.
- `pnpm --filter @devos/domain build` — clean.
- `pnpm --filter @devos/database typecheck lint test build` — clean (`packages/database/tests/client.test.ts`, the only pre-existing test in this package, unaffected — this sprint added no new automated test to this package, since no application layer yet calls the new repository; correctness is proven by live verification below instead, per this sprint's own README grounding note that no repository in this codebase is unit-tested directly against real Postgres).

Full monorepo: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests' --force` **76/76 green** (forced/uncached), matching Sprint 51's own baseline exactly (application tests still 389/389 — this sprint added no application-layer test, by design).

## Real end-to-end proof (this task's own required scope)

Live-verified against real Postgres (`docker-postgres-1`, restarted via `docker compose up -d postgres redis vault` after a genuine Docker Desktop engine stall found at the start of this sprint's own verification — unrelated to this sprint's code, matching Sprint 47's/49's own precedent for this exact class of environment hiccup) and a disposable, self-contained script (`apps/worker/debug-devos311.mjs`, deleted immediately after use, per `DEVOS-302.md`'s own established convention for this class of throwaway verification):

1. **Schema proof**: `\d organisation_llm_providers` confirmed the exact documented column shape, the `organisation_llm_providers_org_priority_key` unique constraint on `(organisation_id, priority)`, the `organisation_llm_providers_organisation_id_idx` index, and the `ON DELETE CASCADE` FK to `organisations.id`.
2. **Repository CRUD proof**: against the real seeded "DevOS Development" organisation, `create()` inserted two real rows (`gemini` priority 1 `ACTIVE`, `anthropic` priority 2 `DISABLED`); `listForOrganisation()` returned both, correctly ordered by `priority` ascending; `getById()` returned the first row's real `credentialReference`.
3. **Database-enforced uniqueness proof**: a third `create()` call using an already-taken priority (`1`) for the same organisation was rejected by Postgres itself (`duplicate key value violates unique constraint "organisation_llm_providers_org_priority_key"`) — confirming the invariant is enforced at the database layer, not only in application code (there is no application-layer pre-check yet, since no use case exists in this sprint; the database constraint is the only enforcement, and it held).
4. **DEVOS-312's credential-resolution proof**: with a real environment variable (`LLM_PROVIDER_DEVOS_DEV_GEMINI`) set to a fake secret value, `createEnvCredentialResolver().resolve(row.credentialReference)` returned it correctly — the existing, completely unmodified resolver contract serving a second kind of reference with zero code change.
5. **Cleanup proof**: both test rows were deleted directly, and a final `listForOrganisation()` against the real organisation confirmed zero remaining rows; a direct `SELECT count(*) FROM organisation_llm_providers` after the script exited confirmed `0` — zero residue.
6. **Zero-regression proof**: full monorepo validation (`76/76 green`, forced/uncached) and the full real `tests/e2e` suite (**27/27 files, 52/52 tests green**) both re-ran clean after this sprint's changes, matching Sprint 51's own baseline exactly — confirming, as required by this sprint's own explicit scope, that adding this dormant table changed zero existing route's, use case's, or agent task's behavior. No stray `node.exe` processes were found before or after either run.

## Gap disclosure

- No route or use case anywhere in this codebase reads or writes `organisation_llm_providers` yet — entirely dormant, exactly as scoped. Sprint 53 is the first sprint that changes this.
- `OrganisationLlmProviderRepository` has no update/reorder/delete method — deferred to Sprint 54, the first sprint whose UI actually needs to mutate a row, mirroring `JobRoleRepository`'s own identical "foundation sprint" precedent (Sprint 49).
- The "distinct namespace" requirement between `Integration.credentialReference` and `OrganisationLlmProvider.credentialReference` is a documented human convention, not a code- or schema-enforced constraint — disclosed as a real design choice in `README.md`, not an oversight; no shared table or code path exists anywhere in this codebase that a namespace-collision constraint could even attach to.
- The pre-existing, cross-cutting API `500` handler observability gap (disclosed in Sprints 49/50/51, declined for fixing twice already) remains unrelated and untouched — this sprint added no route, so it could not have been hit here regardless.

Per the user's own established governance, no further sprint begins automatically; awaiting explicit authorization before Sprint 53 (Provider Gateway & Per-Task Resolution).
