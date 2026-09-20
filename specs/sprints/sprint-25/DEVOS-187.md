# DEVOS-187 — Real query-scoped relevance retrieval

**Priority:** P1 | **Estimate:** 2.5d
**Depends on:** none.
**Depended on by:** DEVOS-190 (pilot exercises this).

## Scope

`buildContext()` ranks and bounds knowledge sources by real relevance to the current work item, instead of unconditionally including every `ACTIVE` source.

## Implementation

- `packages/domain/src/knowledge/knowledge-source.ts`: `KnowledgeSourceRepository` gains an optional `searchForProject?: (projectId: ProjectId, query: string) => Promise<KnowledgeSource[]>`, mirroring `AgentVersionRepository.setSharedAcrossOrganisation?`'s own optional-and-additive pattern.
- `packages/database/src/repositories/knowledge-sources.ts`: implements `searchForProject` with a real Postgres full-text query — `to_tsvector('english', name || ' ' || content) @@ plainto_tsquery('english', :query)`, ordered by `ts_rank(...)` descending, `LIMIT 50`, scoped to `project_id` and `status = 'ACTIVE'`. No new migration required (a functional expression, not a stored column); the query planner does a sequential scan at this table's real POC scale, which is acceptable and disclosed rather than adding a speculative index for a data volume that doesn't exist yet.
- `packages/knowledge/src/retrieval/deps.ts`: `RetrievalDeps` gains `workItems: WorkItemRepository` (structurally already satisfied by every real caller — `AgentTaskHandlerDeps` already has `workItems`, confirmed by direct inspection).
- `packages/knowledge/src/context/build-context.ts`: `ContextBuildInput` gains `workItemId?: WorkItemId`. When present, resolves the work item, builds a query string from `title` + `description`, and — only when `deps.knowledgeSources.searchForProject` exists and the query is non-empty — calls it instead of `retrieveActiveKnowledgeSources`'s existing unconditional `listForProject`. On zero matches, or when the optional method/work item is absent, falls back to today's exact unconditional-inclusion behaviour (Sprint 25 README's own recorded design decision).
- `packages/application/src/tasks/run-agent-task.ts`: passes `workItemId: workItem.id` into `buildContext()`'s input (the work item is already resolved at that point — zero new lookup).
- Honest labelling: any new UI/API surface referring to this calls it "keyword relevance," never "semantic" or "AI-ranked."

## Out of scope

Any embeddings/vector search (see Sprint 25 README's own design decision 1). A configurable query language.

## Acceptance

Unit tests: `retrieve-knowledge-sources.test.ts`/`build-context.test.ts` gain cases proving (a) a query-matching source is preferred/included when a non-matching one would otherwise be trimmed, (b) zero-match falls back to full inclusion, (c) every existing `build-context.test.ts`/`retrieval.test.ts` case (no `workItemId`, or a repository without `searchForProject`) passes unmodified — zero regression. `pnpm --filter @devos/domain --filter @devos/database --filter @devos/knowledge --filter @devos/application typecheck test` green.
