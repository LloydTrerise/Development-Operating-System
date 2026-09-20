# DEVOS-178 — Real "install into project" primitive

**Priority:** P0 | **Estimate:** 2.5d
**Depends on:** DEVOS-177 (the `sharedAcrossOrganisation` flag).
**Depended on by:** DEVOS-180 (pilot exercises this).

## Scope

Clones a real, shared `AgentVersion`'s `configuration` into a brand-new `Agent`/`AgentVersion` (`PUBLISHED` immediately) under a different project in the **same organisation only**.

## Implementation

- `packages/application/src/agents/install-agent-version.ts` (new): given a source `AgentVersion` id and a target `projectId`, verifies the source version's `sharedAcrossOrganisation === true`; resolves both the source project's and the target project's `organisationId` and requires they match exactly (`NotFoundError` on mismatch, matching every other org-scoped route's own established convention — never a distinguishable "forbidden, but it exists" response, per this codebase's existing tenant-isolation error-shape precedent); requires the caller to have real membership in the _target_ project; creates a new `Agent` (new `key`/`id`, `PUBLISHED` `AgentVersion` v1, `configuration` copied verbatim) under the target project, mirroring `create-project.ts`'s own template-clone precedent exactly (a real copy, not a linked reference); writes an `agent.installed` audit record.
- `packages/application/src/agents/list-shared-agents-for-organisation.ts` (new): a real `agent_versions` ⋈ `agents` ⋈ `projects` join filtered to `sharedAcrossOrganisation = true` and `projects.organisation_id = :organisationId`, mirroring `listAuditRecordsForOrganisation`/`sumEstimatedCostUsdForOrganisation`'s own real-join, never-a-client-loop precedent (a third instance).
- `apps/api/src/routes/agents.ts` / a new `organisations.ts` addition: `GET /organisations/:organisationId/shared-agents` and `POST /organisations/:organisationId/shared-agents/:agentVersionId/install` (body: `{ targetProjectId }`).

## Out of scope

Any live/linked reference between the source and installed agent — a one-time clone only. Any cross-organisation path (rejected, not degraded).

## Acceptance

Unit tests: install into a same-organisation project succeeds and produces a real, independent `Agent`; install into a different-organisation project is rejected with `NotFoundError`; installing a non-shared version is rejected. `pnpm --filter @devos/application --filter @devos/api typecheck test` green.
