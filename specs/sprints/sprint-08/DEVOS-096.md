# DEVOS-096 — Workflow configuration hardening

**Priority:** P0 | **Estimate:** 1d
**Depends on:** none within this sprint.

## Scope

"Versioning, validation and safe publication" (source, verbatim). `validateWorkflowGraph` (`packages/domain/src/workflows/validation.ts`) already checks node shape and that `edges` is an array — this task closes three real gaps found by inspection before writing this file.

## Grounding

Confirmed by reading `validateWorkflowGraph` directly: it never checks for (a) duplicate node ids, (b) an edge's `from`/`to` referencing a declared node id, or (c) an `AGENT_TASK` node carrying a non-empty `agentRef`. The third is the most consequential in practice: today a workflow with an `AGENT_TASK` node missing `agentRef` publishes successfully and only fails at run time (`run-agent-task.ts` throws `"Task ... has no agentRef configured"` after a real run has already started and a task has already been claimed).

## Flagged gap

`edges` are not currently traversed for execution ordering anywhere in this codebase (every node's task is created at run-start, independent of the others) — confirmed by grep before scoping this task. Edge validation here is therefore referential-integrity checking (a dangling edge is definitely a mistake), not execution-order enforcement, which this codebase does not implement and this task does not add.

## Acceptance

`validateWorkflowGraph` (and therefore `publishWorkflowVersion`) rejects: a graph with two nodes sharing the same id; an edge whose `from`/`to` does not match any declared node id; an `AGENT_TASK` node with no `agentRef` or an empty one. Each is covered by a unit test asserting the specific validation issue reported.
