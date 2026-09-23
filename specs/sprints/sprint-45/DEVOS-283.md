# DEVOS-283 — Left sidebar nav icons

**Priority:** P2 | **Estimate:** 0.5d
**Depends on:** none.
**Authorized:** by explicit user follow-up ("yes do that", 2026-09-23), in direct response to a live-verification finding after Sprint 45 (DEVOS-277–282) was marked complete — not part of DEVOS-277–282's own scope, which named only status tints/button fill/focus ring/shadows.

## Scope

The real `NAV_GROUPS`-driven left sidebar (`App.tsx`, built by Sprint 29's DEVOS-204) has never rendered a per-item icon — only `ListSubheader` group labels and `ListItemText`, confirmed by `git diff` showing zero Sprint 45 changes to `App.tsx` and by direct inspection finding no `ListItemIcon` import anywhere in the file. `Design/DevOS.dc.html`'s own `navGroups` (lines 845-850) has always specified a Phosphor icon per item; this gap was never closed when the nav was regrouped in Sprint 29. This task adds a real icon (from `@mui/icons-material`, the app's own already-established icon library — not Phosphor, which this codebase has never depended on) to every one of the 16 real nav items.

## Implementation

- `App.tsx`'s `NAV_GROUPS` gains an `icon: ComponentType<SvgIconProps>` field per item, typed via `as const satisfies` (preserving literal `to string` types for routing while adding a checked icon field).
- 13 of the 16 real items map directly to the mockup's own `navGroups` icon choices (Home→`ph-house`, Work Items→`ph-list-checks`, Runs→`ph-flow-arrow`, Workflows→`ph-tree-structure`, Approvals→`ph-seal-check`, Governance→`ph-shield-check`, Agents→`ph-robot`, Knowledge→`ph-books`, Artifacts→`ph-file-text`, Projects→`ph-folders`, Integrations→`ph-plugs`, Engineering Intelligence→`ph-chart-line` i.e. the mockup's "Insights"), resolved to the closest semantic `@mui/icons-material` equivalent (`Home`, `Checklist`, `Timeline`, `AccountTree`, `Verified`, `GppGood`, `SmartToy`, `MenuBook`, `Description`, `Folder`, `Cable`, `Insights`).
- Workflow Library maps to the mockup's "Definitions" slot (`ph-git-branch`) → `AltRoute`, per the same precedent DEVOS-204 already established for this exact page.
- 5 real items the mockup's own IA never names (disclosed, same class of gap DEVOS-204 already disclosed for page placement) get a reasonable, disclosed icon choice: Organisations→`CorporateFare`, Project Types→`Category`, Agent Marketplace/Knowledge Marketplace→`Storefront` (reused for both, same real concept), Cost→`Paid`.
- Render: each `ListItemButton` gains a `<ListItemIcon sx={{ minWidth: 36 }}>` wrapping the resolved icon component at `fontSize="small"`, sized down from MUI's default 56px `ListItemIcon` width to match this app's already-compact typography (`theme.ts`'s `fontSize: 13`).

## Out of scope

Any icon set beyond `@mui/icons-material` (e.g. adding the Phosphor icon font as a new dependency — unnecessary, this app already has a working icon library). Any change to nav grouping, ordering, or labels. Icons anywhere outside the left sidebar.

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check confirms all 16 real nav items render a distinct (or intentionally-shared, for the two marketplace pages), correctly-loading SVG icon, with zero console errors.

## Actual results

Implemented exactly as planned. `pnpm --filter @devos/web typecheck lint build` clean; full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 green**, matching Sprint 45's own just-established baseline (this change is `apps/web`-only, no route/domain logic touched, so the e2e suite was not re-run a third time for this task — already reconfirmed clean twice during DEVOS-282).

Live-verified via real Playwright against the real running dev server: all 16 real `ListItemButton` nav rows render exactly one `<svg>` each, with `data-testid` confirming the correct icon component per item (`HomeIcon`, `ChecklistIcon`, `TimelineIcon`, `AccountTreeIcon`, `AltRouteIcon`, `VerifiedIcon`, `GppGoodIcon`, `CorporateFareIcon`, `FolderIcon`, `CategoryIcon`, `SmartToyIcon`, `StorefrontIcon` ×2, `MenuBookIcon`, `PaidIcon`, `InsightsIcon`, `DescriptionIcon`, `CableIcon`) — zero console errors. `prettier --check` clean after one `--write` pass.
