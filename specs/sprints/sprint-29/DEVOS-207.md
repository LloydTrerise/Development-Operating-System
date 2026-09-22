# DEVOS-207 — Validation, documentation, and gap disclosure

**Priority:** P1 | **Estimate:** 1d
**Depends on:** DEVOS-203, DEVOS-204, DEVOS-205, DEVOS-206.
**Depended on by:** none — closes Sprint 29, the hard prerequisite for every later sprint in this epic (backlog §7).

## Scope

Full monorepo validation, a real dev-server visual check across light/dark mode and the new grouped nav, and explicit disclosure of any real gap DEVOS-203-206 surfaced.

## Implementation

- Run `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` (the current standard non-e2e validation command, matching Sprint 28's own `DEVOS-202.md`); fix any real failure.
- Run the full real `tests/e2e` suite (`tests/e2e`'s own `vitest run` script, against real Postgres); confirm every existing file remains green — this sprint touches only `apps/web`, so this is a pure regression check, not expected to need any e2e test change.
- Real dev-server visual check (`pnpm --filter @devos/web dev`): confirm the Nocturne theme renders correctly in both light and dark mode (DEVOS-203), the grouped nav shows all 14 real routes correctly grouped with the two reserved-empty groups visible (DEVOS-204), every page still renders after the `features/` move (DEVOS-205), and the DEVOS-206 proof-of-concept parameterized route resolves correctly.
- Record in this file's own Acceptance/Gaps section: confirmation of the DEVOS-204 nav-grouping placement assumption (Project Types/Workflow Library/Cost/Engineering Intelligence placement) actually implemented, and whether the DEVOS-206 proof-of-concept route was removed or left as documented scaffolding.

## Out of scope

Any new feature. Any change beyond what DEVOS-203-206 already scoped.

## Acceptance

Full validation green: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` — record the actual pass count achieved (expect the same 19 non-e2e packages Sprint 28 reported, since this sprint adds no new package). The full real `tests/e2e` suite green with no regression to the file/test counts Sprint 28 last reported (27/27 files, 52/52 tests), since this sprint's scope is `apps/web`-only. Real dev-server visual confirmation of theme, nav, folder migration, and routing convention, documented here (not asserted from code review alone, per the epic's own Definition of Done, backlog §8).

## Actual results

Full validation green: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 successful** (matching Sprint 28's own baseline exactly — this sprint adds no new package). The full real `tests/e2e` suite **27/27 files, 52/52 tests green** — zero regression from Sprint 28's last-reported count, confirming this sprint's `apps/web`-only scope changed no engine/API behavior. No existing test needed updating: this codebase has no browser DOM-rendering test harness (confirmed by DEVOS-202's own prior disclosure, still true), so no test asserted on `NAV_ITEMS`'s flat shape or the `pages/` import paths to begin with.

Real dev-server visual confirmation (Playwright against the real Vite dev server, screenshots reviewed, zero console errors on every check): DEVOS-203's Nocturne theme renders correctly in both light (`#e4e7f5`/`#e4e7f5` background, purple `#796cbf` AppBar) and dark (`#161826` background, `#9184d9` accent) mode, confirmed via exact computed-style background-color matches to the ported hex tokens. DEVOS-204's grouped nav shows all 14 real routes correctly grouped under Overview/Work/Workflows/Decisions/Platform, with the two reserved-empty Artifacts/Integrations groups visible and no dead links. DEVOS-205's `features/` migration: every one of the 14 routes re-verified rendering real content post-move via direct navigation, zero console errors. DEVOS-206's `/work-items/:id` proof-of-concept route resolves correctly, rendering the shared `DetailPageLayout` with the real routed `id` param.

The DEVOS-206 proof-of-concept route (`WorkItemDetailPage.tsx`, wired at `/work-items/:id`) was **left in place as documented scaffolding**, not removed — its own file header explicitly marks it as scaffolding-only, to be replaced by Sprint 31's DEVOS-213 with real content, matching the precedent this codebase already uses for staged/placeholder work (e.g. DEVOS-128's canvas landing "alongside, not yet replacing" the table editor).

The DEVOS-204 nav-grouping placement assumption was implemented exactly as recorded in `DEVOS-204.md`: Project Types under Platform, Workflow Library under Workflows (filling the mockup's "Definitions" slot), Cost and Engineering Intelligence under Platform as their own entries.

## Gaps disclosed (not silently patched)

- **A real regression was introduced and then found and fixed within this sprint's own work, not by a later sprint:** DEVOS-203's original `theme.ts` set MUI's global `spacing` base unit to `2.8` (matching Nocturne's own `space-N = N×2.8px` scale literally). This silently broke every existing page's `sx`-based spacing that assumed MUI's default 8px unit — most visibly `App.tsx`'s own `Box component="main"` `mt: 8`, intended to clear the fixed `AppBar` (64px), which shrank to 22.4px, rendering the top of every page's content behind the AppBar. This had no visible effect on `DashboardPage.tsx` (its content starts with body text, not a title element, so the cramped-but-not-fully-hidden top margin wasn't obviously broken in DEVOS-203's own visual check) — it was only caught when DEVOS-206's new `DetailPageLayout` title/back-button row rendered fully hidden behind the AppBar in a real Playwright screenshot. Root-caused and fixed by reverting the global `spacing` override (`theme.ts` now uses MUI's default 8px unit, matching every existing page's own assumption) and moving Nocturne's literal spacing scale into `theme-tokens.ts`'s `spaceTokens` instead, for components that want that exact scale directly rather than as the app-wide unit. Re-verified via `getBoundingClientRect()` on `main` returning exactly `64` (correct AppBar clearance) on both `/` and `/work-items/:id` after the fix. This is disclosed here rather than silently amended into DEVOS-203.md's own history, since the mistake and its fix both happened for real during this sprint's actual execution.
- **`components/` was not further reorganized into per-feature subfolders** even though several components (`WorkflowCanvas.tsx`, `WorkflowNodeInspector.tsx`, `WorkflowPalette.tsx`, `WorkflowPathPreview.tsx`, `WorkflowVersionDiffView.tsx`, `PolicyAuthoringForm.tsx`, `ProjectTypeAgentsEditor.tsx`, `ProjectTypeWorkflowsEditor.tsx`) are, on inspection during the move, each used by exactly one feature. DEVOS-205's own spec allowed this as an option but did not require it; left as shared `components/` to keep this sprint's scope mechanical (import-path moves only), per AGENTS.md §8 — a reasonable future cleanup, not a defect.
- The mockup's own "Definitions" nav label (`Design/DevOS.dc.html`) is realized here as "Workflow Library" (today's real page), not renamed to literally match the mockup text — the real page's existing name was kept rather than introducing a cosmetic rename with no functional basis in any spec.
