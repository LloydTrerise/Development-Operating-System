# DEVOS-265 — Global Command Palette

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** DEVOS-264 (reuses its result-rendering/navigation logic for the palette's live entity search); every route the palette's static actions target (all real, all already shipped by earlier sprints).
**Depended on by:** None (epic-terminal for this sprint).

## Scope

A `⌘K`/`Ctrl+K`-triggered palette (`ui-spec.txt` §28: open project, search work, start workflow, open approval, open artifact, open run, jump to agent, open integration, view recent activity) — pure frontend, since every target action already has a real route by this point in the epic. Keyboard-accessible per the spec's own requirement.

## Implementation

- New `features/search/CommandPalette.tsx`, mounted once in `App.tsx`. A `window`-level `keydown` listener (added in `App.tsx`, the first global keyboard shortcut in this codebase — confirmed by grep, no precedent exists) opens it on `(event.metaKey || event.ctrlKey) && event.key === 'k'`, `preventDefault()`'d.
- Rendered as a real MUI `Dialog` (`open`/`onClose`) containing a text input and a scrollable list, fully keyboard-navigable: `ArrowUp`/`ArrowDown` move a highlighted index, `Enter` activates the highlighted entry, `Escape` closes (MUI `Dialog`'s own built-in behavior).
- **Static actions** (real routes only, per `README.md`'s action-to-route audit — always shown, filtered by fuzzy label match against the typed query):
  - Open project… → expands to the real project list (`useProjectContext().projects`); selecting one calls `selectProject(id)` then navigates to `/projects/:id`.
  - Start workflow → `/runs`.
  - Open approval → `/approvals`.
  - Open artifact → `/artifacts`.
  - Open workflow run → `/runs` (same real destination as "Start workflow" — disclosed limitation, no run-detail route exists anywhere in this codebase).
  - Jump to agent → `/agents`.
  - Open integration → `/integrations`.
  - View recent activity → `/governance`.
- **Live entity search** ("search work" in the spec's own action list, generalized to every entity type DEVOS-264 already searches, not just work items — a single implementation covers both, matching that story's own literal "grouped by entity type" requirement): once the palette's query is 2+ trimmed characters, the same debounced `searchProject` call DEVOS-264 makes runs here too, rendered as additional grouped sections below the static actions, using the exact same per-entity-type navigation targets DEVOS-264 established.
- Every action, static or dynamic, closes the palette and resets its query on selection.

## Out of scope

Any action whose real target route does not exist (disclosed in `README.md`; not invented here). Command history/most-recently-used ordering (no spec requirement, no precedent). A second, separate search implementation — this story calls DEVOS-264's own logic rather than duplicating it.

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. Live-verified against a real running dev server: `Cmd+K`/`Ctrl+K` opens the palette from any page; every static action navigates to its real, disclosed destination; typing a real matching query shows real grouped entity results identical in shape to DEVOS-264's own top-bar dropdown; `Escape` and arrow-key navigation both work for real, confirmed via Playwright keyboard events, not just code inspection.

## Actual results

Implemented exactly as scoped. `CommandPalette.tsx` is mounted once in `App.tsx`; the `window`-level `Cmd+K`/`Ctrl+K` listener is the first global keyboard shortcut in this codebase, confirmed still true by grep before adding it. Every selectable row (static action, project-picker entry, or live search result) carries a shared `data-command-item` marker; real `ArrowUp`/`ArrowDown` keyboard navigation walks that flat, DOM-order list via `querySelectorAll` and native `.focus()`, and `Enter` clicks whichever element is currently focused — reusing the browser's own real focus/click semantics rather than a second, parallel "selected index" rendering model.

`pnpm --filter @devos/web typecheck lint build` clean (confirmed individually, then again as part of the full monorepo run below).

**Live-verified against a real running dev server and the real seeded "DevOS POC" project** (the same throwaway Playwright script as DEVOS-264, deleted afterward): `Ctrl+K` opens the palette from the Home page; all 7 static actions plus "Open project…" render in the documented order; `ArrowDown` × 2 then `Enter` correctly moved real DOM focus from "Open project…" → "Start workflow" and navigated to the real `/runs` route, closing the palette; a second `Ctrl+K` + `Escape` closed it again; typing "rollback" rendered the same real, grouped, non-empty live-search results DEVOS-264's own dropdown renders (a real `Work Items` section from the real search route); typing "open project" showed the "Open project…" row, and selecting it opened a picker listing real projects including "DevOS POC" by name.

**One real, disclosed, test-only finding, not a production bug**: the first version of the live-verification script pressed arrow keys immediately after `Ctrl+K` without confirming the `TextField`'s `autoFocus` had actually landed on the input yet (MUI's `Dialog` enter-transition can briefly leave focus elsewhere), so the keys reached no listener and nothing happened. Confirmed via direct instrumentation (a temporary `console.log` inside the real keydown handler, removed afterward) that this was a test-timing race, not a real defect — once the script explicitly waited for and clicked the input first (matching how a real user's own keystroke naturally lands after the dialog visibly opens), arrow-key navigation worked correctly on the first real attempt. No source change was made in response to this — it was purely a verification-script fix.

Zero console/page errors during the palette portion of the verification run.
