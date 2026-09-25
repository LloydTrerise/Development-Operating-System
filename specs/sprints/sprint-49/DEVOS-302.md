# DEVOS-302 — Validation, documentation, and gap disclosure

**Priority:** P1
**Depends on:** DEVOS-299, DEVOS-300, DEVOS-301.

## Scope

Full monorepo validation; this sprint's own required real end-to-end proof against real Postgres and a real running `apps/api`; documentation; disclosure of any real gaps found.

## Real bugs found and fixed (not merely disclosed)

1. **`audit_records.target_id` uuid-column mismatch.** `assignPrincipalJobRole`/`removePrincipalJobRole`/`assignProjectMemberJobRole`/`removeProjectMemberJobRole` originally wrote a composite `${principalId}:${jobRoleId}` string as `targetId` — invalid, since `audit_records.target_id` is a native Postgres `uuid` column and `principal_job_roles`/`project_member_job_roles` have no surrogate uuid id of their own (a genuine composite-key-only join table, unlike every other audited entity in this codebase). Found via a real `POST /organisations/:id/principals/:principalId/job-roles` call against a real running `apps/api`/Postgres returning a masked `DEVOS_INTERNAL_ERROR`; root-caused by writing a small throwaway script (`apps/api/debug-devos49.mjs`, deleted after use) calling the use case directly against real Postgres to surface the real stack trace, since the API's generic 500 handler does not log the underlying cause anywhere (a separate, pre-existing, undisclosed observability gap — real, but out of this task's own scope to fix). Fixed by using the real, always-present `organisationId` (org-scope actions) or `projectId` (project-scope actions) as `targetId` instead, mirroring `transferOrganisationOwnership`'s own identical "audit the scope entity when no dedicated row id exists" precedent (`packages/application/src/organisations/transfer-organisation-ownership.ts:43`). The specific principal/job-role pair remains fully captured in `metadata`, confirmed via a direct Postgres query after re-verification (see below).
2. **Missing `ON DELETE CASCADE` on `job_roles.organisation_id`.** Found while running this sprint's own required full `tests/e2e` suite: `cost-budget-pilot.test.ts` and `knowledge-platform-marketplace-pilot.test.ts` both hard-delete their own test organisations as cleanup, and `ensureDefaultJobRolesForOrganisation` (DEVOS-299) now gives every organisation — including theirs — a real `job_roles` row; without cascading, that delete fails with a foreign-key violation. The identical class of gap Sprint 48 found and fixed for `agent_profiles.agent_id`. Fixed in migration `0051_job_roles.ts` and applied live via `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ... ON DELETE CASCADE` against the already-migrated real database. `principal_job_roles.job_role_id`'s FK to `job_roles.id` and `project_member_job_roles.project_id`'s FK to `projects.id` were both proactively given the same cascade in the same pass (confirmed via `\d` afterward), before either could cause the identical failure for a future test exercising this table.

## Validation

Package-scoped, run repeatedly through implementation:

- `pnpm --filter @devos/domain build` — clean.
- `pnpm --filter @devos/database typecheck lint test build` — clean.
- `pnpm --filter @devos/application typecheck lint test build` — clean; `packages/application/tests/job-roles.test.ts` (8 new cases) all green.
- `pnpm --filter @devos/api typecheck lint test build` — clean; a new `describe('job role routes (DEVOS-299/300/301)', ...)` block in `apps/api/tests/app.test.ts` (1 case exercising the full grant → activate → deactivate → revoke lifecycle, plus the two `400` rejection paths) green.
- `pnpm --filter @devos/web typecheck lint test build` — clean; 6 new cases in `apps/web/tests/api-client.test.ts` green.
- `prettier --check` clean on every file this sprint touched (after one `prettier --write` pass to fix formatting the initial edits missed).

Full monorepo: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 green** (forced/uncached, run twice — once before and once after the two real-bug fixes above), matching Sprint 48's own baseline exactly.

## Real end-to-end proof (this task's own required scope)

