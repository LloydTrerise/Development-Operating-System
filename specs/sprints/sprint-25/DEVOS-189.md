# DEVOS-189 — Real "install into project" primitive

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-188 (the `sharedAcrossOrganisation` flag).
**Depended on by:** DEVOS-190 (pilot exercises this).

## Scope

Clones a real, shared `KnowledgeSource`'s content into a brand-new `KnowledgeSource` row (`ACTIVE` immediately) under a different project in the **same organisation only**.

## Implementation

- `packages/application/src/knowledge/install-knowledge-source.ts` (new): given a source `KnowledgeSourceId` and a target `projectId`, verifies `sharedAcrossOrganisation === true`; resolves both projects' `organisationId` and requires an exact match (`NotFoundError` on mismatch — the same real tenant-isolation convention `installAgentVersion` already established, never a distinguishable "forbidden, but it exists" response); requires real membership in the target project; creates a new `KnowledgeSource` (`ACTIVE`, `content`/`name`/`sourceType` copied verbatim, a new `key` disambiguated if it would collide with an existing key in the target project — appending a short suffix, mirroring no existing precedent exactly since agents have no unique-key-per-project constraint to collide against, but disclosed here as this task's own real, necessary addition); writes a `knowledge-source.installed` audit record.
- `packages/application/src/knowledge/list-shared-knowledge-sources-for-organisation.ts` (new): a real `knowledge_sources` ⋈ `projects` join filtered to `shared_across_organisation = true` and `projects.organisation_id = :organisationId`, mirroring `listSharedAgentVersionsForOrganisation`'s own real-join precedent (a fourth instance of this codebase's established pattern).
- `apps/api/src/routes/organisations.ts`: new `GET /organisations/:organisationId/shared-knowledge-sources` and `POST /organisations/:organisationId/shared-knowledge-sources/:knowledgeSourceId/install` (body: `{ targetProjectId }`), mirroring the agent marketplace's identical two-route shape.

## Out of scope

Any live/linked reference between the source and installed knowledge source — a one-time clone only. Any cross-organisation path (rejected, not degraded).

## Acceptance

Unit tests: install into a same-organisation project succeeds and produces a real, independent `KnowledgeSource`; install into a different-organisation project is rejected with `NotFoundError`; installing a non-shared source is rejected; a target-project key collision is disambiguated rather than failing. `pnpm --filter @devos/application --filter @devos/api typecheck test` green.
