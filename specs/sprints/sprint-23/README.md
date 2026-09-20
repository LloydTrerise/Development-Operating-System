# Sprint 23 — Organisation-Scoped Agent Marketplace & Quality-Aware Selection (E25 Agent Platform, part 2)

**Source:** `specs/DEVOS-AGENT-PLATFORM-BACKLOG.md` §6 "Sprint 23 — Organisation-Scoped Agent Marketplace & Quality-Aware Selection", grounded against direct inspection of the real, current implementation (`packages/database/migrations/0015_agents.ts` confirming no `organisation_id` column exists on any agent table, `packages/domain/src/agents/select-agent-for-task.ts`, `packages/database/src/repositories/agent-executions.ts`'s twice-proven organisation-scoped real-join precedent).
**Conversion date:** 2026-09-20
**Status:** Converted, but **not yet approved to begin**. The user's "proceed" (2026-09-20) approved `specs/DEVOS-AGENT-PLATFORM-BACKLOG.md`'s own scope and Sprint 22's execution; it did not grant the same standing "run the whole epic end-to-end" authorization given for E24 (Sprint 20/21). Per `specs/sprints/sprint-22/README.md`'s own governance note, this sprint requires the user's own separate, explicit go-ahead after Sprint 22's completion is reported.

## Goal

Sprint 22 built real agent authoring/versioning and a real per-agent-version quality signal. This sprint closes E25's remaining two sub-themes: a real, organisation-scoped agent marketplace (share/install, never cross-organisation) and a real quality-aware secondary tie-break in `selectAgentForTask`, built on top of Sprint 22's own new quality data.

## Grounding (confirmed by direct code inspection before scoping)

- No `agents`/`agent_versions`/`agent_executions` table carries an `organisation_id` column (`packages/database/migrations/0015_agents.ts`/`0016_agent_executions.ts`) — every agent is strictly project-scoped today; the only cross-project mechanism is the one-time `ProjectTypeAgent` → `Agent` clone at project creation (`packages/application/src/projects/create-project.ts`).
- The organisation-scoped real-join pattern is already proven twice (`listAuditRecordsForOrganisation` DEVOS-147, `sumEstimatedCostUsdForOrganisation`/`costBreakdownByRoleForOrganisation` DEVOS-150) — this sprint's own `GET /organisations/:id/shared-agents` query is a third instance, not a new one.
- `selectAgentForTask` (`packages/domain/src/agents/select-agent-for-task.ts`, DEVOS-159) currently ties-breaks by ascending `agent.key` only; its own doc comment states no quality/cost preference exists because no such data exists yet — Sprint 22's `DEVOS-174` closes exactly that precondition for a _quality_ preference (cost-aware selection remains separately, unrelatedly blocked on a real provider cost figure).

## Real design decisions this sprint's own grounding surfaced (recorded here, not silently assumed)

1. **An additive `sharedAcrossOrganisation: boolean` flag on `AgentVersion`, not a new table (DEVOS-177):** the user's own accepted default from `specs/DEVOS-AGENT-PLATFORM-BACKLOG.md` §10, mirroring `Project.budgetUsd`/`Organisation.budgetUsd`'s own additive-optional-field precedent exactly.
2. **Install is a one-time clone, never a live link (DEVOS-178):** mirrors the existing `ProjectTypeAgent` → `Agent` clone precedent exactly — a real, disclosed, deliberately simple choice, not a shared/linked reference with update propagation.
3. **The tie-break is one disclosed secondary sort key, not a scoring system (DEVOS-179):** mirrors `selectAgentForTask`'s own existing "simple, disclosed, deterministic" design principle — quality rate breaks ties among role/capability matches; the existing ascending-`agent.key` rule remains the final fallback, unchanged for every scenario with no quality data.

## In scope (DEVOS-177–181, executed in ID order)

- **DEVOS-177** — Real, organisation-scoped "share" primitive.
- **DEVOS-178** — Real "install into project" primitive.
- **DEVOS-179** — Quality-aware selection tie-break.
- **DEVOS-180** — Real end-to-end pilot: share, install, quality-aware dispatch.
- **DEVOS-181** — Validation, documentation, and gap disclosure.

## Out of scope / deferred

Any cross-organisation sharing (ADR-SEC-005, never violated). The full `EvaluationPolicy` model. Any payment/licensing concept. A general-purpose weighted-scoring selection engine. Any part of E26–E27.

## Sprint-wide acceptance criteria (from the backlog's own exit criteria)

A real agent genuinely moves from one project to another within the same organisation and runs successfully there; a real quality signal genuinely changes a real selection outcome for the first time in this codebase.

## Governance

Requires the user's own explicit, separate authorization to begin, per `AGENTS.md` §4.2/§30 and this sprint's own `Status` line above — not authorized by Sprint 22's "proceed."

## Task index

| ID        | Story                                                         | File           |
| --------- | ------------------------------------------------------------- | -------------- |
| DEVOS-177 | Real, organisation-scoped "share" primitive                   | `DEVOS-177.md` |
| DEVOS-178 | Real "install into project" primitive                         | `DEVOS-178.md` |
| DEVOS-179 | Quality-aware selection tie-break                             | `DEVOS-179.md` |
| DEVOS-180 | Real end-to-end pilot: share, install, quality-aware dispatch | `DEVOS-180.md` |
| DEVOS-181 | Validation, documentation, and gap disclosure                 | `DEVOS-181.md` |