Live-verified against real Postgres (`docker-postgres-1`, restarted mid-session after a genuine Docker Desktop engine stall unrelated to this sprint's own code — `docker-redis-1`/`docker-vault-1` restarted alongside it) and a real running `apps/api` dev server (port 3101, `DATABASE_URL` pointed at the real database):

1. **`ensureDefaultJobRolesForOrganisation` chokepoint proof**: `POST /organisations` created a brand-new real organisation; `GET /organisations/:id/job-roles` immediately returned all four seeded job roles (`PO`/`BA`/`DEV`/`QA`) with zero separate seeding step — confirming DEVOS-299's chokepoint fires for real on the application-layer creation path, not only at migration time.
2. **DEVOS-300's FK-enforced rule proof, twice over**: (a) `POST /projects/:id/members/:principalId/job-roles` for a job role the principal did not yet hold returned a real `400` (the application-layer pre-check); (b) a direct `INSERT` against `project_member_job_roles` via `psql`, bypassing the application layer entirely, was rejected by Postgres itself with a real foreign-key-violation error — confirming the rule is enforced at the database layer, not only in application code.
3. **Full lifecycle proof**: grant DEV to a real project member at organisation scope → list held job roles (returns it) → activate DEV on the project → project job-roles overview (correctly shows it both held and active) → deactivate on the project (overview shows held but inactive) → revoke at organisation scope (held-job-roles list returns empty).
4. **`ON DELETE CASCADE` proof**: activated QA on the project, then revoked QA at organisation scope through the real API — a direct Postgres query immediately after confirmed the `project_member_job_roles` row for that principal/job-role was gone, with zero application-layer code running to remove it (the cascade did the work).
5. **Audit trail proof**: a direct Postgres query after the full lifecycle above confirmed all five expected `audit_records` rows (`job_role.assigned` ×1, `job_role.removed` ×2, `project_member_job_role.assigned` ×1, `project_member_job_role.removed` ×1) exist with valid uuid `target_id` values and complete `metadata`. One real, disclosed, non-fix: the `ON DELETE CASCADE` removal in proof 4 above produces no audit record of its own, since no application-layer code runs for it — a database-level cascade is silent by nature in this codebase's existing audit model (the same is already true of every other cascading FK this epic has added, e.g. `agent_profiles`'s `ON DELETE CASCADE` from Sprint 48).
6. **Full real `tests/e2e` suite**: **27/27 files, 52/52 tests green**, run clean twice (once immediately after the cascade fix, once as a final confirmation) — zero regression, matching Sprint 48's own baseline exactly.

All real test data (one organisation, one project, four cloned workflow definitions/versions, six cloned agents/agent_versions/agent_profiles/principals, three human-actor principals/human-profiles, five audit records, job-role catalogue/grant/activation rows) was fully cleaned up afterward via direct Postgres deletes in correct FK order, confirmed zero remaining rows for every one of those tables/ids.

## Gap disclosure

- No route lets an organisation define its own job-role set beyond the seeded four `PO`/`BA`/`DEV`/`QA` — the domain model (`JobRoleRepository.create`) supports it, no API surface exposes it. Not this sprint's scope (backlog §6.4 names only the seeded four).
- No standalone organisation-wide job-role management page exists — both halves of DEVOS-301 were built onto `ProjectDetailPage.tsx`'s existing Members panel instead, a disclosed design choice (see `README.md`), not an oversight.
- The API's generic `500` handler (`apps/api/src/app.ts`'s `toErrorBody`) does not log the underlying cause of an unexpected error anywhere — a real, pre-existing observability gap this sprint's own debugging directly ran into (see bug 1 above), not introduced by this sprint and not fixed here, since it's a cross-cutting concern well outside a job-role-catalogue sprint's own scope.
- A database-level cascade delete (e.g. `ON DELETE CASCADE` removing a `project_member_job_roles` row when its `principal_job_roles` grant is revoked) produces no audit record of its own — consistent with every other cascading FK this epic has added, not a new gap this sprint introduced.

Per the user's own established governance, no further sprint begins automatically; awaiting explicit authorization before Sprint 50 (Work Item Assignment & Hierarchy).
