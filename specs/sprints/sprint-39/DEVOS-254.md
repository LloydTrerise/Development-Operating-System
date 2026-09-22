# DEVOS-254 — Organisation-level membership backend

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** none within this sprint.
**Depended on by:** DEVOS-255 (UI).

## Scope

Mirrors `packages/application/src/projects/{add-member,remove-member,change-member-role,list-members}.ts` at organisation scope (`projectId: null`), reusing `resolveOrganisationMembership()` for the requester check and the existing `canManageMembers`-style authorization pattern. New routes: `GET/POST /organisations/:id/members`, `PATCH/DELETE /organisations/:id/members/:userId`.

## Implementation

- `packages/domain/src/projects/membership.ts`: `MembershipRepository` gains `listForOrganisation: (organisationId: OrganisationId) => Promise<Membership[]>`.
- `packages/database/src/repositories/memberships.ts`: implements `listForOrganisation` as `WHERE organisation_id = $1 AND project_id IS NULL` — scoped to org-level rows only (the rows this feature manages), documented in a comment distinguishing it from a full cross-project org listing.
- `packages/application/src/organisations/deps.ts`: `OrganisationUseCaseDeps` gains `auditRecords: AuditRecordRepository` (additive, mirrors `IntegrationUseCaseDeps`).
- `packages/application/src/organisations/membership-access.ts`: new `assertNotLastOrganisationOwner(deps, organisationId, excludingMembershipId)`, filtering `listForOrganisation`'s result to `role === 'OWNER'` rows excluding the target — mirrors `projects/membership-access.ts`'s `assertNotLastOwner` exactly, at org scope.
- New `packages/application/src/organisations/add-member.ts`, `remove-member.ts`, `change-member-role.ts`, `list-members.ts` — each a direct mirror of its project-scoped counterpart: `getById(organisationId)` existence check, `resolveOrganisationMembership` for the requester, `canManageMembers(requester.role)` gate, the same audit-record shape (`membership.added`/`membership.removed`/`membership.role_changed`) written with `projectId` omitted (already-optional field) and `organisationId` set to the target organisation.
- `packages/application/src/index.ts`: barrel-exports the four new files.
- `apps/api/src/routes/organisations.ts`: extends `createOrganisationRoutes` (not a new file — mirrors `projects.ts` bundling CRUD + members in one function) with the four new routes, reusing `parseAddMemberBody`/`parseRoleBody`/`toMembershipDto` imported from `../dto/project.js` (the `Membership` shape and body parsing are identical at both scopes — no duplication).
- `apps/api/src/app.ts`: `organisationDeps` construction gains `auditRecords: auditRecordRepository` (already built earlier in the file, reused by `projectDeps`/`integrationDeps`/`policyDeps`).

## Out of scope

Any change to the project-scoped membership routes/use-cases. Any new authorization role beyond the existing `OWNER`/`MEMBER` set. A user directory/search capability (still doesn't exist — add-by-principal-id, same as DEVOS-226).

## Acceptance

`pnpm --filter @devos/domain --filter @devos/database --filter @devos/application --filter @devos/api typecheck lint test build` clean. New unit tests for all four use-cases (mirroring `packages/application/tests/projects.test.ts`'s own membership-test shapes) plus `packages/database` repository tests for `listForOrganisation`. Live-verified against real Postgres and a real running `apps/api`: an org-level member added, listed, role-changed, and removed for real; the organisation's last org-level OWNER cannot be removed or demoted, confirmed via a real rejected request.

## Actual results

Implemented as scoped, with two real, disclosed refinements found during implementation, neither changing the story's own acceptance:

- `MembershipRepository.listForOrganisation` and `ToolCapabilityRepository.updateStatus` (DEVOS-256) were both made **optional**, not required, after the first typecheck pass surfaced that ~20 other `MembershipRepository` fakes across this codebase's test suite would otherwise all need a matching stub — a broad, unrelated-to-this-task ripple `AGENTS.md` §8 explicitly cautions against. Mirrors this codebase's own established "additive optional repository method, no-op-when-absent" convention (`AgentExecutionRepository.sumEstimatedCostUsdForProject`, etc.). Only the two test fakes that actually exercise organisation membership (`packages/application/tests/organisations.test.ts`, `apps/api/tests/app.test.ts`) implement it for real.
- `resolveOrganisationMembership`/`assertNotLastOrganisationOwner` were narrowed to a new `OrganisationMembershipAccessDeps { memberships }` interface instead of taking the full `OrganisationUseCaseDeps` — the same `MembershipAccessDeps` narrowing `projects/membership-access.ts` already established. Necessary because `getOrganisationCostReport`/`getOrganisationEngineeringReport` (whose own deps interfaces have no `auditRecords`) both call `resolveOrganisationMembership`, and would otherwise have broken the moment `OrganisationUseCaseDeps` gained that field for this story's own audit writes.

`packages/database` has no per-repository unit-test convention anywhere in this codebase (confirmed: only one file, `client.test.ts`, exists in `packages/database/tests/`) — every repository method is instead proven exclusively through real Postgres, via `packages/application`'s own fakes-based unit tests plus live verification, matching every other repository method's own precedent. No standalone `listForOrganisation` repository test was added for this reason; live Postgres verification below is its proof instead.

**Live-verified against real Postgres and a real running `apps/api`**, against the real seeded "DevOS Development" organisation: a synthetic org-level member (`sprint39-org-member-test`) was added (`projectId: null` confirmed in the real response), listed, promoted to `OWNER`. Removing or demoting it was then correctly rejected — a real finding, not fabricated: since the seeded organisation had **zero** pre-existing org-level (`projectId: null`) membership rows (only project-level ones), the synthetic member became the org's only real org-level `OWNER`, so the last-owner guard correctly fired on both removal and demotion. To unblock cleanup, a real org-level `OWNER` row for `seed-user` was added first (`seed-user` already had equivalent effective authority via `resolveOrganisationMembership`'s project-level-OWNER fallback, so this is a harmless, no-op-behaviorally addition, not new privilege) — the synthetic member was then removed cleanly, confirmed via a follow-up list call. **This `seed-user` org-level `OWNER` row is left in place deliberately**, not cleaned up: removing it would immediately retrigger the same last-owner guard for no benefit, since it grants no authority `seed-user` didn't already have. Disclosed here rather than silently left as an unexplained stray row.

Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 green**; the full real `tests/e2e` suite **27/27 files, 52/52 tests green**, zero regression from Sprint 38's baseline (no new e2e test file was added — this story's own live verification above and DEVOS-255's UI-level Playwright check already prove the feature end-to-end without needing a third, permanent e2e file).
