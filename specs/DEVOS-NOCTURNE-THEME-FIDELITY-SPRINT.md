# DevOS Nocturne Theme Fidelity — Single-Sprint Task Spec

**Document:** Single-sprint scope — a fidelity pass on the Nocturne theme, not a new epic.
**Status:** Proposed — not yet approved. This document is scoping only, per `AGENTS.md` §35/§4.2. It does not authorize conversion to `specs/sprints/sprint-45/` or any implementation.
**Task-ID authority:** Continues the real, continuous numbering used by every prior sprint/backlog document (`DEVOS-001`–`DEVOS-276`), starting at `DEVOS-277`.
**Requested by:** User, 2026-09-23 — "the UI color palette/theme to be done better... the spec in design was meant to be just that."

---

## 1. Purpose

E28 (Sprints 29–44) ported the Nocturne design system into `apps/web`'s MUI theme (`DEVOS-203`). A direct-code audit for this document (not assumed — every finding below is cited to its exact file) found that porting was real but incomplete: the base palette (background/surface/text/accent ramps) is faithfully ported, but four specific pieces of the design system that the mockup (`Design/DevOS.dc.html`) and its design-system bundle (`Design/_ds/nocturne-*/`) already fully specify were never carried into the app. This sprint closes those four gaps — it does not redesign the palette, since the palette itself is already correctly sourced.

## 2. Grounding

### 2.1 Status colors — the design already specifies them; the app doesn't use them

`Design/DevOS.dc.html` defines a complete status-tint system inline, for both dark mode (lines 22–35) and light mode (lines 47–60): `--st-ok`, `--st-run`, `--st-warn`, `--st-fail`, each with a matching `-bg` tint at 12–14% opacity, plus `--st-idle` and `--st-on-solid`, all in OKLCH at chroma 0.115–0.165 — consistent with the design system's own stated rule (`readme.md`: "Keep chroma low outside the accent... Do not flood large areas with the accent or any saturated fill").

`apps/web/src/theme.ts`'s own comment (lines 6–12) discloses the gap directly: *"nocturne.css itself defines no status-tint tokens, so there is nothing to port for those"* — true of the top-level `Design/nocturne.css` file, but not of the mockup's own inline tokens, which were never consulted. `StatusChip.tsx` (`apps/web/src/components/StatusChip.tsx:12-42`) maps every status string to MUI's stock `success`/`error`/`warning`/`info` chip colors instead — fully saturated Material colors that visually clash with the rest of the muted Nocturne surface.

### 2.2 Primary actions are filled, not outlined

`readme.md`: *"Buttons are outlined (1px accent border on transparent), not solid-filled... the primary is an accent outline, never a fill."* Confirmed by grep: **17 call sites** use `variant="contained"` (a solid accent fill) for primary submit/action buttons, spread across nearly every feature page (`WorkflowsPage.tsx:415`, `WorkItemsPage.tsx:211`, `ApprovalsPage.tsx:335`, `AgentsPage.tsx:318`, `ProjectsPage.tsx:292`, `IntegrationsPage.tsx:319`, `KnowledgeSourcesPage.tsx:238`, `RunsPage.tsx:235`, and 9 others). `theme.ts` has no `MuiButton` style override at all (confirmed — grep for `MuiButton` in `theme.ts` returns nothing), so there is no theme-level mechanism enforcing the outlined-only rule; each page decided its own variant independently. 79 other buttons already correctly use `variant="outlined"`, so this is a real, fixable minority, not a rewrite.

### 2.3 No themed keyboard focus state

`readme.md`: *"style keyboard focus with `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` — never leave the default blue focus ring."* Confirmed by grep: zero occurrences of `focus-visible`/`focusVisible` anywhere in `apps/web/src`. Every interactive element in the app currently falls back to the browser's default focus ring, not the design's accent ring.

### 2.4 Elevation tokens exist but are never used

