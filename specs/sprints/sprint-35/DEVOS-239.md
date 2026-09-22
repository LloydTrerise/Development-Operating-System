# DEVOS-239 — Validation, documentation, and gap disclosure

**Priority:** P1
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.7

## Acceptance summary

Full validation green; full real `tests/e2e` suite green.

## Scope

- Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`.
- Full real `tests/e2e` suite run against real Postgres/Redis.
- Cross-check of existing e2e/UI coverage (same discipline as DEVOS-216/220/228/233): confirm this codebase still has no browser DOM-rendering test harness for `apps/web`, so no existing test asserts on the new/relocated markup and none need updating.
- Manual dev-server (Playwright) verification of the full new flow: Library search/filter, a real artifact created through the form, the Viewer's header/content/metadata/provenance/relationships panels against real evidence artifacts, the version-history + diff panel against a real 2-version artifact, and the new links from `RunCard.tsx`/`ApprovalsPage.tsx`.
- Gap disclosure recorded in this file and in `DEVOS-BUILD-STATE.md`'s own sprint entry: no raw-content-serving route (Content/diff show `metadata` and pointer fields only); `getArtifactProvenance` adds no data beyond the artifact's own `provenance` field; no author/cross-project filtering on the Library (no `createdBy` on the `Artifact` DTO); no Review/Validation panels on the Viewer (no real per-artifact data source beyond what evidence `metadata` already carries, shown in Content); Relationships is a one-hop `derivedFromArtifactId` link only, no downstream index.

## Out of scope

Updating `DEVOS-ROADMAP.md`/`DEVOS-BUILD-STATE.md` — per `AGENTS.md` §18/§19, those are updated only on the user's explicit approval of the completed sprint.

## Validation

The commands listed above; all must complete successfully before this story (and the sprint) is reported complete.

### Results (2026-09-22)

- `pnpm --filter @devos/web typecheck lint test build`: clean, **42/42 tests green** (34 existing + 4 new `api-client.test.ts` wrapper cases + 4 new `diff-lines.test.ts` cases).
- Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`: **76/76 successful**, exactly matching Sprint 34's own baseline (no new package).
- Full real `tests/e2e` suite (against the real running `docker-postgres-1`/`docker-redis-1` containers): **27/27 files, 52/52 tests green**, zero regression, matching Sprint 34's own baseline exactly.
- `npx prettier --check` on every file this sprint touched: clean after one `--write` pass (5 files needed it — the repo's own pre-existing, unrelated formatting drift left untouched, per this task's own narrow scope, matching prior sprints' own precedent).
- Cross-check of existing e2e/UI coverage (same discipline as DEVOS-216/220/228/233): this codebase still has no browser DOM-rendering test harness for `apps/web`, confirmed again — no existing test asserted on any new/relocated markup, and none needed updating.

### Live dev-server verification (real `apps/api` + real `apps/web` dev servers, real Postgres, Playwright, zero fabricated backend state)

Against the real seeded "DevOS POC" project (2548 real artifacts, 527 real approvals):

- Artifacts nav entry present and navigates to `/artifacts`; the Library renders all 2548 real rows; the name-search box and the data-derived type/status filter chips both correctly narrow the table.
- The "New artifact" form was used to create one real artifact (`SPRINT35_VERIFICATION` type) through the real `createArtifact` → `POST /projects/:id/artifacts` path; it appeared in the list immediately, and row-click navigated correctly to its own real Viewer page (`id` `4ca80adf-28a1-4776-9168-843a242bf65c`), which rendered its real, empty-metadata Content panel with the correct disclosure text. **This artifact is a real, permanent stray test row** — confirmed by direct inspection that no delete/archive route exists for artifacts anywhere in this codebase (`apps/api/src/routes/artifacts.ts` has no `DELETE`), the same accepted stray-test-artifact pattern already documented for Sprint 31/33/34's own equivalents.
- A real `REVIEW_EVIDENCE` artifact (id `4e2a9821-…`) opened at `/artifacts/:id` rendered its real `metadata` (a genuine review `summary`/`decision` JSON blob) in Content, and its real `metadata.derivedFromArtifactId` rendered as a working Relationships link that navigated correctly to the source `CODE_CHANGE` artifact's own Viewer page.
- Zero console/page errors on every Artifacts-area page visited.
- `RunsPage.tsx`/`ApprovalsPage.tsx` both still render correctly with the new links wired (structural check); `ApprovalsPage.tsx`'s detail pane's evidence rows are now real `RouterLink`s to `/artifacts/:id` using the already-present `artifactId` field.

### Real, disclosed gaps (not silently patched)

- **No raw-content-serving route** — Content/diff panels show each version's `metadata` (pretty-printed) plus the real `contentType`/`contentUri`/`contentHash` pointer fields, never decoded file bytes; no route in this codebase resolves `contentUri` back to content for any caller (see `README.md`'s own grounding).
- **`getArtifactProvenance` adds no data beyond the artifact's own `provenance` field** — confirmed by direct code inspection, disclosed in the Viewer's own Provenance panel text.
- **No author/cross-project filtering on the Library** — the `Artifact` DTO carries no `createdBy` field (only `ArtifactVersion` does), and the page is already scoped to the globally-selected project like every other project-scoped page.
- **No Review/Validation panels on the Viewer** — no real per-artifact data source beyond what evidence `metadata` already carries (shown in Content); not named in DEVOS-236's own acceptance text.
- **Relationships is a one-hop `metadata.derivedFromArtifactId` link only** — no downstream/reverse index exists (would require an unscoped full-project artifact-version scan).
- **No code path in this codebase ever creates a second version of an existing artifact** (see `DEVOS-237.md`'s own validation section for the direct-query/source-search confirmation) — the version-history/diff UI is real and correctly built against the versioned contract, but genuinely unexercised end-to-end against real multi-version data, since none exists anywhere in the real seeded database and none can be produced through any real API call.
- **A real, pre-existing bug found while live-verifying `ApprovalsPage.tsx`, confirmed via a real `git stash` isolation test against the exact pre-Sprint-35 code (identical failure reproduced), and correctly left alone, not silently patched, since it is outside this sprint's own declared scope**: with the real seeded project's 527 approvals, `ApprovalsPage.tsx`'s DEVOS-095 evidence-resolution effect fires one `getArtifactVersionById` fetch per unique evidence artifact-version id with no concurrency cap, producing 47 real `net::ERR_INSUFFICIENT_RESOURCES` console errors from the browser's own connection-pool exhaustion. The page still renders and functions correctly despite the errors (confirmed: the Approval centre list/detail pane both work), so this is a real, disclosed performance limitation, not a broken feature — flagged here for a future sprint to batch or cap, the same "found, isolated, disclosed, not silently fixed" discipline `DEVOS-BUILD-STATE.md` has already recorded for Sprint 32's Risk-activity 100-record cap.
