# DEVOS-282 — Validation, documentation, and gap disclosure

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** DEVOS-277, DEVOS-278, DEVOS-279, DEVOS-280, DEVOS-281.
**Depended on by:** none.

## Scope

Full monorepo validation; a real dev-server visual check of Home, Work Items, Runs, and Approvals in both light and dark mode; explicit disclosure of any status/button/focus/shadow instance this sprint's own scope didn't reach.

## Implementation

- `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`, compared against Sprint 44's own last-known-green baseline (76/76).
- The full real `tests/e2e` suite (`pnpm --filter @devos/e2e-tests test`), compared against Sprint 44's own baseline (27/27 files, 52/52 tests) — this sprint touches only `apps/web` theme/component files, no route/use-case/domain logic, so no e2e regression is expected, but the suite is run for real, not assumed clean.
- `prettier --check`/`--write` on every file this sprint touched.
- A real dev-server visual pass across Home, Work Items, Runs, and Approvals, in both light and dark mode, confirming DEVOS-277–281's acceptance criteria hold together (not just individually).

## Out of scope

Fixing any gap found here beyond this sprint's own five stories — a genuinely new finding is disclosed, not silently expanded into.

## Acceptance

Full validation green, matching or explicitly explaining any delta from Sprint 44's baseline. Real dev-server evidence recorded, not asserted from code review alone. Any residual status/button/focus/shadow instance outside this sprint's own reach (if found) is named explicitly.

## Actual results

Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`: **76/76 tasks green**, exactly matching Sprint 44's own baseline. `prettier --check` clean on every file this sprint touched (`theme.ts`, `theme-tokens.ts`, `StatusChip.tsx`) after one `--write` pass for whitespace only.

The full real `tests/e2e` suite (`pnpm --filter @devos/e2e-tests test`) was run twice. **First run: 8 files failed, 10/52 tests failed** — investigated per `AGENTS.md` §17 rather than dismissed. Root cause: a live `apps/api`/`apps/worker` dev-server session (PIDs 27528/14380, launched via `pnpm dev` before this sprint began, not started by this task) was running against the same real Postgres database the e2e suite's own spawned in-process API/worker instances use, racing over the same `workflow_tasks` queue — the identical environment-contention pattern already disclosed in Sprint 19's and Sprint 43's own state-change-log entries (never a regression in either case). Confirmed, not assumed: both live processes were stopped, and the suite was **re-run clean: 27/27 files, 52/52 tests green**, exactly matching Sprint 44's own baseline. This sprint's own code changes are `apps/web`-only (theme/component files, zero route/use-case/domain logic), consistent with an e2e suite that was never actually affected by this sprint's changes.

Real dev-server visual/computed-style verification (real Playwright against the real running dev server and real API/Postgres, both light and dark mode, zero console errors throughout) is recorded per-task in `DEVOS-277.md` through `DEVOS-281.md`'s own "Actual results" sections. Two real bugs were found and fixed during this verification, not assumed away — see `DEVOS-280.md` (the `:focus-visible` `!important` cascade-tie fix) — and one real, disclosed-not-fixed verification gap remains: `DEVOS-279.md`'s `color="success"` button path was confirmed correct by code review and a clean typecheck/build, but not independently live-confirmed, since no pending approval exists in the currently reachable dev data for that specific button to render. One real, disclosed, out-of-scope finding was surfaced and left alone, per `DEVOS-281.md`: most of the app's own `Card` components already use `variant="outlined"` (a pre-existing choice, and — confirmed against the source design system's own `.card` base rule — actually the more faithful treatment for plain content cards), so `shadowTokens.md`/`.lg`'s real live consumers are non-outlined `Paper`-based surfaces (`Menu`/`Select` popovers, confirmed; future `Dialog`/`Drawer` by the same unmodified mechanism), not the app's Card-based pages — a real, disclosed narrower-than-"every Card" consumption footprint, not a defect in the theme wiring itself (confirmed working exactly where it is used, on both `AppBar` and `Menu`).

No other status/button/focus/shadow instance was found outside this sprint's own reach during this verification pass.
