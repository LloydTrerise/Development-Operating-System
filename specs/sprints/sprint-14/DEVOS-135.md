# DEVOS-135 — Workflow library page

**Priority:** P1 | **Estimate:** 2d
**Depends on:** DEVOS-136 (clone-into-new-draft needs the new draft-version primitive; version history needs a real second version to be meaningful). Executed 4th.

## Scope

Search/filter (by project, type, status), clone-into-new-draft, version history, and a real run-health/usage summary (Designer spec §36) — reusing the existing `listWorkflowRunsForWorkItem`-style patterns already proven in `RunsPage.tsx`.

## Real gaps found before implementation (see `README.md`'s grounding for the first)

1. `WorkflowDefinitionSummary`/`toWorkflowDefinitionDto` (`apps/web/src/api-client.ts`, `apps/api/src/dto/workflow.ts`) carries only `id/projectId/key/name/description/createdAt/updatedAt` — no status, version count, or run data. `GET /projects/:projectId/workflows` needs a real, modest extension: compose each definition's latest-version status and version count from the already-existing `workflowVersions.listForDefinition` (confirmed present) in the same use case, no new table/migration.
2. **`WorkflowRunRepository` (`packages/domain/src/workflows/workflow-run.ts`) has no method to list a workflow's own runs** — only `listForWorkItem` exists (confirmed by reading the interface directly: `getById`/`getByVersionAndIdempotencyKey`/`listForWorkItem`/`create`, nothing keyed by workflow definition or version). A real run-health summary needs a new `listForDefinition(workflowDefinitionId)` repository method — since `WorkflowRun` only stores `workflowVersionId`, not `workflowDefinitionId`, this requires a real join against `workflow_versions` (mirroring this codebase's own existing join patterns elsewhere), not a fabricated metric.

## Implementation

- Extend `listWorkflowDefinitionsForProject`'s underlying DTO (or add a small composing step in the route handler) to include `latestVersionStatus`/`versionCount` per definition, sourced from real `workflowVersions.listForDefinition` calls already possible today.
- New `WorkflowRunRepository.listForDefinition(workflowDefinitionId)` (a new repository method + a small SQL join, mirroring `listForWorkItem`'s existing shape) — powers a real "N runs, M succeeded" summary per workflow, reusing `RunsPage.tsx`'s own established run-status-terminal-set logic (`RUN_TERMINAL_STATUSES`) rather than reinventing it.
- New `apps/web/src/pages/WorkflowLibraryPage.tsx`: a searchable/filterable (by project, by status) table of every workflow definition the user's projects contain, each row showing its real status/version count/run-health summary; a "Clone into new draft" action creates a real new `WorkflowDefinition` (via the existing `createWorkflowDefinition`, cloning the source definition's latest version's `definition` graph verbatim as the new one's initial draft) in the same or a different project; a "Version history" action lists a definition's real versions (`listWorkflowVersions`) with links into DEVOS-133's diff view.

## Out of scope

Any new run-health metric beyond a real success/failure/in-progress count (no invented "usage score" or similar without a spec basis).

## Acceptance

The library page lists a project's real workflows with their real status/version count; filtering by project/status narrows the real list correctly; cloning a real workflow definition creates a real new one (confirmed via Postgres) with the source's graph copied verbatim; the run-health summary for a workflow with 2 real completed runs and 1 real failed run shows exactly that, sourced from the new real `listForDefinition` query.
