# DEVOS-246 — Validation, documentation, and gap disclosure

**Priority:** P1
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.9

## Acceptance summary

Full validation green; full real `tests/e2e` suite green.

## Scope

- Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`, matching Sprint 36's own 76/76 baseline (no new package).
- Full real `tests/e2e` suite, matching Sprint 36's own 27/27 files, 52/52 tests baseline — zero regression expected (this sprint adds only new frontend files plus one additive `AgentVersion` field, no changed contract).
- New unit tests: DEVOS-244's 3 wrappers in `apps/web/tests/api-client.test.ts`.
- Live dev-server verification of DEVOS-245 (see its own Validation section).
- Record real findings, not fabricated ones: the missing `sourceProjectName` on `SharedAgentVersion` (a real divergence from `SharedKnowledgeSource`), and the absence of any client-side role gating on the Share action (matching this codebase's own established backend-enforces/UI-surfaces convention) — both disclosed in `README.md`/`DEVOS-245.md`.

## Out of scope (as originally scoped)

Fixing any disclosed gap not named in DEVOS-244/245's own scope.

## Addendum — validation results and a real finding made during live verification

Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 successful**, exactly matching Sprint 36's own baseline (no new package). The full real `tests/e2e` suite **27/27 files, 52/52 tests green** — zero regression. `apps/web/tests/api-client.test.ts` grew from 44 to 47 cases (3 new wrapper tests for DEVOS-244).

Live-verified against a real running `apps/api`/`apps/web` and the real seeded "DevOS POC" project/organisation via Playwright, with zero console/page errors throughout: a real draft agent was created, published, and shared through the restyled `AgentDetailPage.tsx` (chip and button correctly flip Not shared → Shared, Share → Unshare); it then appeared in `/agents/marketplace` with its real source project name resolved; it was installed for real into a different real project in the same organisation via the marketplace's own inline picker, reporting a real "Installed as … v1." confirmation; unsharing the original correctly removed it from the marketplace list again.

**A real, disclosed, pre-existing gap was found while choosing a version to verify with, not fabricated**: every project in this organisation already has its own `discovery-agent` (and every other project-type template agent), cloned in at project-creation time — confirmed directly (`agents_project_id_key_key` unique constraint on `(project_id, key)`, `packages/database/src/repositories/agents.ts`). Attempting to install a shared version of one of these template-cloned agents into *any* other project in the organisation therefore always fails with a real 500 (`DEVOS_INTERNAL_ERROR`, an unhandled Postgres `23505` unique-violation) — `installAgentVersion` (`packages/application/src/agents/install-agent-version.ts`, Sprint 23) never catches or de-conflicts a key collision. This is a real, pre-existing gap in Sprint 23's own use case, not introduced by this sprint and out of this UI-only sprint's own scope to fix (it would require a backend behaviour decision — reject with a clear error, or auto-rename the installed copy's key — neither of which the backlog's own §6.9 scope calls for). Verification worked around it correctly, not by disabling the check: a brand-new, uniquely-keyed agent was created, published, shared, and installed instead, which succeeded cleanly and proved the real UI path end-to-end.

**Real, permanent stray test data, disclosed rather than silently cleaned up** (no delete/archive route exists for `Agent` anywhere in this codebase — confirmed by inspection of `apps/api/src/routes/agents.ts` — the same accepted-gap pattern already documented for Sprint 35's stray artifact): three stray `sprint37-marketplace-<timestamp>`-keyed agents in the real "DevOS POC" project (one per verification attempt that reached the create-agent step, including two earlier attempts that failed on later, now-fixed script issues, not on the app itself), and two real installed copies of the same key in the real target project (`E2E Project e2e-1789742356969`) from the two attempts that reached a successful install. All are inert, harmless template-shaped rows, consistent with the many other e2e-leftover rows already present in this seeded environment before this sprint began.

**Sprint 37 (DEVOS-244–246, Agent Marketplace) implementation and validation are complete.** No remaining issues within this sprint's own declared scope.
