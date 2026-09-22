# DEVOS-249 — Validation, documentation, and gap disclosure

**Priority:** P1
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.10

## Acceptance summary

Full validation green; full real `tests/e2e` suite green.

## Scope

- Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`, matching Sprint 37's own 76/76 baseline (no new package).
- Full real `tests/e2e` suite, matching Sprint 37's own 27/27 files, 52/52 tests baseline — zero regression expected (this sprint adds only new frontend files, no changed contract).
- New unit tests: the two now-finally-used `listSharedKnowledgeSources`/`installKnowledgeSource` wrappers, added to `apps/web/tests/api-client.test.ts`, mirroring DEVOS-244's own new-wrapper test pattern (even though the wrappers themselves predate this sprint, they had zero test coverage until now).
- Live dev-server verification of DEVOS-248 (see its own Validation section).
- Record real findings, not fabricated ones: confirm (or correct) the grounding's claims that `SharedKnowledgeSource` already carries `sourceProjectName` and that `installKnowledgeSource` already de-conflicts a colliding key, and that no `ProjectTypeKnowledge` template-clone concept exists to reproduce Sprint 37's collision scenario.

## Out of scope (as originally scoped)

Fixing any disclosed gap not named in DEVOS-247/248's own scope.

## Addendum — validation results and real findings from live verification

Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 successful**, exactly matching Sprint 37's own baseline (no new package). The full real `tests/e2e` suite **27/27 files, 52/52 tests green** — zero regression. `apps/web/tests/api-client.test.ts` grew from 47 to 49 cases (2 new wrapper tests for the two previously-untested `listSharedKnowledgeSources`/`installKnowledgeSource` wrappers).

Live-verified against a real running `apps/api`/`apps/web` and the real seeded "DevOS POC" project/organisation via a throwaway Playwright script (run from inside `apps/web`, deleted afterward), with zero console/page errors throughout: a real knowledge source was created, shared through the existing `KnowledgeSourceDetailPage.tsx` toggle (chip and button correctly flip Project-only → Shared, Share → Unshare); it then appeared in `/knowledge/marketplace` with its real source project name (`DevOS POC`) rendered directly from the API response, with no client-side resolution needed; it was installed for real into a different real project (`E2E Project e2e-1790086588063`) in the same organisation via the marketplace's own inline picker, reporting a real "Installed as … ." confirmation; the installed copy was confirmed to exist via a direct `GET /projects/:id/knowledge-sources` query against real Postgres; unsharing the original correctly removed it from the marketplace list again.

**Both real, favourable divergences the grounding predicted were confirmed empirically, not just assumed:**
- `SharedKnowledgeSource.sourceProjectName` is genuinely present and correctly populated — confirmed both through the UI (no fallback-to-raw-id path was ever exercised) and by the passing test suite.
- `installKnowledgeSource`'s key de-conflict was directly exercised (not just read in source): the same shared source was re-shared and installed a second time into the same already-occupied target project via a direct `POST` against the real route — it succeeded with a real auto-suffixed key (`sprint38-marketplace-<ts>-5706e68c`) instead of the real Postgres `23505` unique-violation 500 that Sprint 37 hit for `installAgentVersion`. This is the one collision scenario Sprint 37's own gap could have recurred for, and it did not.
- No `ProjectTypeKnowledge` template-clone concept exists (reconfirmed) — no project starts with pre-existing knowledge sources, so the collision above only occurred because this sprint's own verification deliberately re-installed the same source twice, not because of any project-type-driven default population.

**Real test data was created and, unlike Sprint 37's disclosed permanent agent-marketplace strays, was cleaned up rather than left in place**: `KnowledgeSource` has a real `archiveKnowledgeSource` route (a status transition, not a delete) that `Agent` lacks entirely. The three real rows created during verification (the original shared source in "DevOS POC", and its two installed copies in the target project — one from the UI flow, one from the direct-API collision check) were all archived (`status: ARCHIVED`) after verification completed, leaving no new stray active rows in the seeded environment.

**Sprint 38 (DEVOS-247–249, Knowledge Marketplace, Consume Side) implementation and validation are complete.** No remaining issues within this sprint's own declared scope.
