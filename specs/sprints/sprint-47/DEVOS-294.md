# DEVOS-294 — Validation, documentation, and gap disclosure

**Priority:** P1
**Depends on:** DEVOS-288–293.

## Scope

Full monorepo validation green; live-verified organisation-admin/owner project access against real Postgres.

## Validation performed

- `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests' --force` (fully forced, uncached): **76/76 tasks successful**, matching Sprint 46's own baseline exactly. Ran twice at this final state (once after the domain/database/application/api layer was complete, once again after the `apps/web` fixes) — both green.
- `pnpm --filter @devos/e2e-tests test` (real Postgres, no stray `apps/api`/`apps/worker` processes, checked via `Get-CimInstance Win32_Process` before each run per this environment's own established convention): **27/27 files, 52/52 tests green**. One run showed 4 failures in `hardening.test.ts`'s stale-task-reclaim assertions with zero node processes running at the time (ruling out the usual environment-contention explanation); re-ran immediately and got a clean 27/27/52/52 — a transient timing flake in code this sprint never touches (task-queue claim/reclaim logic), not a regression, matching the same "investigate, re-run, confirm clean" pattern already established for this exact test file in Sprints 19/41/43/45/46.
- `prettier --check`/`--write` applied to every file this sprint touched, then re-verified clean.
- Real Postgres verification: migrations `0047`–`0049` run against the real dev database (see DEVOS-288/290/291's own "Actual results"); a disposable `devos_fresh_verify` database created, migrated, seeded with a synthetic legacy scenario, and dropped to verify migration `0048`'s fallback branch (a code path the real dev environment's own history doesn't exercise).
- Real HTTP end-to-end verification against a running `apps/api`: organisation creation, role rejection, co-admin add, owner-removal guard, last-admin guard, ownership transfer, and organisation-wide project reach for a zero-membership admin (see DEVOS-290/292's own "Actual results"). All test data cleaned up afterward, confirmed zero remaining rows each time.
- Real browser verification via Playwright against a running dev server (see DEVOS-293's own "Actual results"), including a real bug found and fixed mid-verification.

## Gap disclosure

Real, disclosed, **not** left silently:

- **`changeOrganisationMemberRole`'s backend route is now vestigial.** `PATCH /organisations/:id/members/:userId` still exists and still works, but since `ORGANISATION_ADMIN` is the only valid org-level role, every call is an idempotent no-op confirmation (kept for API/DTO continuity with the project-scoped route's identical shape, not removed outright). The web client no longer wraps it — DEVOS-293's UI has no use for it.
- **`seed.ts` is idempotent only against a genuinely fresh database, not against this specific already-migrated real environment's own history.** Running `pnpm --filter @devos/database seed` a second time against the real dev database (which already carried a pre-existing org-level `OWNER`→`ORGANISATION_ADMIN` row from Sprint 39's own live verification, predating this sprint's new seed-script invariant) produced one harmless duplicate co-admin row for the same principal — found, understood, and cleaned up directly against real Postgres. A genuinely fresh `migrate`+`seed` run does not hit this, confirmed via the disposable `devos_fresh_verify` database.
- **The `effective_project_access` view's owner-without-membership-row branch is defensive, not currently reachable via this codebase's own real code paths.** `createOrganisation` and `transferOrganisationOwnership` both guarantee the owner always also holds a real `ORGANISATION_ADMIN` membership row, so for all real data today, the view's org-admin `UNION` branch alone would already produce identical results. The owner-specific branch exists because the source document's model calls for it and because a hypothetical future caller of `setOwnerPrincipalId` bypassing those two use cases could otherwise be resolved incorrectly — verified correct via the disposable test database (see DEVOS-291), not via real accumulated data.
- **No UI exists for viewing the `access_roles`/`permissions` catalogue itself.** DEVOS-288's tables are real and seeded, but nothing in `apps/web` lists them — this sprint's scope was authorization *behavior*, not a catalogue-browsing surface, and the backlog names no such UI requirement.
- **Sprint 48's own dependency is now unblocked but not started.** `AGENT_PROFILE`/agent attribution (backlog §6.3) needs real `PRINCIPAL` rows (Sprint 46) and this sprint's access-role scoping — both are now real. No agent-identity work was done this sprint.

## Actual results

**Sprint 47 (DEVOS-288–294) is COMPLETE** — full grounding, implementation, and live-verification evidence (including three real bugs found and fixed, not merely disclosed) are recorded in this sprint's own `DEVOS-288.md` through `DEVOS-293.md`. Full validation: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 green** (forced/uncached, run twice), matching Sprint 46's own baseline exactly; the full real `tests/e2e` suite **27/27 files, 52/52 tests green** (after one investigated, confirmed-transient flake unrelated to this sprint's own code). Awaiting explicit user approval before `DEVOS-ROADMAP.md`/`DEVOS-BUILD-STATE.md` are updated, per `AGENTS.md` §18/§19.
