# DEVOS-134 — Execution-path preview

**Priority:** P1 | **Estimate:** 2d
**Depends on:** None (independent of DEVOS-136's new draft-version primitive — can be built and validated standalone). Executed 2nd.

## Scope

Before publication, the designer shows the graph's real computed paths (Designer spec §29: happy path, failure paths, approval path, parallel paths) derived statically from the validated graph — explicitly not a simulation that claims to guarantee runtime success (Designer spec §30's own warning, honoured verbatim).

## Grounding

`packages/domain/src/workflows/validation.ts` does not traverse edges for ordering; `run-creation.ts` (`packages/application/src/workflows/`) does use a node's own incoming edges to compute its real `dependsOn` at run-start — so edges genuinely do carry real ordering meaning in this engine, just not one anything currently renders or previews. No topological-sort/path-enumeration logic exists anywhere in this codebase today (confirmed by a broad repo-wide grep) — this is new, but grounded logic, not fabricated: it mirrors the same edge-based ordering `run-creation.ts` already treats as real.

**Real, disclosed narrowing of the Designer spec's own "happy/failure/approval/parallel" taxonomy:** this engine has no concept of a "failure path" as a distinct graph shape (a `JOIN`'s `branchFailurePolicy` is a runtime behavior, not a separate edge/path) — labeling a computed path as "failure" would fabricate a classification the graph itself doesn't express. Paths are instead labeled structurally, from real graph facts only: which `CONDITION` branch (if any) they follow, whether they pass through a `PARALLEL`/`JOIN` pair, and whether they pass through an `APPROVAL` node — matching what the real graph structure can honestly support.

## Implementation

- New `packages/domain/src/workflows/compute-execution-paths.ts`: `computeExecutionPaths(graph: WorkflowDefinition): ExecutionPath[]` — a pure function (same "no I/O, safe for `apps/web` to import directly" pattern DEVOS-131 already proved works for `validateWorkflowGraph`). Finds root nodes (no incoming edge), depth-first traverses outgoing edges to terminal nodes (no outgoing edge), producing one path per distinct route — branching once per `CONDITION` node's own declared branches (a graph with a `PARALLEL` fan-out produces one path per branch that individually reaches a terminal node, each noting the `PARALLEL`/`JOIN` node ids it passed through).
- Each `ExecutionPath` carries: an ordered list of node ids; the `CONDITION` branch keys taken along the way (if any); whether it passes through an `APPROVAL` node; whether it passes through a `PARALLEL`/`JOIN` pair.
- `apps/web`: a new preview panel (shown before the real "Publish" action, DEVOS-136) lists each computed path as an ordered, human-readable sequence of node names — explicitly labeled "computed from the graph's structure, not a guarantee this exact sequence will occur at runtime" (Designer spec §30's warning, verbatim).

## Out of scope

Any change to the real runtime engine's own task-readiness/dependency logic (`packages/database/src/repositories/task-queue.ts`) — this is a pure, additional, read-only computation over an already-validated graph.

## Acceptance

A real graph with a `CONDITION` (two branches), a `PARALLEL`/`JOIN` pair, and an `APPROVAL` node produces the real, correct set of distinct computed paths (proven by a real unit test in `packages/domain`), each correctly labeled with the branch/approval/parallel facts it actually contains; the preview panel renders them with the required non-guarantee disclaimer.
