# DEVOS-275 — Full monorepo + e2e validation

**Priority:** P0
**Acceptance summary (from backlog §6.17):** `pnpm turbo run typecheck lint test build` green across the whole epic's changes; full real `tests/e2e` suite green.

## Method

No production code changed in this sprint (DEVOS-273/274 were audit-only, found zero code gaps requiring a fix; DEVOS-276 is documentation only) — so this task's own validation re-confirms the existing baseline rather than proving a new change, per this codebase's own established convention of always re-running the real gates rather than asserting continuity from code review alone (AGENTS.md §15/§16).

Environment checked first, per this repository's own documented gotchas: Docker (`postgres`/`redis`/`vault`/`prometheus`) already up; no stray `apps/worker` process running (`Get-CimInstance Win32_Process` filtered for `apps/worker`/`apps\worker` in `CommandLine`, zero matches) — so no risk of racing `hardening.test.ts`'s direct task-queue assertions, the exact interference Sprint 43 hit and had to resolve. A pre-existing stray `apps/api` dev server was found already listening on port 3000 (PID 24480, not started by this session) — left untouched; the `tests/e2e` suite spawns its own `apps/api` instances on separate, dynamically-allocated or per-file-fixed ports and does not conflict with it, per this repository's own already-confirmed finding from Sprint 43's handover.

## Actual results

**`pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`: 76/76 successful, 0 failed** — exactly matching Sprint 43's own baseline (`DEVOS-BUILD-STATE.md`'s 2026-09-23 (Sprint 43) entry). Full output confirmed all packages' typecheck/lint/test/build tasks passed, including `@devos/application` (346 tests), `@devos/api` (99 tests), `@devos/worker` (49 tests), and every other workspace package's own suite.

**Full real `tests/e2e` suite (`cd tests/e2e && pnpm test`, its own correctly-configured `fileParallelism: false` script): 27/27 files, 52/52 tests green** — exactly matching Sprint 43's own baseline, zero regression. Includes `hardening.test.ts`'s own direct `claimNext()`/`reclaimStale()` task-queue assertions, confirmed passing clean (no worker-contention interference, unlike Sprint 43's first run).

Both gates run once each this sprint (not twice, unlike some prior sprints that re-ran after a mid-sprint fix) since no code change occurred between DEVOS-273/274's audit findings and this task — there was nothing to re-validate against.

## Disclosure

This task's own validation does not itself constitute new evidence that any of DEVOS-273's newly-surfaced findings (the `POST /projects/:id/approvals` orphaned route; the `GET /organisations/:id`/`GET /projects/:id` list-covered routes; the pre-existing `ApprovalsPage.tsx` evidence-fetch-loop bug) are fixed — none were, by this sprint's own explicit scope decision (see `DEVOS-273.md`'s own disclosure and `README.md`'s "Out of scope"). This task only confirms the codebase's existing, already-shipped behavior remains correct.
