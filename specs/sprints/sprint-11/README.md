# Sprint 11 — Engine Primitives (E20 Workflow Expansion, part 1)

**Source:** `specs/DEVOS-WORKFLOW-EXPANSION-AND-DESIGNER-BACKLOG.md` §6 "Sprint 11 — Engine Primitives", itself grounded against `Analysis/DevOS_05_Workflow_Engine_Specification_v1.0.docx` and direct inspection of the real, current implementation (that document's own §2 grounding table).
**Conversion date:** 2026-09-18
**Status:** Approved to begin (user: "start sprint 11").

## Goal

Every node type `@devos/contracts`' `workflowNodeTypes` already declares (`CONDITION`, `PARALLEL`, `JOIN`, `WAIT`, `APPROVAL`) is accepted by `validateWorkflowGraph` but has **no dispatcher handler** — placing one in a real graph today reaches `task-dispatcher.ts`'s `No handler registered for task type "..."` failure at run time (confirmed by reading `apps/worker/src/main.ts`'s three `registerHandler` calls and `task-dispatcher.ts`'s handler-map lookup before this sprint was scoped). This sprint makes all five real.

## Architecture

Every node in a graph already gets a `WorkflowTask` row created unconditionally at run-start (`run-creation.ts`), and `claimNext()` (`packages/database/src/repositories/task-queue.ts`) already enforces a real `dependsOn` barrier (Sprint 9 loose ends) so a task isn't claimable until every task its own incoming edges name has reached `SUCCEEDED`. This sprint's primitives are built as new task handlers on that same existing foundation — no new scheduler, no edge-traversal engine, no change to how tasks are created.

## In scope (DEVOS-119–123)

- `CONDITION` node execution: evaluates a real, deterministic rule against prior task output, run input ("workflow variable"), or a produced artifact's status, and determines which one of its outgoing edges is "taken."
- `PARALLEL`/`JOIN` node execution: makes every declared branch's first task concurrently eligible; a `JOIN` becomes eligible only once every named branch reaches a terminal state, with a configurable branch-failure policy.
- `WAIT` node execution: a time-based wait and a dependency-based wait, reusing the existing dispatcher polling model.
- `APPROVAL` as a first-class graph node: an `APPROVAL` node placed anywhere in a graph creates a real, policy-gated approval request through the existing DEVOS-110/111 atomic decision path, not only at the two hardcoded points the Software Change Workflow uses today.
- Generalizing `claimNext()`'s dependency barrier so a task depending on a `SKIPPED` (untaken-branch) or multi-branch `JOIN` upstream behaves correctly instead of waiting forever.

## Flagged gaps found while grounding this sprint (disclosed, not silently patched)

1. **`SKIPPED` is not an existing `WorkflowTaskStatus`.** The source backlog document (§6, DEVOS-119's acceptance summary) asserts `SKIPPED` is "already a declared `WorkflowTaskStatus`, currently unused by any real code path" — this is **false**, confirmed by reading `packages/contracts/src/status.ts` directly and grepping the entire repository for `SKIPPED` before writing this file: it appears nowhere outside the backlog document's own prose. `workflowTaskStatuses` is explicitly marked `PROVISIONAL` in source with no authoritative spec enumeration (`DEVOS-BUILD-STATE.md` verification-debt item 2) — DEVOS-119 adds `SKIPPED` to it as an additive, disclosed assumption under that same provisional banner, not a breaking contract change (the underlying `workflow_tasks.status` column is plain `text` with no database-level enum/CHECK constraint — confirmed by reading `packages/database/migrations/0008_workflow_tasks.ts`).
2. **No existing mechanism lets an edge declare which branch of a `CONDITION` it represents.** `WorkflowEdge` (`packages/contracts/src/workflows.ts`) is `{ from, to }` only. DEVOS-119 resolves this by adding an optional `WorkflowEdge.branch?: string` field (additive, matching the same "extend via an existing optional field" convention `WorkflowNode.agentRef`/`policyRefs`/`retryPolicy` already use) — a `CONDITION` node's own `config` names which branch key its rule produces, and only an edge whose `branch` matches that key is taken. An edge with no `branch` at all, or an edge from a non-`CONDITION` node, is completely unaffected by this change.

## Out of scope / deferred

Everything `specs/DEVOS-WORKFLOW-EXPANSION-AND-DESIGNER-BACKLOG.md` §10 already defers (`LOOP`, `SUBWORKFLOW`, `HUMAN_TASK`, `ARTIFACT`, `NOTIFICATION` node types; advanced loops; natural-language workflow generation; a visual designer — E21). Sprint 12 (the second real workflow type proving these primitives) and anything in E22–E27.

## Sprint-wide acceptance criteria

A hand-built test graph exercising `CONDITION` (both branches), `PARALLEL`/`JOIN` (including one deliberately-failing branch), `WAIT` (both variants), and an `APPROVAL` node placed somewhere other than the two existing hardcoded points all run to completion for real against Postgres.

## Governance

Per `AGENTS.md` §4: one task at a time (DEVOS-119 first), its own validation run and reported, then stop for explicit approval before DEVOS-120.

## Task index

| ID        | Story                                                   | File           |
| --------- | ------------------------------------------------------- | -------------- |
| DEVOS-119 | Real `CONDITION` node execution                         | `DEVOS-119.md` |
| DEVOS-120 | Real `PARALLEL`/`JOIN` node execution                   | `DEVOS-120.md` |
| DEVOS-121 | Real `WAIT` node execution                              | `DEVOS-121.md` |
| DEVOS-122 | Promote Approval to a first-class graph node            | `DEVOS-122.md` |
| DEVOS-123 | Generalize dependency-aware task readiness for branches | `DEVOS-123.md` |
