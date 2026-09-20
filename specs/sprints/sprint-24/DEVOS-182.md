# DEVOS-182 — Knowledge source update & archive lifecycle

**Priority:** P0 | **Estimate:** 1.5d
**Depends on:** none.
**Depended on by:** DEVOS-183 (UI needs edit/archive), DEVOS-185 (pilot exercises archive).

## Scope

A knowledge source can be edited (name/content/sourceType) and archived (`ACTIVE` → `ARCHIVED`), closing the create-only gap this table has had since Sprint 3.

## Implementation

- `packages/domain/src/knowledge/knowledge-source.ts`: `KnowledgeSourceRepository` gains `update: (id: KnowledgeSourceId, changes: UpdateKnowledgeSourceInput, updatedAt: string) => Promise<void>`, mirroring `ProjectRepository.update`'s exact shape. New `UpdateKnowledgeSourceInput { name?: string; content?: string; sourceType?: string; status?: string }`.
- `packages/database/src/repositories/knowledge-sources.ts`: `update` issues a real `updateTable('knowledge_sources').set({...only-defined-fields, updated_at})`, mirroring `createProjectRepository`'s own `update` exactly.
- `packages/application/src/knowledge/update-knowledge-source.ts` (new): resolves the source and its project, requires real membership, validates non-empty strings for any field supplied (reusing `createKnowledgeSource`'s own validation shape), calls `deps.knowledgeSources.update`, writes a `knowledge-source.updated` audit record (extends DEVOS-115's coverage).
- `packages/application/src/knowledge/archive-knowledge-source.ts` (new): resolves the source and its project, requires real membership, rejects (via `ValidationError`) if already `ARCHIVED`, sets `status: 'ARCHIVED'` via `update`, writes a `knowledge-source.archived` audit record.
- `apps/api/src/routes/knowledge-sources.ts`: new `PATCH /knowledge-sources/:knowledgeSourceId` and `POST /knowledge-sources/:knowledgeSourceId/archive` routes.
- `apps/api/src/dto/knowledge-source.ts`: new `parseUpdateKnowledgeSourceBody`.

## Out of scope

A draft/review/publish gate for edits (see the source backlog's §10, open decision 4 — resolved in favour of the simple two-state lifecycle since no spec requires review for knowledge edits). Deleting a knowledge source outright (archive is the real, reversible lifecycle action; hard delete is not scoped).

## Acceptance

Unit tests: updating name/content/sourceType persists and is audited; archiving flips status and is audited; archiving an already-archived source is rejected; a non-member is rejected for both. `retrieveActiveKnowledgeSources`'s existing `status === 'ACTIVE'` filter (unchanged) is confirmed to exclude an archived source via a `packages/knowledge` test. `pnpm --filter @devos/domain --filter @devos/database --filter @devos/application --filter @devos/knowledge --filter @devos/api typecheck test` green.
