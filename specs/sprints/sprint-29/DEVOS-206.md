# DEVOS-206 — Decide and scaffold the detail-routing convention

**Priority:** P0 | **Estimate:** 1d
**Depends on:** DEVOS-205 (scaffolding lands inside the new `features/` structure).
**Depended on by:** Sprint 31 (DEVOS-213 work-item detail), Sprint 34 (DEVOS-230/231 agent/knowledge-source detail), Sprint 35 (DEVOS-236 artifact viewer) — every later sprint that introduces a genuinely new detail surface.

## Scope

Per the backlog's own already-made decision (§10 item 5): introduce real parameterized routes (`/entity/:id`) for net-new detail surfaces going forward, while leaving every existing in-page panel (e.g. Runs' task drill-down, which today is an in-page accordion, not a routed view) exactly as it is. This story decides the concrete routing/layout shape and scaffolds it — it adds no actual detail-page content.

## Real starting state (confirmed by direct inspection before scoping)

`apps/web/src/App.tsx`'s `<Routes>` (lines 299-314) has genuinely zero parameterized routes today — all 14 are static flat paths. There is no existing detail-page layout shell, breadcrumb pattern, or `useParams()` call anywhere in `apps/web/src` to extend; this is a from-scratch scaffold, not a generalization of an existing one.

## Implementation

- Add a shared layout shell, e.g. `apps/web/src/components/DetailPageLayout.tsx` (or under a new `apps/web/src/layout/` folder if that reads better against DEVOS-205's new structure): a consistent wrapper providing a back-navigation affordance, a title/header slot, and a content slot, styled with DEVOS-203's Nocturne theme tokens. This is a real, reusable component, not a per-page copy-paste template.
- Establish the route-pattern convention future sprints follow: `/{area}/:id` (e.g. `/artifacts/:id`, `/agents/:id`, `/work-items/:id`, `/knowledge/:id`) — matching each area's existing flat list-page path exactly, with `/:id` appended, so the convention is mechanically predictable for every future sprint rather than invented per-story.
- Add one real, minimal proof-of-concept route to confirm the convention actually works end-to-end in this app's router (React Router v7) — not a page with real content, but a genuine routed component reading `useParams()` and rendering the shared layout shell with the raw `id` value, to prove the mechanism before any later sprint depends on it. Remove or clearly mark this proof-of-concept route as scaffolding-only (e.g. behind a comment, or simply documented here as temporary) so a later sprint's real detail page cleanly replaces it rather than accumulating beside it.
- Do not add real content, data-fetching, or nav entries pointing at any specific future detail route (e.g. no "Artifact Viewer" link yet) — that is each later sprint's own job, per story.

## Out of scope

Any actual detail-page content (work item edit, agent detail, artifact viewer, etc. — all later sprints). Changing any existing in-page panel (e.g. Runs' task drill-down) to a routed view — the backlog's own decision explicitly leaves these untouched.

## Acceptance

A real, working parameterized route exists and is proven end-to-end (e.g. navigating to `/work-items/<some-real-id>` renders the shared layout shell with that id, confirmed via a real dev-server check), establishing the exact convention (`/{area}/:id`) every later sprint's detail-surface story will reuse without re-deciding it. `pnpm --filter @devos/web typecheck lint build` green.
