# DEVOS-119 — Real `CONDITION` node execution

**Priority:** P0 | **Estimate:** 3d
**Depends on:** None (Sprint 10 complete).

## Scope

A `CONDITION` node in a workflow graph evaluates a real, deterministic rule and marks exactly one outgoing edge's target eligible; the untaken branch's own task reaches a new terminal `SKIPPED` status instead of being claimed and failing with "No handler registered for task type."

## Grounding (confirmed by direct code inspection before scoping)

- `apps/worker/src/main.ts` registers real handlers for exactly `TASK`, `AGENT_TASK`, `TOOL_TASK`. A `CONDITION` task reaches `task-dispatcher.ts`'s `No handler registered for task type "CONDITION"` failure today — confirmed by reading every `registerHandler` call site.
- Every node in a published graph already gets a `WorkflowTask` row at run-start regardless of type (`run-creation.ts`), keyed by `taskKey = node.id`.
- `claimNext()` (`packages/database/src/repositories/task-queue.ts`) already enforces a real `dependsOn` barrier — a task isn't claimable until every task named in its own `input.dependsOn` (computed from the graph's declared incoming edges) has reached `SUCCEEDED`.
- `WorkflowNode.config?: Record<string, unknown>` (`packages/contracts/src/workflows.ts`) is the existing generic per-node extension point (the same one `agentRef` uses for `AGENT_TASK`) — this is where a `CONDITION` node's rule lives.

## Flagged assumptions (see `README.md`'s "Flagged gaps" for full context)

1. `SKIPPED` is added to `workflowTaskStatuses` (`packages/contracts/src/status.ts`) — not previously present anywhere in the codebase despite the source backlog document's incorrect claim otherwise. Additive to an already-`PROVISIONAL` enum; the `workflow_tasks.status` column is plain `text`, so this needs no migration.
2. `WorkflowEdge` gains an optional `branch?: string` field (`packages/contracts/src/workflows.ts`). A `CONDITION` node's `config.rule` (below) evaluates to a branch key; only the outgoing edge whose `branch` equals that key is taken. An edge with no `branch` is unaffected (every existing workflow graph in the codebase has none, so this is a pure addition with zero effect on any already-published version).
3. **Rule shape** (a new assumption this task itself introduces, since no spec defines one): a `CONDITION` node's `config.rule` is one of:
   - `{ source: 'task', taskKey: string, field: string, operator: 'equals' | 'notEquals' | 'exists', value?: unknown }` — reads a named field out of a named prior task's own `output` (Designer spec §15's "task result").
   - `{ source: 'variable', path: string, operator: ..., value?: unknown }` — reads a dot-path out of the workflow run's own `input` (Designer spec §15's "workflow variable").
   - `{ source: 'artifact', taskKey: string, operator: ..., value?: unknown }` — reads the `status` of the latest artifact version produced by a named prior task (Designer spec §15's "artifact status"), via the same `artifacts`/`artifactVersions` lookup pattern `collectRunArtifactVersionIds` (`task-queue.ts`) already uses.
     Each rule also names `whenTrue`/`whenFalse` branch keys (or a `cases` map for a >2-way condition) — the handler's own output is `{ branch: <key> }`, and `run-creation.ts`'s existing `dependsOn` edge-filtering plus this task's edge `branch` tagging determines which single downstream task actually becomes eligible.

## Design decision needing no further approval (mechanical, reversible, additive-only)

The untaken branch's own immediate target task is marked `SKIPPED` by the `CONDITION` handler's own completion path (not by `claimNext()` — a `SKIPPED` task never needs to be claimed at all). Whether a task two hops downstream of the untaken branch also cascades to `SKIPPED` is explicitly **DEVOS-123's** scope, not this task's — `claimNext()`'s dependency barrier still only checks for `SUCCEEDED` upstream after this task, so such a downstream task would currently wait forever until DEVOS-123 lands. This mirrors the same task-boundary the source backlog document itself draws (DEVOS-119 vs. DEVOS-123).

## Out of scope

`PARALLEL`/`JOIN`/`WAIT`/`APPROVAL`-as-node (DEVOS-120–122). Multi-hop `SKIPPED` propagation (DEVOS-123). A visual way to author a `CONDITION` node's rule (E21).

## Acceptance

- A real graph with a `CONDITION` node and two outgoing edges (`branch: 'true'` / `branch: 'false'`) run to completion for real against Postgres, once per branch: the taken branch's task actually runs and succeeds; the untaken branch's task reaches `SKIPPED` and the run still completes (not blocked waiting on it).
- All three rule `source` variants (`task`/`variable`/`artifact`) are exercised by a real unit test each.
- `maybeCompleteRun`'s "every task must be `SUCCEEDED`" check (`task-queue.ts`) is updated so a run with only `SUCCEEDED`/`SKIPPED` tasks (no `PENDING`/`FAILED`/`RUNNING`) still completes.
- `validateWorkflowGraph` accepts a `CONDITION` node's `config.rule` and an edge's `branch` field without new errors on every existing graph in the codebase (zero pre-existing test breaks).
