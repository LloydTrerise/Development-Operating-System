# DEVOS-243 — Validation, documentation, and gap disclosure

**Priority:** P1
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.8

## Acceptance summary

Full validation green; full real `tests/e2e` suite green.

## Scope

- Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`, matching Sprint 35's own 76/76 baseline.
- Full real `tests/e2e` suite, matching Sprint 35's own 27/27 files, 52/52 tests baseline — zero regression expected (this sprint adds only new frontend files plus two additive `HomeDashboardData` fields, no changed contract).
- New unit tests: DEVOS-240's 2 wrappers in `apps/web/tests/api-client.test.ts`.
- Live dev-server verification of DEVOS-241/DEVOS-242 (see their own Validation sections).
- Record real findings, not fabricated ones: the no-detail-route divergence from the Artifacts precedent, the four real runtime dispatch sites gated on exact `type`/`provider` string literals, and the absence of any real connectivity/health-check capability — all disclosed in `README.md`/`DEVOS-241.md`.

## Out of scope (as originally scoped)

Fixing any disclosed gap not named in DEVOS-240/241/242's own scope.

## Addendum — both items initially left as remaining issues were fixed per explicit user instruction

The sprint's first completion report disclosed two remaining issues rather than fixing them, per this codebase's established convention: a real stray `SPRINT36_VERIFICATION` integration row created during DEVOS-241's own live form-submission verification (no delete route exists to clean it up through the API), and the adjacent, out-of-scope stale non-clickable Home Artifacts tile (see DEVOS-242.md's own addendum). The user then explicitly instructed "fix both remaining issues" — both were fixed for real, not worked around:

- **Stray row**: deleted directly against the real Postgres database (`delete from integrations where name = 'SPRINT36_VERIFICATION'`), the same direct-SQL cleanup method this codebase has used for every prior pilot/verification's own test data (e.g. Sprint 23's marketplace pilot, Sprint 26's gap-closure pilot) — not a new backend delete route (none is added; `integrations` has no foreign-key dependents, confirmed by grep before deleting), and not a UI capability that doesn't exist. Confirmed 0 remaining rows by direct re-query immediately after.
- **Stale tile**: `HomePage.tsx`'s Artifacts `KpiTile` gained `to="/artifacts"` — see DEVOS-242.md's own addendum for the live re-verification.

Both fixes re-validated: full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 green**; full real `tests/e2e` suite **27/27 files, 52/52 tests green** — both re-run after the fixes, zero regression. No remaining issues from this sprint.