`apps/web/src/theme-tokens.ts:25-29` already exports `shadowTokens` (`sm`/`md`/`lg`), a correct, verbatim port of the design system's `--shadow-sm/md/lg` (hairline edge + ambient darkness, tuned for the dark ground per `readme.md`'s elevation guidance). Confirmed by grep: `shadowTokens` has **zero import sites** anywhere in `apps/web/src` — the token was authored in Sprint 29 and never wired into a single component. Cards and elevated surfaces currently render with MUI's own default `elevation` shadows instead.

### 2.5 What's already correct (not in scope — no work needed)

- Background/surface/text colors (`theme.ts:26-39`) are a faithful, correctly-derived port of the design system's neutral and accent ramps, for both dark (verbatim) and light (recombined from the same ramps, disclosed as such) mode.
- Zero hardcoded hex colors exist anywhere in `apps/web/src` outside the theme files themselves — components already go through the palette consistently; this sprint is closing specific gaps, not fixing ad-hoc drift.
- Radius and spacing tokens (`theme-tokens.ts:10-23`) are correctly ported and already used.

---

## 3. Scope

| # | Story | Files touched | Acceptance |
| --- | --- | --- | --- |
| DEVOS-277 | Author status-tint tokens | `theme-tokens.ts` (new `statusTokens`, light+dark, verbatim from `DevOS.dc.html:22-35`/`47-60`) | Tokens match the mockup's OKLCH values exactly, keyed by mode, covering ok/run/warn/fail/idle + their `-bg` and `on-solid` variants. |
| DEVOS-278 | Rewire `StatusChip` to the new tokens | `StatusChip.tsx` | Every status in the existing `STATUS_COLOR` map (`success`→ok, `error`→fail, `warning`→warn, `info`→run, `default`→idle) resolves to the new muted tints instead of MUI's stock chip colors, in both light and dark mode. No change to which status maps to which semantic bucket — only the color each bucket renders as. |
| DEVOS-279 | `MuiButton` theme override + fix the 17 filled buttons | `theme.ts`, the 17 call sites listed in §2.2 | A theme-level `MuiButton` override makes `contained` render as the design's outlined-accent style (or the 17 sites are switched to `variant="outlined"` directly — implementer's choice, recorded in the task's own spec file); result is zero solid-accent-filled primary buttons remaining, matching the 79 already-correct outlined buttons. |
| DEVOS-280 | Themed `:focus-visible` | `theme.ts` (global `MuiCssBaseline` or a shared override) | Every interactive element shows a 2px accent outline on keyboard focus, not the browser default, verified by real keyboard-only navigation in the running dev app. |
| DEVOS-281 | Wire `shadowTokens` into elevated surfaces | Card/`Paper`-elevation usage across `apps/web/src` (likely centralized via a `MuiPaper`/`MuiCard` theme override rather than a per-component edit, given the token is meant to be global) | Elevated surfaces render Nocturne's hairline-plus-ambient-darkness shadow instead of MUI's default elevation shadow, in both light and dark mode. |
| DEVOS-282 | Validation, documentation, and gap disclosure | — | Full monorepo `pnpm turbo run typecheck lint test build` green; dev-server visual check of Home, Work Items, Runs, and Approvals in both light and dark mode; any status/button/focus/shadow instance this sprint's own scope didn't reach (if found) disclosed explicitly, not silently left inconsistent. |

## 4. What NOT to Build in This Sprint

- No change to the base palette (background/surface/text/accent) — already correct per §2.5.
- No new design tokens beyond the status-tint set in §2.1 — nothing else was found missing.
- No component redesign — this is a color/state/elevation fidelity pass on existing components, not a layout or IA change.
- No touch to `Design/` itself — it's the reference, not the target.

## 5. Definition of Done

- Every row in §3 independently verified against a real running `apps/web` dev build in both light and dark mode, not asserted from code review alone.
- Full monorepo validation green.
- `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` updated only on explicit user approval, per `AGENTS.md` §18/§19 — this document does not authorize touching either.

---

## 6. Open Decision

- **DEVOS-279's implementation choice** — a theme-level `MuiButton` override (fixes it once, for every future button too) vs. fixing the 17 call sites directly (smaller diff, but future contained buttons could reintroduce the same drift). Recommend the theme-level override; flagging so it's a deliberate choice, not an assumption.
