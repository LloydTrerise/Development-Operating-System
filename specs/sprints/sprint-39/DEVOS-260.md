# DEVOS-260 — Validation, documentation, and gap disclosure

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** DEVOS-254–259 (all prior stories in this sprint).
**Depended on by:** none — the last task in Sprint 39.

## Scope

Full monorepo validation green; full real `tests/e2e` suite green.

## Implementation

- Re-run `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` across the full monorepo (a final, independent pass after every prior story's own package-scoped checks).
- Re-run the full real `tests/e2e` suite via `pnpm --filter @devos/e2e-tests test`, confirming zero regression against Sprint 38's own baseline (27/27 files, 52/52 tests).
- `prettier --check` (or `--write` then re-check) across every file this sprint touched.
- Record every real, disclosed finding from DEVOS-254–259 in this file's own "Actual results" section (the backlog's placement error for tool capabilities; the widened `Membership.projectId` type; the deliberate no-fabricated-health-verdict decision; any new residual gap found during live verification) rather than letting them live only in the README.
- Per `AGENTS.md` §18/§19, do **not** update `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` as part of this story — those are updated only on the user's own explicit approval of Sprint 39's completion.

## Out of scope

Any new feature work. Any roadmap/build-state file edit (explicitly deferred to the user's own "mark complete" instruction).

## Acceptance

Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` green. Full real `tests/e2e` suite green, zero regression from Sprint 38's baseline. Every real gap or design decision from this sprint disclosed here and in each task's own "Actual results," not hidden.

## Actual results

Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` (forced, no cache): **76/76 tasks successful**, matching Sprint 38's own baseline (no new package). The full real `tests/e2e` suite: **27/27 files, 52/52 tests green**, zero regression — no new e2e test file was added this sprint (every story's own real-Postgres/real-dev-server live verification, recorded in its own task file, proves the feature end-to-end without a third, permanent e2e file). `prettier --write`/`--check` applied and re-verified clean across every one of the 29 files this sprint touched (scoped, not repo-wide — the repository's own pre-existing, unrelated ~950-file formatting drift, established since Sprint 19, was left untouched per this task's own narrow scope).

Real gaps/findings from this sprint, consolidated here (each also recorded in its own story's "Actual results"):

1. **A real, generalizable MUI v7 bug found and fixed** (DEVOS-257): `Switch`'s `inputProps` prop silently does not attach an `aria-label` under this codebase's MUI v7 — fixed to `slotProps={{ input: {...} }}`, this codebase's own already-established convention elsewhere. Confirmed by grep to be the only `inputProps` usage anywhere in `apps/web`, so no other component carries the same latent defect.
2. **A real accessibility/locator nuance, not a code defect** (DEVOS-255): a `ListItemButton` row's accessible name concatenates its descendant `IconButton`s' own `aria-label`s, so a loose name query for one of two per-row icon buttons on `OrganisationsPage.tsx` matches the whole row too — resolved with `exact: true` in verification tooling, not a UI change.
3. **A real, deliberately-kept row in the seeded organisation** (DEVOS-254): an explicit org-level `OWNER` membership for `seed-user` was added to unblock live verification's own cleanup path (the seeded org had zero pre-existing org-level rows), and left in place since it grants no authority `seed-user` didn't already have via the pre-existing project-level-OWNER fallback.
4. **A real, pre-existing, out-of-scope observation** (DEVOS-258): the real seeded project has 344 accumulated `Integration` rows from this session's own prior live-verification history (no delete/archive route exists for `Integration`) — surfaced by the new system-health route's real counts, not introduced by it.
5. **Two real, additive-but-optional repository-interface decisions** (DEVOS-254/256), both following this codebase's own established "additive optional repository method" convention rather than a broad required-field ripple across ~20–30 unrelated test fakes: `MembershipRepository.listForOrganisation` and `ToolCapabilityRepository.updateStatus` are both optional; `OrganisationMembershipAccessDeps`/narrower-typed helper functions were introduced where a full `OrganisationUseCaseDeps` would otherwise have broken two unrelated organisation-report call sites.

No organisation-with-zero-org-level-members edge case failure encountered by surprise — it is exactly what real-seeded-data verification exercised and is now documented in finding 3 above. `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` intentionally not touched by this task, per `AGENTS.md` §18/§19 — updated only on the user's own explicit approval of Sprint 39's completion.
