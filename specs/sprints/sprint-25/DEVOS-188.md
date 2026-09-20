# DEVOS-188 — Real, organisation-scoped "share" primitive

**Priority:** P0 | **Estimate:** 1.5d
**Depends on:** none (additive field on the existing `KnowledgeSource`).
**Depended on by:** DEVOS-189 (install reads this), DEVOS-190 (pilot exercises this).

## Scope

`KnowledgeSource` gains an additive `sharedAcrossOrganisation: boolean` (default `false`), settable only by a project `OWNER`.

## Implementation

- New migration `0040_knowledge_sources_add_shared_across_organisation.ts`: `knowledge_sources` gains `shared_across_organisation boolean not null default false`, mirroring migration `0039`'s identical `agent_versions` precedent exactly.
- `packages/domain/src/knowledge/knowledge-source.ts`: `KnowledgeSource` gains `sharedAcrossOrganisation?: boolean`; `KnowledgeSourceRepository` gains `setSharedAcrossOrganisation?: (id: KnowledgeSourceId, shared: boolean) => Promise<void>`.
- `packages/application/src/knowledge/share-knowledge-source.ts` (new): resolves the source and its project, requires `canPublishAgent`-equivalent authority — reuses `canPublishAgent(membership.role)` directly (an `OWNER`-only check with no knowledge-specific semantics, so no new `canShareKnowledgeSource` function is introduced purely to rename an identical `role === 'OWNER'` check), calls `setSharedAcrossOrganisation`, writes a `knowledge-source.shared`/`knowledge-source.unshared` audit record.
- `apps/api/src/routes/knowledge-sources.ts`: new `POST /knowledge-sources/:knowledgeSourceId/share` route (body: `{ shared: boolean }`).

## Out of scope

Any cross-organisation visibility (ADR-SEC-005, out of scope entirely). The install side (DEVOS-189's job).

## Acceptance

Unit tests: a non-`OWNER` sharing attempt is rejected; a real source's `sharedAcrossOrganisation` flips correctly and is audited; sharing an archived source is rejected (mirrors DEVOS-177's "sharing a draft makes no sense" check, applied to `ARCHIVED` here). `pnpm --filter @devos/domain --filter @devos/database --filter @devos/application --filter @devos/api typecheck test` green.
