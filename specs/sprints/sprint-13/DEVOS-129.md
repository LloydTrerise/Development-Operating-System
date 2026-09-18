# DEVOS-129 — Component palette + node creation

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-128 (canvas foundation).

## Scope

A palette (Designer spec §7) covering exactly the now-real node types from E20 (`TRIGGER`, `TASK`, `AGENT_TASK`, `TOOL_TASK`, `APPROVAL`, `CONDITION`, `PARALLEL`, `JOIN`, `WAIT`, `END` — `@devos/contracts`' full `workflowNodeTypes`). Dragging a palette item onto the canvas creates a real node the existing `validateWorkflowGraph` already understands.

## Grounding

`workflowNodeTypes` (`packages/contracts/src/status.ts`) is the authoritative list — the palette must cover exactly these ten, not the Designer spec's own larger aspirational palette (`HUMAN_TASK`/`LOOP`/`SUBWORKFLOW`/`ARTIFACT`/`NOTIFICATION` remain absent from the contract, so they're absent from the palette too, per `README.md`'s "out of scope").

## Implementation

- A palette panel (sidebar or toolbar) listing all ten node types; dragging one onto the canvas creates a new `WorkflowNode` with a generated unique `id` (e.g. `${type.toLowerCase()}-${shortRandomSuffix}`, edited afterward via the inspector — DEVOS-130) and `type` set, with no `config` yet (the inspector fills in whatever that type requires).
- Connecting two nodes on the canvas (a real `@xyflow/react` edge-drag interaction) creates a real `WorkflowEdge` (`{ from, to }`); a `CONDITION` node's outgoing edges additionally get a `branch` field, set via the inspector once the node's own `config.rule.whenTrue`/`whenFalse` keys exist (DEVOS-130) — an edge with no branch is unaffected, matching every non-`CONDITION` edge already in the codebase.
- Duplicate node ids must be rejected client-side before they'd otherwise reach the server's own `validateWorkflowGraph` duplicate-id check (DEVOS-131 wires the shared real-time check this reuses).

## Out of scope

The properties inspector's own per-type config fields (DEVOS-130). Real-time validation feedback beyond duplicate-id prevention (DEVOS-131).

## Acceptance

Dragging each of the ten palette items onto a real canvas creates a node of that type; connecting two nodes creates a real edge; the resulting graph, saved through the existing `createProjectTypeWorkflow`/`updateProjectTypeWorkflow` API, is accepted by the real, unmodified `validateWorkflowGraph` for every node type that needs no further per-type config (`TRIGGER`/`TASK`/`AGENT_TASK` with an agentRef/`TOOL_TASK`/`PARALLEL`/`END`).
