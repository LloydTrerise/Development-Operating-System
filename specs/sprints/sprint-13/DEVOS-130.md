# DEVOS-130 — Properties inspector

**Priority:** P1 | **Estimate:** 2d
**Depends on:** DEVOS-128 (canvas), DEVOS-129 (node creation).

## Scope

A contextual per-node-type inspector (Designer spec §10–§14) replacing the current table row's inline-only fields — closing this sprint's own most substantive real gap (`README.md`'s grounding: today's editor has **no UI for any node's `config` at all**).

## Real per-node-type field shapes (grounded in the real handlers/validation, not invented)

- **`AGENT_TASK`**: `agentRef` — a dropdown populated from the real `listProjectTypeAgents(projectTypeId)` result (already real today, per `README.md`'s grounding; just needs to move into the inspector unchanged).
- **`TOOL_TASK`**: `id` only — a dropdown of the known recognized taskKeys `apps/worker/src/tool-task-router.ts` already handles (`validation`/`security-scan`/`release-readiness-check`/`release`/`rollback`/`closure`/`diagnose`/`notify`/`log-only`), plus free text for an id the author intends a future handler to recognize. No capability selection (`README.md`'s flagged decision 2 — no such concept exists at the `ProjectType`-template level).
- **`CONDITION`**: `config.rule` — a form for one of the three real `ConditionRule` shapes (`run-condition-task.ts`): `source: 'task' | 'variable' | 'artifact'`, its corresponding `taskKey`/`path` field, `operator: 'equals' | 'notEquals' | 'exists'`, an optional `value`; plus `whenTrue`/`whenFalse` branch-key text fields, which then populate the `branch` dropdown DEVOS-129's edge-creation UI offers for this node's own outgoing edges.
- **`JOIN`**: `config.branchFailurePolicy` — a `strict` (default) / `tolerant` select, matching `validateWorkflowGraph`'s own accepted values exactly.
- **`WAIT`**: `config.waitType` — a `duration` (`durationSeconds`, a positive-number field) / `dependency` (`taskKey`, a dropdown of other node ids in the same graph; optional `pollIntervalSeconds`) toggle, matching `run-wait-task.ts`'s real two variants.
- **`APPROVAL`**: `config.approvalType` (optional text) and `config.pollIntervalSeconds` (optional positive number), matching `run-approval-task.ts`'s real config shape.
- **`TRIGGER`/`TASK`/`PARALLEL`/`END`**: name only — no real `config` shape exists for any of these today.

## Out of scope

Any config field `validateWorkflowGraph`/the real task handlers don't actually check or read — inventing a richer shape than the engine understands would mislead an author into configuring something the engine ignores.

## Acceptance

Selecting any node on the canvas shows the correct per-type fields above; editing them updates that node's real `config`/`agentRef` in the draft graph; a `CONDITION` node's `whenTrue`/`whenFalse` values are genuinely selectable as an outgoing edge's `branch` (DEVOS-129), completing the one visual gap `README.md`'s grounding identifies as this sprint's real substance, not just its drag-and-drop surface.
