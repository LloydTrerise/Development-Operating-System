# DEVOS-280 — Themed `:focus-visible`

**Priority:** P1 | **Estimate:** 0.25d
**Depends on:** none.
**Depended on by:** none within this sprint.

## Scope

Every interactive element shows a 2px accent outline on keyboard focus, not the browser default.

## Implementation

- `theme.ts`'s existing `MuiCssBaseline.styleOverrides` gains a global rule mirroring `Design/nocturne.css:120-121` exactly:
  ```ts
  ':focus': { outline: 'none' },
  ':focus-visible': ({ theme }) => ({
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  }),
  ```
  (styled as a function of `theme` so the accent color tracks `primary.main`'s own per-mode value already set in `palette`, without a second, possibly-drifting color literal).
- Scoped to the same global selector the source file uses (not per-component), consistent with `nocturne.css`'s own universal rule.

## Out of scope

Any component-specific focus treatment (e.g. `.input:focus-visible`'s border-only variant, `.seg-opt`'s inset variant) — the source design system's own more specific rules for form inputs are not present anywhere in this codebase's own component set today, so only the universal rule is ported, matching this sprint's own "fidelity pass, not redesign" scope.

## Acceptance

`pnpm --filter @devos/web typecheck build` clean. Real keyboard-only navigation (Tab) in the running dev app shows a 2px accent outline on every focused interactive element (nav links, buttons, form fields), never the browser's default blue ring, in both light and dark mode.

## Actual results

**A real bug was found and fixed during this task's own live verification, not just applied from the plan as written.** The first implementation (no `!important`, matching `nocturne.css:121` literally) typechecked/built clean but, verified via a real Playwright keyboard-navigation session against the real dev server, produced **zero visible outline on every focused element** (`outline-style: none`, `outline-width: 0px`) despite `element.matches(':focus-visible')` correctly returning `true`. Root cause: MUI's own `ButtonBase`-derived components (`Button`, `IconButton`, every `MenuItem`/`Tab`/etc.) and its form inputs (`OutlinedInput`, `Select`) each ship their own `.Mui-focusVisible`/input outline reset at the same CSS specificity (0,1,0) as a bare `:focus-visible` rule, inserted into the DOM after `MuiCssBaseline`'s global styles — a same-specificity cascade tie that source-order resolves in MUI's favor, silently suppressing the global rule. This doesn't exist in `nocturne.css`'s own source context (a plain static mockup with no competing component library), so a verbatim port was insufficient. Fixed by adding `!important` to the `outline` declaration only (not `outlineOffset`) — a real, disclosed, necessary adaptation beyond the source file's own literal rule, not present in `Design/nocturne.css` itself.

Re-verified after the fix via real Playwright keyboard navigation (5 real `Tab` presses) against the real dev server: every focused element (`MuiSelect` trigger, a real text `input`, two real `MuiIconButton`s) showed `outline-style: solid`, `outline-width: 2px`, `outline-color` exactly matching `theme.palette.primary.main` per mode (`rgb(145,132,217)` dark / `rgb(121,108,191)` light). `pnpm --filter @devos/web typecheck build` clean.
