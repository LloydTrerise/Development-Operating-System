# DEVOS-307 — Validation, documentation, and gap disclosure

**Priority:** P1
**Depends on:** DEVOS-303, DEVOS-304, DEVOS-305, DEVOS-306.

## Scope

Full monorepo validation; this sprint's own required real end-to-end proof against real Postgres and a real running `apps/api`/`apps/web`, including a real pre-existing work item confirmed still editable post-backfill; documentation; disclosure of any real gaps found.

## Real bugs found and fixed

None. Unlike Sprints 48/49, this sprint's own implementation and live verification surfaced zero new defects in either the migrations or the application/route/UI layers.

## Validation

Package-scoped, run repeatedly through implementation:

- `pnpm --filter @devos/domain build` — clean.
- `pnpm --filter @devos/database typecheck lint test build` — clean.
- `pnpm --filter @devos/application typecheck lint test build` — clean; `packages/application/tests/work-items.test.ts` (7 new cases, this sprint's first-ever dedicated application-layer unit tests for work items — previously only exercised indirectly through HTTP route tests) all green.
- `pnpm --filter @devos/api typecheck lint test build` — clean; a new `describe('assignment-gated edit/transition (DEVOS-305)', ...)` block (6 cases) and a new `describe('parent work item (DEVOS-303)', ...)` block (2 cases) in `apps/api/tests/app.test.ts` all green.
- `pnpm --filter @devos/web typecheck lint build` — clean.
- `prettier --check` clean on every file this sprint touched (after one `prettier --write` pass to fix formatting the initial edits missed, the same class of housekeeping gap prior sprints have also disclosed).

Full monorepo: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 green** (forced/uncached, run twice), matching Sprint 49's own baseline exactly.

## Real end-to-end proof (this task's own required scope)

Live-verified against real Postgres (`docker-postgres-1`, already running and healthy at session start — no Docker Desktop restart needed this time, unlike Sprint 49) and real running `apps/api`/`apps/web` dev servers:

1. **Migration application**: all three migrations (`0053`/`0054`/`0055`) applied cleanly against the real database in one `pnpm --filter @devos/database migrate` run.
2. **Backfill correctness**: a direct Postgres query confirmed exactly 3,601 `work_item_assignments` rows exist for this environment's real 3,601 pre-existing `work_items` rows — a 1:1 match, all `role = 'ASSIGNEE'`.
3. **Composite-FK enforcement, twice over**: (a) a direct `psql UPDATE` setting a real work item's `parent_id` to a real work item id from a _different_ project was rejected with a real foreign-key-violation error (`work_items_parent_id_project_id_fkey`); (b) a direct `psql INSERT` into `work_item_assignments` for a nonexistent `principal_id` was rejected with a real foreign-key-violation error (`work_item_assignments_principal_id_fkey`) — confirming both of this sprint's composite/simple FK rules are enforced at the database layer, not only in application code.
4. **Real pre-existing work item, confirmed still editable post-backfill (this task's own explicitly named acceptance criterion)**: a real work item created well before this sprint (`098405cf-4874-43c0-91ca-6a2c5adecbad`, `created_by = devos-incident-response-e2e-test`) was confirmed, via a real `PATCH /work-items/:id` call authenticated as that exact principal against a real running `apps/api`, to still succeed (`200`) after the backfill — proving decision §9.6's own requirement ("no currently-editable item becomes uneditable the moment this ships") holds for real, not just for freshly created test fixtures.
5. **Full assignment-gating lifecycle, via real HTTP against a real project with a real second member**: a plain `MEMBER` with no assignment was denied both edit (`403`) and transition (`403`); the creator (auto-assigned `ASSIGNEE` by `createWorkItem`) succeeded at both; that same plain member, attempting to self-grant `REVIEWER`, was denied (`403`, `canManageMembers` gate); the project `OWNER` granted them `REVIEWER` (`200`); the now-`REVIEWER` member transitioned status (`200`) but was denied a title edit (`403`); the `OWNER` then removed the grant (`200`), and the same member was denied transition again (`403`) — every step matching the designed rule exactly.
6. **Parent hierarchy, via real HTTP**: a same-project child was created and correctly round-tripped `parentId`; a cross-project `parentId` was rejected (`400`, the application-layer `ValidationError`, not a raw database error); a self-parent `PATCH` was rejected (`400`).
7. **Assignments UI, via a real Chromium browser** (throwaway Playwright script `apps/web/verify-devos306.mjs`, deleted after use, against real `apps/api`/`apps/web` dev servers and real Postgres): a real `/work-items/:id` page correctly rendered the initial `ASSIGNEE` chip, a grant through the picker produced a real `REVIEWER` chip, and that chip's own delete action removed it — zero console errors. Full detail and the one real (test-script-only, not product) timing issue found and resolved during this verification are in `DEVOS-306.md`.
8. **Full real `tests/e2e` suite**: **27/27 files, 52/52 tests green**, run clean twice (once mid-implementation, once as this task's own final confirmation) — zero regression, matching Sprint 49's own baseline exactly.

All real test data (three throwaway projects across the three verification passes above, their memberships, cloned workflow definitions/versions, cloned agents/agent_versions/agent_profiles, work items, and work item assignments) was fully cleaned up afterward via direct Postgres deletes in correct FK order, confirmed zero remaining rows for every one of those ids each time. Every live-verification `apps/api`/`apps/web` process spawned during this sprint was confirmed stopped (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` returning empty) before the next validation step began, per the environment's own disclosed stray-process blind spot.

## Post-completion scope extension: three of four originally-disclosed gaps fixed

Immediately after this task's own initial completion, the user was presented with the four gaps this section originally disclosed and asked which to fix — mirroring Sprint 41's own precedent for exactly this situation. Three were fixed for real, not merely re-disclosed; full grounding, implementation, and live-verification evidence for each is in `DEVOS-303.md`'s and `DEVOS-305.md`'s own new "Follow-up" sections and `DEVOS-306.md`'s own new "Follow-up: Hierarchy panel" section:

1. **Cycle detection across multiple `parentId` hops** — fixed. `assertParentBelongsToProject` now walks the candidate parent's own ancestor chain when updating an existing work item.
2. **No dedicated hierarchy-browsing UI for `parentId`** — fixed. A new Hierarchy panel on `WorkItemDetailPage.tsx`.
3. **Assignment grant/revoke gated by `canManageMembers`** — revisited, not replaced: after clarification, the specific change made was a narrow `ASSIGNEE`-hand-off exception (the current `ASSIGNEE` may transfer that role to another member without `canManageMembers`), not a broader rule change. `canManageMembers` remains the default gate for every other case, including `REVIEWER`/`APPROVER` grants.

Re-running full validation after all three fixes: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 green** (forced/uncached), matching this task's own original baseline exactly; the full real `tests/e2e` suite **27/27 files, 52/52 tests green**, run clean. New test coverage added across the three fixes: `packages/application/tests/work-items.test.ts` grew from 7 to 12 cases; `apps/api/tests/app.test.ts` grew by 4 route-level cases (2 for cycle/clear, 2 for hand-off). Live re-verification against real Postgres and a real running `apps/api`/`apps/web` (including a real Chromium browser session against the real seeded "DevOS POC" project's 992 real work items) is recorded in each fix's own "Follow-up" section.

## Gap disclosure

- **Cycle detection is walk-based, not a stored closure/materialized-path table** — for a pathologically deep real hierarchy this would mean O(depth) queries per parent change; acceptable at this epic's real data scale (this environment's real work items are not organized into deep chains), not optimized further as this sprint's own scope never named a performance target for hierarchy depth.
- **The API's generic `500` handler** (`apps/api/src/app.ts`'s `toErrorBody`) still does not log the underlying cause of an unexpected error anywhere — a real, pre-existing observability gap first disclosed in Sprint 49's own `DEVOS-302.md`, not introduced by this sprint, explicitly declined as a fix target when the user was asked (see `README.md`'s "Scope extension" section), still out of scope to fix here.

Per the user's own established governance, no further sprint begins automatically; awaiting explicit authorization before Sprint 51 (Reconciliation, Full-Epic Re-Audit & Close-Out).
