# DEVOS-291 — `effective_project_access` view

**Priority:** P1
**Depends on:** DEVOS-290.
**Depended on by:** DEVOS-292.

## Scope

The source document's view, with its "division admin"/"division owner" `UNION` branches applied at organisation scope instead: an `ORGANISATION_ADMIN` or the organisation's `owner_principal_id` resolves computed access to every project in that organisation without an explicit `PROJECT_MEMBER` row, per the source document's Option B rule.

## Implementation

Migration `0049_effective_project_access_view.ts` creates a real Postgres `VIEW` (`CREATE VIEW`, via a raw `sql` template — Kysely's schema builder has no first-class multi-branch `UNION` view helper, and this codebase already has precedent for raw SQL in a migration, e.g. `0042`'s GIN index expressions) with one `(principal_id, project_id)` row per real reachable pair, from three `UNION`-ed sources:

1. Direct project-level membership (`memberships.project_id` matches).
2. An org-level `ORGANISATION_ADMIN` row (reaches every project in that organisation).
3. The organisation's own `owner_principal_id` (reaches every project even without an explicit membership row — defensive; real data never needs this branch, see DEVOS-290's own disclosed reasoning for why the owner always has a row too).

`packages/database/src/database.ts` registers it as a normal Kysely-typed view (`effective_project_access: EffectiveProjectAccessView`). `packages/domain/src/access-control/effective-project-access.ts` defines `ListEffectiveProjectIdsForPrincipal` as a standalone function type (mirroring `ListWorkflowRunsForDefinition`'s own established Sprint 41 precedent for a cross-table composed query no single repository interface should own, rather than widening `MembershipRepository`). `packages/database/src/repositories/effective-project-access.ts` implements it as a single `SELECT project_id FROM effective_project_access WHERE principal_id = ?` query.

## Out of scope

Wiring it into any use case (DEVOS-292's own job — this task only builds and proves the view itself).

## Acceptance

Real Postgres confirms the view's row count and correctness against real accumulated data.

## Actual results

Implemented as planned. Live-verified against the real dev database's real accumulated data (5,306 real projects across the one real organisation): `count(DISTINCT project_id) FROM effective_project_access WHERE principal_id = 'seed-user'` returned exactly 5306, matching `count(*) FROM projects` exactly — `seed-user` (the organisation's `ORGANISATION_ADMIN`/owner) correctly reaches every project via the view. Separately, in the disposable `devos_fresh_verify` database used for DEVOS-290's fallback-branch verification, the view correctly de-duplicated a principal who qualifies via *both* a direct project membership and the org-admin `UNION` branch into a single row (`SELECT * FROM effective_project_access` returned exactly one `(legacy-user, <project-id>)` row, not two).
