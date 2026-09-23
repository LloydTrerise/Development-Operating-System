# Sprint 45 — Nocturne Theme Fidelity Pass

**Source:** `specs/DEVOS-NOCTURNE-THEME-FIDELITY-SPRINT.md` (single-sprint scoping document, not part of any epic).
**Conversion date:** 2026-09-23
**Status:** Converted per explicit user authorization ("do the theme level muibutton and Proceed with sprint. Run through sprint fully without waiting for authorisation after each task. Stop once sprint is done", 2026-09-23), resolving the source document's own §6 open decision in favor of a theme-level `MuiButton` override.

## Goal

Close four real, disclosed gaps between the Nocturne design system (`Design/DevOS.dc.html`, `Design/_ds/nocturne-*/`) and what Sprint 29 (DEVOS-203) actually ported into `apps/web`'s MUI theme: unused status-tint tokens, solid-filled primary buttons where the design system requires outlined, a missing themed `:focus-visible` ring, and unused `shadowTokens`. This is a fidelity pass on existing components — no new design tokens beyond the status-tint set, no component redesign, no change to the base palette.

## Grounding (confirmed by direct code inspection at conversion time)

- `apps/web/src/theme.ts` lines 6–12 carry a comment asserting `nocturne.css itself defines no status-tint tokens, so there is nothing to port` — true of `Design/nocturne.css`'s own `:root` block, but the mockup file `Design/DevOS.dc.html` defines a complete `--st-*` status-tint system inline for both dark (lines 22–35) and light (lines 47–60) mode, never consulted by Sprint 29. `StatusChip.tsx` currently maps every status to MUI's stock `success`/`error`/`warning`/`info` chip colors.
- A direct count of `variant="contained"` in `apps/web/src` at conversion time found **16 call sites**, not the source document's own claimed 17 (`ApprovalsPage.tsx` has two `<Button>`s in its decision action bar; only the Approve button — `color="success"`, line 335 — is `contained`, the Reject button is already `variant="outlined"`). This is a real, disclosed correction to the source document's own count, made the same way every prior sprint in this codebase discloses a grounding correction rather than silently absorbing it. The fix itself (a theme-level override) is unaffected by the exact count.
- `Design/_ds/nocturne-*/styles.css`'s own `.btn` base rule (`background: transparent`) has **no solid-filled variant at all** — `.btn-primary`/`.btn-secondary`/`.btn-ghost` differ only in border/text color, never fill. This confirms the fix belongs at the theme level, applied to every `contained` button regardless of `color` (not just `color="primary"`), matching the design system's own blanket rule, not a primary-only carve-out.
- `Design/nocturne.css:120-121` defines a genuinely universal rule — `:focus { outline: none; } :focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` — with zero `focus-visible`/`focusVisible` occurrences anywhere in `apps/web/src` today.
- `apps/web/src/theme-tokens.ts`'s `shadowTokens` (`sm`/`md`/`lg`) is a verbatim, unmodified port of `nocturne.css:78-80`'s own single (dark-ground-tuned) `--shadow-*` set — confirmed the source file defines only one shadow-token set, no separate light-mode variant, the same "one dark-oriented palette" situation Sprint 29's own `theme.ts` comment already discloses for colors. `shadowTokens` has zero import sites anywhere in `apps/web/src`. A grep across `apps/web/src` found 65 `elevation=`/`<Paper`/`<Card` occurrences across 28 files — far too broad for a per-component edit within this sprint's own scope, confirming the source document's own suggestion of a centralized `theme.shadows` array override (consumed automatically by every `Card`/`Paper`/`Dialog`/`Menu`/`Drawer` at their existing elevation values) over touching 28 files individually.

## In scope

- **DEVOS-277** — Author `statusTokens` (light+dark, verbatim OKLCH values from the mockup) in `theme-tokens.ts`.
- **DEVOS-278** — Rewire `StatusChip.tsx` to render from `statusTokens` instead of MUI's stock chip colors, same status→bucket mapping as today.
- **DEVOS-279** — A single theme-level `MuiButton` override (resolved per explicit user instruction: theme-level, not the 17-call-site alternative) making every `variant="contained"` button render as an outlined-accent style, regardless of `color`.
- **DEVOS-280** — A themed `:focus-visible` ring via `MuiCssBaseline`, mirroring `nocturne.css:121` exactly.
- **DEVOS-281** — Wire `shadowTokens` into `theme.shadows`, consumed automatically by every elevated `Paper`/`Card`/`Dialog`/`Menu`/`Drawer`.
- **DEVOS-282** — Validation, documentation, and gap disclosure.

## Out of scope

Any change to the base palette (background/surface/text/accent). Any new design token beyond `statusTokens`. Any component redesign or layout/IA change. Any edit to `Design/` itself. A separate light-mode `shadowTokens` variant (the source design system defines only one; none is fabricated here).

## Task index

| ID        | Story                                              | File           |
| --------- | --------------------------------------------------- | -------------- |
| DEVOS-277 | Author status-tint tokens                            | `DEVOS-277.md` |
| DEVOS-278 | Rewire `StatusChip` to the new tokens                | `DEVOS-278.md` |
| DEVOS-279 | Theme-level `MuiButton` override                     | `DEVOS-279.md` |
| DEVOS-280 | Themed `:focus-visible`                              | `DEVOS-280.md` |
| DEVOS-281 | Wire `shadowTokens` into elevated surfaces           | `DEVOS-281.md` |
| DEVOS-282 | Validation, documentation, and gap disclosure        | `DEVOS-282.md` |
