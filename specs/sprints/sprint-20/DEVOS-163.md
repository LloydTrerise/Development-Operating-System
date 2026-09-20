# DEVOS-163 — Cross-project and organisation evidence query layer

**Priority:** P0 | **Estimate:** 2.5d
**Depends on:** none (extends existing `ArtifactRepository`/`WorkItemRepository`, no schema change).
**Depended on by:** DEVOS-164 (API reads these), DEVOS-167/168/169/170 (Sprint 21's DORA/bottleneck computations read these).

## Scope

`ArtifactRepository` gains a type-filtered project query and a real cross-project, organisation-scoped aggregation covering `REVIEW_EVIDENCE`, `TEST_EVIDENCE`, `SECURITY_SCAN_EVIDENCE`, and `RELEASE_EVIDENCE`. `WorkItemRepository` gains a rework-count aggregation. Zero new tables/migrations — this is a query over already-existing `artifacts`/`artifact_versions`/`work_items` rows.

## Implementation

**Corrected during implementation, disclosed here rather than left stale:** an evidence artifact's `decision`/`passed`/`action` data lives on its `ArtifactVersion.metadata`, not on `Artifact` itself — a plain `Artifact[]` filter (as originally drafted here) would still need a second per-artifact lookup to be useful. Since every real evidence-writing call site (`run-review-agent-task.ts`/`run-validation-task.ts`/`run-security-scan-task.ts`/`run-release-task.ts`) creates exactly one `ArtifactVersion` (`version: 1`) per artifact — confirmed by inspection, not assumed — the real implementation joins `artifacts` ⋈ `artifact_versions` (on `version = 1`) directly and returns the metadata inline:

- `packages/domain/src/artifacts/artifact.ts`: new `ArtifactEvidenceRow { artifactId; createdAt; metadata }`; `ArtifactRepository` gains:
  - `listEvidenceForProject?(projectId: ProjectId, artifactType: string): Promise<ArtifactEvidenceRow[]>`
  - `listEvidenceForOrganisation?(organisationId: OrganisationId, artifactType: string): Promise<ArtifactEvidenceRow[]>` (a real `artifacts` ⋈ `projects` ⋈ `artifact_versions` join on `projects.organisation_id`, mirroring `sumEstimatedCostUsdForOrganisation`'s join precedent).
- `packages/database/src/repositories/artifacts.ts`: implement both against `QueryExecutor`.
- `packages/domain/src/work-items/work-item.ts`: new `WorkItemReworkCount { workItemId; reworkCount }`; `WorkItemRepository` gains `countReworkCyclesForProject?(projectId: ProjectId): Promise<WorkItemReworkCount[]>`, reading `metadata->>'reworkCount'` via the same jsonb-text-extraction pattern `costBreakdownByRoleForOrganisation` already established, filtering to rows where the field is present and non-zero.
- `packages/database/src/repositories/work-items.ts`: implement it.

## Out of scope

Any new artifact type, any new column/migration, any change to `run-review-agent-task.ts`/`run-validation-task.ts`/`run-security-scan-task.ts`/`run-release-task.ts`'s own evidence-writing logic. Aggregation/rollup math (counts, rates) — that is DEVOS-164's job; this task only returns real rows.

## Acceptance

Unit tests (with an in-memory/fake `QueryExecutor` or the existing fake-repository pattern, matching this codebase's own established test style) for `listForProjectByType`/`listForOrganisationByType`: returns only matching-type artifacts; organisation query correctly excludes another organisation's projects (tenant isolation, ADR-SEC-005). A real Postgres integration test (mirroring DEVOS-150's own test style) proves the organisation join returns artifacts from more than one of that organisation's projects. `countReworkCyclesForProject` unit test: correctly reads a real `reworkCount` from `metadata`, correctly treats an absent/zero field as no rework. `pnpm --filter @devos/domain --filter @devos/database typecheck test` green. Every existing artifact/work-item repository test passes unmodified.
