# DEVOS-208 — Home dashboard data

**Priority:** P0 | **Estimate:** 1d
**Depends on:** none (Sprint 29's `features/` structure and routing convention already exist).
**Depended on by:** DEVOS-209 (layout renders this data).

## Scope

A real data-fetching hook for the Home dashboard, backed entirely by already-existing routes, for the currently selected project (`useProjectContext()`, the same hook every other page already uses).

## Implementation

- New `apps/web/src/features/home/use-home-dashboard-data.ts`: on `selectedProjectId` change, fetches in parallel:
  - `listWorkItems(projectId)` — for the Work Items KPI tile (total count; no status partition, per this sprint's own grounding).
  - `listApprovalsForProject(projectId)` — filtered client-side to `status === 'PENDING'` for both the Pending Approvals KPI tile and the Needs Attention section.
  - `listArtifacts(projectId)` — for the Artifacts KPI tile (total count).
  - `listAuditRecordsForProject(projectId)` — sorted by `createdAt` descending, for Recent Activity.
  - `listWorkflows(projectId)`, then `listWorkflowRunsForDefinition(workflowId)` for every returned definition (`Promise.all`), flattened into one array with each run annotated with its source definition's `name` (client-side join, mirroring `WorkflowLibraryPage.tsx`'s own established pattern) — filtered to non-`RUN_TERMINAL_STATUSES` for the Runs In Progress KPI tile and the Active Work section, sorted by `createdAt` descending.
- Returns `{ workItemCount, artifactCount, pendingApprovals, activeRuns, recentActivity, loading, error }` — a plain hook, no new component yet (DEVOS-209's job).
- No new client wrapper needed — every function this hook calls already exists in `api-client.ts`.

## Out of scope

Any new backend route. Any system-health data (omitted this sprint, per README grounding). Any work-item status filtering beyond a total count.

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check (via the seeded project) confirms the hook returns real, non-empty data matching what the existing Work Items/Approvals/Artifacts/Runs pages independently show for the same project — cross-checked directly, not assumed.
