# DEVOS-292 — Wire the view into project-list/authorization middleware

**Priority:** P1
**Depends on:** DEVOS-291.
**Depended on by:** DEVOS-293/294.

## Scope

Confirmed identical results to today's direct `memberships` query for every existing project member; organisation admins/owner now additionally see every project in their organisation, matching the new rule.

## Implementation

`packages/application/src/projects/list-projects-for-principal.ts`'s `listProjectsForPrincipal` gains an optional `deps.listEffectiveProjectIdsForPrincipal` (added to `ProjectUseCaseDeps`, `packages/application/src/projects/deps.ts`) — when present, it replaces the function's own pre-existing N+1 `Promise.all` fan-out (one `listForOrganisation` query per org-level membership, one `getById` per project-level membership) with a single real query against the view, then hydrates each returned id via `deps.projects.getById`. When absent, the pre-existing heuristic runs unchanged — the same "additive dependency, real implementation only where wired" convention this codebase already established for `listRunsForDefinition`/`outboxEvents?`, so every existing `ProjectUseCaseDeps` test fake across `packages/application/tests/` (which never passes this new field) is completely unaffected.

`apps/api/src/app.ts` wires the real resolver by default: `listEffectiveProjectIdsForPrincipal: createEffectiveProjectIdsForPrincipalLister(database.db)`.

`resolveMembership()` (the single-project authorization path, `packages/application/src/projects/membership-access.ts`) needed **no changes at all** — its existing "any org-level row for the same organisation" fallback already treats `ORGANISATION_ADMIN` identically to how it treated `OWNER` before this sprint, since it doesn't branch on the role's literal value, only on `projectId === null`. DEVOS-289's catalogue equivalence (`ORGANISATION_ADMIN` granted the same nine permissions as `OWNER`) is what keeps that path's `canX()` checks correct. The view's own real value-add is specifically the project-*listing* surface, which is what this task wires.

## Out of scope

Any change to `resolveMembership()` itself, per the reasoning above.

## Acceptance

Confirmed identical results to today's direct `memberships` query for every existing project member; a real organisation admin with zero explicit project-level membership rows sees every project in their organisation via the real HTTP route.

## Actual results

Implemented as planned. Live-verified end-to-end against a real running `apps/api`: a real organisation was created (alice, owner); bob was added as a second `ORGANISATION_ADMIN`; carol was added as a *third* co-admin with **zero project-level membership rows anywhere**; bob created a real project under the organisation; `GET /projects` as carol returned that project — confirmed by id, not just a non-empty list — proving the view-backed resolver genuinely grants organisation-wide reach to an admin who never touched the project directly. All test data cleaned up afterward (organisation, project, its cloned workflow/agent template rows, memberships, principals), confirmed zero remaining rows.
