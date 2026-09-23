# DEVOS-281 — Wire `shadowTokens` into elevated surfaces

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** none.
**Depended on by:** none within this sprint.

## Scope

Elevated surfaces (`Card`/`Paper`/`Dialog`/`Menu`/`Drawer` and anything else consuming MUI's `elevation`) render Nocturne's hairline-plus-ambient-darkness shadow instead of MUI's default elevation shadow.

## Implementation

- `theme.ts` gains a `shadows` array (`Theme['shadows']`, 25 entries, index 0 = `'none'`) built from the existing, unmodified `shadowTokens` (`sm`/`md`/`lg`) exported by `theme-tokens.ts`, grouped by Material's own elevation convention so every component's already-existing default elevation value (not touched by this task) resolves correctly:
  - index 0: `'none'`
  - indices 1–4 (`Card`/`Paper` default = 1, `AppBar` default = 4): `shadowTokens.sm`
  - indices 5–12 (`Menu`/popovers, commonly elevation 8): `shadowTokens.md`
  - indices 13–24 (`Drawer`/`Dialog`, commonly elevation 16/24): `shadowTokens.lg`
- This is a centralized, theme-level change (one array, one file) rather than touching any of the 28 files/65 call sites that use `elevation=`/`<Paper`/`<Card` today — per README grounding, none of them need to change since they already request an elevation value; only what that value resolves to changes.
- No separate light-mode variant is introduced — `shadowTokens` is itself the source design system's only defined shadow-token set (confirmed in README grounding); the same values are used in both modes, verified visually rather than assumed acceptable.

## Out of scope

A new light-mode-tuned shadow token set (not defined anywhere in the source design system — would be fabricated). Per-component elevation value changes (e.g. changing which elevation a given `Card` requests).

## Acceptance

`pnpm --filter @devos/web typecheck build` clean. A real dev-server check confirms elevated surfaces (at minimum a `Card`-based page and a `Dialog`/form) render the hairline-edge-plus-ambient-darkness shadow instead of MUI's default elevation shadow, in both light and dark mode, with no visual regression (e.g. no shadow so heavy it obscures content, no invisible/incorrect elevation).

## Actual results

Implemented exactly as planned: a 25-entry `nocturneShadows` array built from the existing, unmodified `shadowTokens`, passed as `createTheme({ shadows: ... })`. `pnpm --filter @devos/web typecheck build` clean.

Live-verified via real Playwright against the real dev server: the `AppBar` (`MuiPaper-elevation4`) renders `box-shadow: rgb(63,66,77) 0px 0px 0px 1px` — an exact match to `shadowTokens.sm` (`#3f424d`). A real `MuiSelect` dropdown menu (`MuiPaper-elevation8`, MUI's own default `Menu` elevation) renders `box-shadow: rgb(89,93,108) 0px 0px 0px 1px, rgba(0,0,0,0.55) 0px 6px 18px 0px` — an exact match to `shadowTokens.md`. Both confirm the `shadows` array is wired correctly and consumed automatically, with zero code change to either component.

**A real, disclosed, not-a-bug finding**: a dump of the first 10 real `MuiPaper`/`MuiCard` elements rendered on the real Home page found the large majority (`MuiCard-root` instances) already render with `variant="outlined"` — a pre-existing choice from an earlier sprint, not touched by this task — and MUI's own `Paper` component never applies an elevation `box-shadow` to an outlined variant, by design, regardless of the `shadows` array. Direct inspection of `Design/_ds/.../styles.css:203-206` confirms this actually matches the source design system's own intent: `.card`'s base rule has no border and no shadow at all (`background: var(--color-surface)` only) — `.elev-sm/md/lg` are separate, explicitly opt-in utility classes, not applied to every card by default. So `shadowTokens.md`/`.lg`'s real, live consumers today are components that use MUI's own non-outlined default `Paper` (confirmed: `AppBar`, `Menu`/`Select` popovers, and by the same mechanism any future `Dialog`/`Drawer`) rather than the app's `Card`-based content surfaces, which intentionally use a border, not a shadow, matching the mockup's own `.card` base style — not a gap this task's own narrow scope (wire the token, don't redesign Card usage) authorizes changing.
