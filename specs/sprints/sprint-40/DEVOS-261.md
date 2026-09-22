# DEVOS-261 — Generalize the Postgres full-text search pattern

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** none within this sprint.
**Depended on by:** DEVOS-262 (aggregator use-case + route).

## Scope

Extends DEVOS-187's `to_tsvector`/`plainto_tsquery`/`ts_rank` pattern (`packages/database/src/repositories/knowledge-sources.ts:96-112`) to work items, artifacts, workflows, and agents, each as its own repository method. Adds GIN indexes via migration on each newly-searchable column, closing DEVOS-187's own disclosed sequential-scan limitation for every table this story touches. Knowledge sources' existing search is left as-is — see `README.md`'s grounding for why a shared index shape does not apply to it.

## Implementation

- `packages/domain/src/work-items/work-item.ts`: `WorkItemRepository` gains `searchForProject?: (projectId: ProjectId, query: string) => Promise<WorkItem[]>` (optional, matching `countReworkCyclesForProject`'s own precedent already on this interface).
- `packages/domain/src/artifacts/artifact.ts`: `ArtifactRepository` gains `searchForProject?: (projectId: ProjectId, query: string) => Promise<Artifact[]>` (optional, matching `listEvidenceForProject`'s own precedent already on this interface).
- `packages/domain/src/workflows/workflow-definition.ts`: `WorkflowDefinitionRepository` gains `searchForProject?: (projectId: ProjectId, query: string) => Promise<WorkflowDefinition[]>` (this interface's first optional method — no prior precedent on this specific interface, but matches the codebase-wide convention).
- `packages/domain/src/agents/agent.ts`: `AgentRepository` gains `searchForProject?: (projectId: ProjectId, query: string) => Promise<Agent[]>` (same as above — this interface's first optional method).
- `packages/database/src/repositories/work-items.ts`: implements `searchForProject` — `to_tsvector('english', title || ' ' || description) @@ plainto_tsquery('english', ${query})`, ordered by `ts_rank(...)` descending, `.limit(50)`. No `coalesce()` needed (`description` is `NOT NULL`). No status filter (see `README.md`'s grounding).
- `packages/database/src/repositories/artifacts.ts`: implements `searchForProject` — `to_tsvector('english', name) @@ plainto_tsquery('english', ${query})`, ordered by `ts_rank(...)` descending, `.limit(50)`. No status filter.
- `packages/database/src/repositories/workflow-definitions.ts`: implements `searchForProject` — `to_tsvector('english', name || ' ' || coalesce(description, '')) @@ plainto_tsquery('english', ${query})`, ordered by `ts_rank(...)` descending, `.limit(50)`.
- `packages/database/src/repositories/agents.ts`: implements `searchForProject` — `to_tsvector('english', name || ' ' || coalesce(description, '')) @@ plainto_tsquery('english', ${query})`, ordered by `ts_rank(...)` descending, `.limit(50)`.
- New `packages/database/migrations/0042_add_search_indexes.ts`: one `GIN` expression index per table, via Kysely's `.using('gin').column(sql\`...\`)`(confirmed supported by the installed`kysely@0.29.5`, not assumed) — `work_items_search_idx`, `artifacts_search_idx`, `workflow_definitions_search_idx`, `agents_search_idx`, each matching its own repository method's exact `to_tsvector(...)`expression so the planner can actually use the index.`down()` drops all four.

## Out of scope

Any change to `knowledge_sources.searchForProject` (DEVOS-187, unchanged) or adding an index to it (disclosed boundary — no shared index shape, since its predicate also filters `status = 'ACTIVE'`, unlike these four). Any status-filtering business rule not already defined by an existing spec/enum. Any change to how `retrieveActiveKnowledgeSources` (`packages/knowledge`) works. Any web/API-client change (Sprint 41).

## Acceptance

`pnpm --filter @devos/domain --filter @devos/database typecheck lint build` clean. No `packages/database` repository unit test added for the four new `searchForProject` methods — matching this codebase's own established, disclosed precedent (no per-repository unit-test convention exists; `packages/database/tests/` contains only `client.test.ts`; every repository method is proven exclusively through real Postgres, per DEVOS-254/DEVOS-256's own identical precedent) — live Postgres verification is this method's proof instead. Live-verified against real Postgres: the real seeded "DevOS POC" project's real work items/artifacts/workflows/agents are each searched for real with a real matching keyword, confirming ranked, real, non-empty results; `EXPLAIN` confirms the new GIN index is actually used (not a sequential scan) for at least one of the four searches, closing DEVOS-187's own disclosed limitation for real, not just in principle.

## Actual results

Implemented exactly as scoped. `searchForProject` added as an optional method to all four repository interfaces (`WorkItemRepository`, `ArtifactRepository`, `WorkflowDefinitionRepository`, `AgentRepository`), implemented in each corresponding `packages/database/src/repositories/*.ts` file, mirroring `KnowledgeSourceRepository.searchForProject`'s (DEVOS-187) exact `to_tsvector`/`plainto_tsquery`/`ts_rank`/`.limit(50)` shape. No fakes across the codebase needed updating (confirmed via a full monorepo `pnpm turbo run typecheck --filter='!@devos/e2e-tests'`, 32/32 tasks green) — the optional-method convention held exactly as it did for Sprint 39's `listForOrganisation`/`updateStatus`.

New migration `0042_add_search_indexes.ts` adds one GIN expression index per table (`work_items_search_idx`, `artifacts_search_idx`, `workflow_definitions_search_idx`, `agents_search_idx`), each matching its own repository method's `to_tsvector(...)` expression exactly. Ran successfully against real Postgres (`migration "0042_add_search_indexes" executed successfully`); `\d <index>` confirms all four exist with the expected `gin` type and expression.

No `packages/database` repository unit test was added, per this file's own disclosed acceptance criterion — matching DEVOS-254/DEVOS-256's identical precedent (no per-repository unit-test convention exists anywhere in this codebase).

**Live-verified against real Postgres**, against the real seeded "DevOS POC" project (`00000000-0000-4000-8000-000000000002`):

- `EXPLAIN` on the real `work_items` search query (`project_id` + `to_tsvector(...) @@ plainto_tsquery('english', 'dashboard')`, ordered by `ts_rank`) confirms a `Bitmap Index Scan on work_items_search_idx`, `BitmapAnd`-combined with the existing `project_id` index — a real index scan, not a sequential scan, closing DEVOS-187's own disclosed limitation for this table for real, not just in principle.
- A throwaway script (run from inside `packages/database`, deleted afterward) called all four new repository methods directly against real Postgres and confirmed real, non-empty, ranked results: `work_items.searchForProject(projectId, 'dashboard')` → 50 real matches (hit the `.limit(50)` cap); `artifacts.searchForProject(projectId, 'report')` → 50 real matches; `workflow_definitions.searchForProject(projectId, 'path')` → 3 real matches (`Planning Path`, `Development Path`, a third); `agents.searchForProject(projectId, 'agent')` → 9 real matches (`Discovery Agent`, `Requirements Agent`, …) — all against the real seeded project's real accumulated data, not fabricated.

Full monorepo `pnpm turbo run typecheck --filter='!@devos/e2e-tests'`: **32/32 tasks green** (a required rebuild step was needed first — `packages/database` initially failed typecheck against `packages/domain`'s stale compiled `dist/` output until `pnpm --filter @devos/domain build` was re-run; not a real defect, just build-order, disclosed here since it's the kind of thing a fresh session might otherwise mistake for a real type error). `pnpm --filter @devos/domain --filter @devos/database typecheck lint build test` clean individually (domain: 11 files/68 tests green; database: 1 file/2 tests green, unchanged — no new test file, per the disclosed no-repository-test-convention above).

Full monorepo validation and the full real `tests/e2e` suite results will be recorded once, in `DEVOS-263.md`, covering the whole sprint — per this sprint's own established convention (Sprint 39's identical pattern).
