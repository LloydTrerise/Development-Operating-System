# Sprint 29 — Theme, Navigation, Folder & Routing Foundation

**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.1 (E28 UI/UX Redesign & Full Functional Coverage, first sprint).
**Conversion date:** 2026-09-21
**Status:** Converted per explicit user approval of the backlog document's scope and open decisions ("proceed", 2026-09-21). First sprint of a newly-authorized epic — per AGENTS.md §4.1, only DEVOS-203 (the current task) proceeds next, not the whole sprint automatically.

## Goal

Sprint 29 is the hard prerequisite for every later sprint in this epic: a Nocturne-themed MUI palette, a regrouped sidebar nav, the `features/` folder structure, and a decided (but not yet populated) detail-routing convention. No story in this sprint changes any backend route or business behavior — every change is presentational/structural on `apps/web`.

## Grounding (confirmed by direct code inspection before scoping)

- `apps/web/src/theme.ts` (41 lines) already supports light/dark mode via `createAppTheme(mode)`; it customizes only `palette.primary`/`palette.secondary`/`background`, `typography.fontSize`/`h4`-`h6`, and two `components` overrides (`MuiTableCell`, `MuiCssBaseline`). It carries an explicit doc comment stating status colors are deliberately *not* custom palette keys — `StatusChip.tsx` (47 lines) already resolves every known status string to one of MUI's 5 built-in semantic colors (`success`/`error`/`warning`/`info`/`default`) via a hardcoded `STATUS_COLOR` map, falling back to `'default'` for unrecognized values (load-bearing, since `WorkItemStatus` and other status enums are open-ended per `packages/contracts/src/status.ts`).
- **Real correction to the backlog's own DEVOS-203 acceptance text:** the backlog assumed `nocturne.css` defines "authored status tints" for `theme.ts`/`StatusChip.tsx` to adopt. Direct inspection of `Design/nocturne.css` (294 lines) found **no status-tint custom properties at all** (`--color-success`, `--color-warning`, etc. do not exist) — only a neutral scale, an accent scale (×2), section/glow/ghost tokens, typography, spacing, radii, and shadow tokens. `StatusChip.tsx` already works correctly via MUI's own semantic palette and needs no rework. DEVOS-203 below is scoped to what's actually real: porting Nocturne's palette/typography/shape/spacing/shadow tokens into `theme.ts`, not inventing a status-tint layer neither source file has.
- `apps/web/src/App.tsx` (318 lines) has a genuinely flat 14-item `NAV_ITEMS` array (lines 45-60) rendered as one `<List>`, and confirmed **zero parameterized routes** (`<Routes>`, lines 299-314) — every route is a static flat path. This matches the backlog §2.2 correction exactly.
- `apps/web/src` has only two subfolders today: `components/` and `pages/` (14 flat page files, 1:1 with the 14 nav/route entries). **No `features/` folder exists yet, not even partially.**
- `Design/DevOS.dc.html`'s mockup nav (`navGroups`, lines 845-850) groups screens as: **Overview** (Home), **Work** (Work Items, Runs), **Workflows** (Designer, Definitions — Definitions unwired in the mockup itself), **Decisions** (Approvals, Governance), **Platform** (Agents, Knowledge, Artifacts, Projects, Integrations, Insights, Administration — several unwired placeholders in the mockup). This grouping does not cover 4 of today's real 14 pages (Cost, Project Types, Workflow Library, Engineering Intelligence) — DEVOS-204 below makes an explicit, disclosed placement decision for each rather than leaving them ungrouped.

## In scope

- **DEVOS-203** — Nocturne MUI theme (palette/typography/shape/spacing/shadow tokens; no status-tint rework, per the correction above).
- **DEVOS-204** — Regrouped sidebar navigation, with an explicit placement decision for the 4 real pages the mockup's own IA doesn't name, and two empty reserved groups (Artifacts, Integrations) for Sprints 35/36.
- **DEVOS-205** — `features/` folder migration (mechanical, import-path-only).
- **DEVOS-206** — Detail-routing convention decided and scaffolded (real `/entity/:id` routes for new surfaces going forward; existing in-page panels, e.g. Runs' task drill-down, untouched).
- **DEVOS-207** — Validation, documentation, and gap disclosure.

## Out of scope

Any backend/API route change (per backlog §7: Sprints 29-38 require none). Any change to `StatusChip.tsx`'s status→color mapping (per the correction above — it already works). Populating the reserved Artifacts/Integrations nav groups with real links (Sprints 35/36). Building any actual new detail-page content under the routing convention DEVOS-206 scaffolds (later sprints, per story). Adding an Administration nav entry (deliberately excluded from this whole epic per backlog §9).

## Task index

| ID        | Story                                                    | File           |
| --------- | --------------------------------------------------------- | -------------- |
| DEVOS-203 | Nocturne MUI theme                                         | `DEVOS-203.md` |
| DEVOS-204 | Regrouped sidebar navigation                                | `DEVOS-204.md` |
| DEVOS-205 | `features/` folder migration                                | `DEVOS-205.md` |
| DEVOS-206 | Decide and scaffold the detail-routing convention           | `DEVOS-206.md` |
| DEVOS-207 | Validation, documentation, and gap disclosure                | `DEVOS-207.md` |
