# DEVOS-299 — `JOB_ROLE`/`PRINCIPAL_JOB_ROLE` tables, seeded catalogue

**Priority:** P1
**Depends on:** Sprint 46 (real `PRINCIPAL` rows), Sprint 48 (agent principals — job roles can be held by either humans or agents, decision §9.5).
**Depended on by:** DEVOS-300 (per-project subset), DEVOS-301 (UI/routes).

## Scope

A real, seeded per-organisation job-role catalogue (`PO`/`BA`/`DEV`/`QA`), and a real record of which principals hold which job roles at organisation scope. UI/API language always says "job role," never bare "role" — the existing agent workflow-role dispatch key is untouched and unrenamed (decision §9.5).

## Implementation

Migration `0051_job_roles.ts` creates:

- `job_roles` (`id` text PK — the deterministic `${organisationId}:${key}` scheme; `organisation_id` uuid FK→`organisations.id`; `key`/`name` text; `created_at`), unique on `(organisation_id, key)`. Seeded for every organisation that exists at migration time via a per-organisation loop (organisation count is small — not agent/project scale, unlike migration `0050`'s set-based approach).
- `principal_job_roles` (`principal_id` text FK→`principals.id`; `job_role_id` text FK→`job_roles.id`; `created_at`), primary key `(principal_id, job_role_id)` — deliberately the same pair migration `0052`'s composite FK references.

`packages/domain/src/job-roles/job-role.ts` defines `JobRole`/`JobRoleRepository`, `PrincipalJobRole`/`PrincipalJobRoleRepository` (the latter gains an optional, additive `listForPrincipals` batch method for DEVOS-301's aggregate overview). `packages/database/src/repositories/job-roles.ts` implements `JobRoleRepository` plus the real, ongoing `ensureDefaultJobRolesForOrganisation(db, organisationId)` — wired into `createOrganisationRepository.create()`, the one real chokepoint every organisation-creation path shares, so an organisation created after this sprint also gets the same default four job roles. `packages/database/src/repositories/principal-job-roles.ts` implements `PrincipalJobRoleRepository`. `seed.ts` inserts the seeded organisation's own catalogue directly (bypassing the repository, per this file's own established convention), mirroring the identical class of gap Sprint 46/47/48 already found and fixed for principals/organisation ownership/agent profiles.

## Out of scope

The per-project active subset (DEVOS-300). Routes/UI (DEVOS-301). Letting an organisation define its own job-role set beyond the seeded four — no route exists to create/rename/retire a `JobRole`.

## Acceptance

`pnpm --filter @devos/domain build`; `pnpm --filter @devos/database typecheck build` clean. A fresh migration seeds exactly four job roles per existing organisation; `createOrganisation` (application layer) seeds the same four for a newly created organisation via the real chokepoint, confirmed by `packages/application/tests/job-roles.test.ts`'s own in-memory coverage of the use cases that read the catalogue.

## Actual results

Implemented as planned. `pnpm --filter @devos/domain build` and `pnpm --filter @devos/database typecheck build` both clean. Full monorepo validation (`pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`) **76/76 green**, matching Sprint 48's own baseline exactly (see `DEVOS-302.md` for the full validation record). Live verification against real Postgres (migration run, seed re-run, and a fresh-organisation-creation proof) is recorded in `DEVOS-302.md`.
