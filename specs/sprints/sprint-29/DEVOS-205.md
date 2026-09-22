# DEVOS-205 — `features/` folder migration

**Priority:** P1 | **Estimate:** 1d
**Depends on:** none (mechanical; can run independently of DEVOS-203/204, but sequenced after them in this sprint's own task order per the backlog's story order — no code dependency either way).
**Depended on by:** Every later sprint's own restyle/net-new stories, which place new work directly under `features/{area}/` rather than the current flat `pages/`.

## Scope

Move `apps/web/src`'s current flat `pages/` (14 files) and any page-specific logic into the documented `features/{area}/` structure, import-path-only — no behavior change, no component logic rewritten.

## Real starting state (confirmed by direct inspection before scoping)

`apps/web/src` has exactly two subfolders today: `components/` (shared, cross-page components — e.g. `StatusChip.tsx`) and `pages/` (14 flat files, 1:1 with the app's 14 routes: `AgentsPage.tsx`, `ApprovalsPage.tsx`, `CostPage.tsx`, `DashboardPage.tsx`, `EngineeringIntelligencePage.tsx`, `GovernancePage.tsx`, `KnowledgeSourcesPage.tsx`, `OrganisationsPage.tsx`, `ProjectsPage.tsx`, `ProjectTypesPage.tsx`, `RunsPage.tsx`, `WorkflowLibraryPage.tsx`, `WorkflowsPage.tsx`, `WorkItemsPage.tsx`). No `features/` folder exists yet, not even partially — this is a from-scratch migration, not a continuation.

## Implementation

- Create `apps/web/src/features/{area}/` for each of the 14 areas (e.g. `features/agents/`, `features/approvals/`, `features/cost/`, `features/dashboard/`, `features/engineering-intelligence/`, `features/governance/`, `features/knowledge/`, `features/organisations/`, `features/projects/`, `features/project-types/`, `features/runs/`, `features/workflow-library/`, `features/workflows/`, `features/work-items/`), moving each page file in as `features/{area}/{Area}Page.tsx` (file name unchanged, only its directory moves).
- Update every import in `apps/web/src/App.tsx` (and anywhere else that imports a page component) to the new path.
- `components/` stays where it is — it is genuinely cross-feature shared UI (e.g. `StatusChip.tsx` is used by multiple pages), not a candidate for the per-feature move. If any component in `components/` is found, during the move, to be used by exactly one feature, relocate it into that feature's own folder (e.g. `features/{area}/components/`) — but do not go hunting for refactors beyond what the move itself surfaces (AGENTS.md §8).
- No file's internal logic, JSX, or exported symbol name changes — this is an import-path-only mechanical move, verified by diffing each moved file's content (should be byte-identical apart from its own internal relative imports, if any).

## Out of scope

Any component logic change. Any new abstraction, shared hook, or feature-level `index.ts` barrel beyond what's needed to keep imports resolving (do not invent structure the task doesn't require, per AGENTS.md §8).

## Acceptance

`apps/web/src/pages/` no longer exists; all 14 page components live under `features/{area}/`. `pnpm --filter @devos/web typecheck lint build` green — a clean typecheck is the primary proof no import was missed. A real dev-server visual check confirms every one of the 14 routes still renders its correct page with no regression. Any existing test importing a page component directly (grep before starting) has its import path updated.
