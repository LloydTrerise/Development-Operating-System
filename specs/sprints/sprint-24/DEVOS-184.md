# DEVOS-184 — Real usage traceability: wire `KnowledgeReference` into `buildContext()`

**Priority:** P1 | **Estimate:** 2d
**Depends on:** none (additive to the existing `run-agent-task.ts` call site).
**Depended on by:** DEVOS-185 (pilot confirms a real row is written).

## Scope

Every `KNOWLEDGE_SOURCE`-type source `buildContext()` actually includes in an assembled context is durably recorded as a real `KnowledgeReference` row, closing the gap between `software-change-workflow.md` §28's "traceable" claim and the current, silent no-op.

## Implementation

- `packages/domain/src/knowledge/knowledge-reference.ts`: `KnowledgeReferenceRepository` gains `listForSource: (knowledgeSourceId: KnowledgeSourceId) => Promise<KnowledgeReference[]>`, the read-side mirror of the existing `listForTask`.
- `packages/database/src/repositories/knowledge-references.ts`: implements `listForSource` with a plain `where('knowledge_source_id', '=', ...)` query, mirroring `listForTask`'s own shape.
- `packages/application/src/tasks/deps.ts`: `AgentTaskHandlerDeps` gains `knowledgeReferences?: KnowledgeReferenceRepository` — optional and additive, mirroring `auditRecords?`/`organisations?`'s established pattern so every existing test fake for this interface stays valid unchanged.
- `packages/application/src/tasks/run-agent-task.ts`: immediately after `buildContext()` returns (line ~317–320), when `deps.knowledgeReferences` is present, writes one real `KnowledgeReference` row for every `assembledContext.sources` entry whose `type === 'KNOWLEDGE_SOURCE'` (the `ref` field is `knowledge-source:<id>`, parsed back to the real id), keyed to `task.id`/`execution.id`. Zero change to `buildContext()` itself or to the manifest's own existing source list.
- `packages/application/src/knowledge/get-knowledge-source-references.ts` (new): resolves the source and its project, requires real membership, returns `deps.knowledgeReferences.listForSource(id)` (empty array if the optional dependency is absent, matching `getAgentQuality`'s own no-op-when-absent convention).
- `apps/api/src/routes/knowledge-sources.ts`: new `GET /knowledge-sources/:knowledgeSourceId/references` route.
- `apps/worker/src/main.ts` (or wherever `AgentTaskHandlerDeps` is really composed for the worker process): supplies the real `knowledgeReferences` repository, the same way every other optional-and-additive dependency in this file is wired once a real consumer needs it.

## Out of scope

Widening this to `PROJECT_CONTEXT`/`ARTIFACT` source types (see Sprint 24 README's own recorded design decision). Any UI beyond DEVOS-183's own reference-count/list rendering.

## Acceptance

Unit tests: `run-agent-task.ts`'s own existing test suite (`run-agent-task.test.ts`) gains a case proving a real `KnowledgeReference` is created for each knowledge source actually included, and that omitting `deps.knowledgeReferences` changes nothing (today's exact existing behaviour, unchanged). `pnpm --filter @devos/domain --filter @devos/database --filter @devos/application --filter @devos/api --filter @devos/worker typecheck test` green.
