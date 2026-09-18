# DEVOS-137 — Real end-to-end pilot: author, publish, run

**Priority:** P0 | **Estimate:** 1d
**Depends on:** DEVOS-133–136 (needs the full designer stack: canvas, per-project editing, validation, path preview).

## Scope

A brand-new workflow is authored entirely through the visual designer (not cloned from a seeded template), published as a real immutable version, and run to completion for real — live-verified, mirroring this codebase's own established pilot-verification convention (DEVOS-100/108/E19/DEVOS-126).

## Real scoping decision (grounded, not arbitrary)

The pilot graph uses only node types a real, already-running `apps/worker` process can dispatch **without any new registration**: `CONDITION`, `PARALLEL`, `JOIN`, `WAIT`, `APPROVAL`, and the plain `TASK` type (the deterministic, unconditionally-registered stub, `runDiscoveryTask`) — deliberately not `AGENT_TASK` (needs a real `GEMINI_API_KEY` or fixture-mode configuration, an orthogonal concern to proving the designer→runtime loop) and not a `TOOL_TASK` with an invented `id` (no handler would exist for a brand-new taskKey the worker's router doesn't recognize — reusing one of the real recognized keys, e.g. `closure`, would pull in unrelated preconditions like a real work item's closure evidence). This proves the exact same thing DEVOS-126's own Incident Response pilot proved for a second _seeded_ workflow shape — here for a truly _author-created, never-seeded_ one.

## Real verification method (mirroring DEVOS-132's own precedent)

"Authored entirely through the visual designer" is verified the same way DEVOS-132 verified real save wiring: driving the real HTTP API with the exact contract the canvas's own actions use (`createWorkflowDefinition` → `updateDraftWorkflow` → `validateDraftWorkflow` → `publishWorkflowVersion`, DEVOS-136), against a real running `apps/api` and real Postgres — not literally simulating mouse drag/drop events, disclosed honestly rather than overclaiming a browser-automated proof this task's own tooling doesn't have.

## Implementation / verification steps

1. `createWorkflowDefinition` (real API call) creates a brand-new, never-seeded `WorkflowDefinition` + version-1 `DRAFT`, with an empty/minimal starting graph (mirroring what a real author sees on a blank canvas).
2. `updateDraftWorkflow` (real API call) saves the real graph an author would have built via palette + inspector: `route` (`CONDITION`) → `fanout` (`PARALLEL`) → two branches → `join` (`JOIN`, tolerant) → `wait` (`WAIT`, duration) → `gate` (`APPROVAL`) → `final` (`TASK`).
3. `validateDraftWorkflow` (real API call) confirms zero issues — the same real `validateWorkflowGraph` DEVOS-131's client-side check already mirrors.
4. `publishWorkflowVersion` (real API call) produces a real, immutable published version.
5. A real run is started against it (the existing, unmodified run-start API) and a real `apps/worker` process (already running, no special configuration) drives it to `COMPLETED`, including deciding the real `APPROVAL` request created mid-graph through the existing, unchanged DEVOS-110/111 decision path.

## Out of scope

Any new engine capability — this task proves the existing, real designer + engine work together end to end; it introduces nothing new to either.

## Acceptance

Steps 1–5 above all succeed for real against real Postgres and a real running worker process; the published version's `definition` matches what was authored; the run reaches `COMPLETED` with every task `SUCCEEDED` (or `SKIPPED` on the untaken `CONDITION` branch), confirmed by a real query against real Postgres — closing this sprint's own, and the whole Workflow Designer epic's, exit criterion: a user can go from a blank canvas to a real, running workflow without ever touching a database seed script, a raw JSON body, or a developer.
