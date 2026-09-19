# Sprint 19 — Agent Selection Foundations (E23 Cost Management, part 3)

**Source:** `specs/DEVOS-AGENT-SELECTION-BACKLOG.md` §6 "Sprint 19 — Agent Selection Foundations", grounded against direct inspection of the real, current implementation (`apps/worker/src/agent-task-router.ts`, `packages/contracts/src/workflows.ts`'s `WorkflowNode`, `packages/domain/src/workflows/validation.ts`, `packages/application/src/workflows/run-creation.ts`, `packages/contracts/src/agents.ts`'s `AgentConfiguration`).
**Conversion date:** 2026-09-19
**Status:** Approved to begin (user approval, 2026-09-19: "Yes, convert and start").

## Goal

`specs/DEVOS-COST-MANAGEMENT-BACKLOG.md` §6/§9 named "cost-aware agent selection" as unscoped because no real selection algorithm exists for a cost preference to attach to. This sprint builds that real precondition: a workflow node can target a role/capability requirement instead of a single literal agent, and a real, deterministic algorithm resolves that requirement against a project's real candidate agents at run time. No cost/quality preference is added — that remains a separate, still-unmet precondition (a real provider cost figure), out of this sprint's scope.

## Grounding (confirmed by direct code inspection before scoping)

- `routeAgentTask` (`apps/worker/src/agent-task-router.ts`) already resolves `task.input.agentRef` → `Agent` (`getByProjectAndKey`, a single-key exact lookup) → latest `PUBLISHED` `AgentVersion` → dispatches via `ROLE_HANDLERS[version.configuration.role]`. This is real, already-shipped role-based dispatch (commit `a0086e2`, closing `DEVOS-PRODUCTION-READINESS-ROADMAP.md` gap G1) — `DEVOS-COST-MANAGEMENT-BACKLOG.md`'s own description of this as "hardcoded seeded `agentRef`" routing is stale (see that document's own corrected §2/§9, updated 2026-09-19 alongside this conversion).
- `WorkflowNode` (`packages/contracts/src/workflows.ts`) has exactly one targeting field, `agentRef?: string`. `validateWorkflowDefinition` (`packages/domain/src/workflows/validation.ts:55-63`) requires it non-empty for every `AGENT_TASK` node.
- `AgentConfiguration.allowedCapabilities: string[]` (`packages/contracts/src/agents.ts`) already exists and is already enforced elsewhere (DEVOS-085's Tool Gateway capability check) — real, usable data the selection algorithm can read without any new schema.
- `run-creation.ts` (lines ~107-127) folds `node.agentRef` into each `WorkflowTask.input.agentRef` at run-start, the same reserved-key extensibility point `correlationId`/`dependsOn` already use — the established place to add a second, alternative reserved key pair (`requiredRole`/`requiredCapabilities`).
- No project in this codebase has ever had two `Agent` rows sharing one `role` — the seeded project has exactly one agent per role (six total, DEVOS-124/125's own evidence). DEVOS-161's pilot is the first time this is exercised for real.

## Real design decisions this sprint's own grounding surfaced (recorded here, not silently assumed)

1. **Additive targeting, not a replacement (DEVOS-158):** `agentRef` stays exactly as-is. `requiredRole`/`requiredCapabilities` are a second, optional path. Validation requires `AGENT_TASK` nodes to have one or the other (not both required) — a node with neither still fails, same as today.
2. **Deterministic tie-break (DEVOS-159):** `selectAgentForTask` filters candidates to `PUBLISHED` versions whose `role` matches and whose `allowedCapabilities` is a real superset of every required capability, then picks the lowest `Agent.key` ascending — a simple, disclosed, auditable rule, not a scoring system. `routeAgentTask` tries the existing literal-`agentRef` path first, unchanged; the new path only runs when `agentRef` is absent.
3. **Minimal inspector change (DEVOS-160):** reuses the existing `AGENT_TASK` inspector component with a second targeting mode, rather than a new page or a new node type.
4. **Real multi-candidate pilot (DEVOS-161):** a real project gains a second real agent sharing an existing role with different `allowedCapabilities`, proving the algorithm actually discriminates between real candidates, not just a single-candidate degenerate case.

## In scope (DEVOS-158–162, executed in ID order)

- **DEVOS-158** — Role/capability node targeting (contract + validation).
- **DEVOS-159** — Real capability-based selection algorithm.
- **DEVOS-160** — Designer support for capability-based nodes.
- **DEVOS-161** — Real end-to-end pilot: multi-candidate selection.
- **DEVOS-162** — Validation, documentation, and gap disclosure.

## Out of scope / deferred

Any cost, quality, latency, or budget-tier preference in selection (no real data exists yet). Tool-invocation cost tracking (the other, unrelated Sprint-19-named item from the cost-management backlog — still blocked on a real provider cost figure). Automatic load balancing, failover, or retry-with-a-different-agent on task failure. Any change to the Tool Gateway, credential broker, or identity/auth provider. A general-purpose weighted-scoring selection engine. Any part of E24–E27.

## Sprint-wide acceptance criteria (from the backlog's own exit criteria)

A real project with two real candidate agents for one role runs a real workflow that selects between them correctly, with zero behavior change for every workflow that still uses a literal `agentRef`.

## Governance

Per `AGENTS.md` §4: proceeding through DEVOS-158 one task at a time, per the user's standing approval to "convert and start" — stopping for approval at the end of each task unless the user grants a standing authorization to run the whole sprint end-to-end, the same choice offered on every prior sprint.

## Task index

| ID        | Story                                                  | File           |
| --------- | ------------------------------------------------------ | -------------- |
| DEVOS-158 | Role/capability node targeting (contract + validation) | `DEVOS-158.md` |
| DEVOS-159 | Real capability-based selection algorithm              | `DEVOS-159.md` |
| DEVOS-160 | Designer support for capability-based nodes            | `DEVOS-160.md` |
| DEVOS-161 | Real end-to-end pilot: multi-candidate selection       | `DEVOS-161.md` |
| DEVOS-162 | Validation, documentation, and gap disclosure          | `DEVOS-162.md` |
