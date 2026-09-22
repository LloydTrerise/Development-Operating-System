# DEVOS-234 — Artifact API client completion

**Priority:** P0
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.7

## Acceptance summary

Adds the 3 currently-unwrapped client functions (`createArtifact`, `getArtifactForPrincipal`, `listArtifactVersions`) plus `getArtifactProvenance`, against their existing, unchanged route contracts.

## Scope

- `apps/web/src/api-client.ts`:
  - Widen the existing `ArtifactVersion` interface with `contentUri: string` and `contentHash: string` — both are already returned by `toArtifactVersionDto` today; only the frontend type was narrower. Zero backend change.
  - `createArtifact(projectId, input: { artifactType: string; name: string; content: string; contentType?: string }): Promise<ApiResult<Artifact>>` against `POST /api/v1/projects/:projectId/artifacts` — typed to return `Artifact` only (matching the real route response, confirmed by direct read of `apps/api/src/routes/artifacts.ts`, not the richer `{ artifact, version }` the application-layer function returns).
  - `getArtifactForPrincipal(artifactId): Promise<ApiResult<Artifact>>` against `GET /api/v1/artifacts/:artifactId` — named to match the real application-layer use case (`packages/application/src/artifacts/get-artifact.ts`), per this story's own explicit naming.
  - `listArtifactVersions(artifactId): Promise<ApiResult<ArtifactVersion[]>>` against `GET /api/v1/artifacts/:artifactId/versions`.
  - `getArtifactProvenance(artifactId): Promise<ApiResult<ArtifactProvenanceInfo>>` against `GET /api/v1/artifacts/:artifactId/provenance`, with a new `ArtifactProvenanceInfo { workflowRunId?: string; workflowTaskId?: string }` type matching the real, narrower response (not the richer domain `ArtifactProvenance` contract type, which no real code path implements — see `README.md`'s own grounding).

## Out of scope

Any backend route or DTO change. A content-serving wrapper (no route exists to fetch decoded artifact bytes).

## Validation

`pnpm --filter @devos/web typecheck lint build`; 4 new `apps/web/tests/api-client.test.ts` cases (one per new wrapper), mirroring the existing `getAgent`/`getKnowledgeSource` test pattern.
