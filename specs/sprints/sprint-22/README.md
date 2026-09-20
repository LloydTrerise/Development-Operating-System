# Sprint 22 — Real Agent Authoring, Versioning & Quality Signal (E25 Agent Platform, part 1)

**Source:** `specs/DEVOS-AGENT-PLATFORM-BACKLOG.md` §6 "Sprint 22 — Real Agent Authoring, Versioning & Quality Signal", grounded against direct inspection of the real, current implementation (`packages/domain/src/agents/agent.ts`/`agent-version.ts`, `packages/application/src/agents/create-agent.ts`/`publish-agent-version.ts`, `apps/api/src/routes/agents.ts`, `run-development-agent-task.ts`'s `CODE_CHANGE` content, `run-review-agent-task.ts`'s `REVIEW_EVIDENCE` content, `packages/domain/src/agents/select-agent-for-task.ts`).
**Conversion date:** 2026-09-20
**Status:** Approved to begin (user authorization: "proceed", 2026-09-20, in response to `specs/DEVOS-AGENT-PLATFORM-BACKLOG.md`'s own §10 Open Decision — both recommended defaults there, the additive `sharedAcrossOrganisation` flag and a dedicated `AgentsPage.tsx`, are accepted as proposed).

## Goal

`specs/DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §10 named E25 with the one-line scope "Agent marketplace, output-quality evaluation, organisation-specific agent authoring beyond the template CRUD already built" but left it entirely unscoped. `specs/DEVOS-AGENT-PLATFORM-BACKLOG.md` found real per-project `Agent`/`AgentVersion` authoring exists but has no version-iteration primitive and no UI at all (only the _template_ side, `ProjectTypeAgent`, has full CRUD and a UI today), and that a real per-agent-version quality signal is buildable from data this codebase already captures (`CODE_CHANGE.metadata.agentVersionId` + `REVIEW_EVIDENCE.derivedFromArtifactId`), with zero new capture needed. This sprint closes both gaps; the organisation-scoped marketplace (the epic's third sub-theme) is deliberately deferred to Sprint 23, which depends on this sprint's own quality signal.

## Grounding (confirmed by direct code inspection before scoping)

- `AgentVersionRepository` (`packages/domain/src/agents/agent-version.ts`) has `getById`/`getByAgentAndVersion`/`getLatestForAgent`/`listForAgent`/`create`/`publish` — no method to draft a new version from an existing one. `createAgent` (`packages/application/src/agents/create-agent.ts`) only ever creates a fresh `Agent` plus its version 1.
- `publishAgentVersion` (`packages/application/src/agents/publish-agent-version.ts`) is a single-step, `OWNER`-gated publish (`canPublishAgent`, `packages/domain/src/projects/authorization.ts`) — reused unchanged by this sprint.
- No web UI exists anywhere for real per-project agents — `apps/web/src/pages` has no agent page; `ProjectTypeAgentsEditor.tsx` is the _template_ side only.
- `CODE_CHANGE` artifacts (`run-development-agent-task.ts`) already carry a real `agentVersionId` (the developer agent that wrote the change); `REVIEW_EVIDENCE` artifacts (`run-review-agent-task.ts`) already carry a real `derivedFromArtifactId` pointing at that same `CODE_CHANGE` — a real, already-captured one-hop link, confirmed by direct inspection (a correction to this backlog's own first-draft research, which had assumed this link didn't exist). Computing a per-agent-version pass/rework rate is a pure query over already-real data, the same shape as E24's own `DEVOS-168` (lead time).
- `selectAgentForTask` (`packages/domain/src/agents/select-agent-for-task.ts`, DEVOS-159) ties-breaks by ascending `agent.key` only — its own doc comment states no quality/cost preference exists because no such data exists yet. This sprint's own quality signal is a precondition for Sprint 23's own tie-break story, not touched here.

## Real design decisions this sprint's own grounding surfaced (recorded here, not silently assumed)

1. **`createNewAgentVersion` mirrors `createNewWorkflowVersion`/`createPolicy` exactly (DEVOS-172):** copies the latest `PUBLISHED` version's `configuration` as the new draft's starting point — the same, already twice-proven "revise by drafting a new version" pattern, not a new design.
2. **A dedicated `AgentsPage.tsx`, not a section on an existing page (DEVOS-173):** the first UI for real per-project agents; mirrors `CostPage.tsx`/`GovernancePage.tsx`'s own "dedicated page per concern" precedent, per the user's own accepted default.
3. **The quality signal is a pass/rework _rate_, not a score (DEVOS-174):** derived directly and only from `REVIEW_EVIDENCE.decision`, labelled honestly in the UI as "review pass rate" — never presented as a general-purpose quality score, matching this codebase's own "never fabricate data" discipline.

## In scope (DEVOS-172–176, executed in ID order)

- **DEVOS-172** — Agent version-authoring primitive.
- **DEVOS-173** — Real per-project agent management UI.
- **DEVOS-174** — Real per-agent-version quality signal.
- **DEVOS-175** — Real end-to-end pilot: two real published versions, two real outcomes.
- **DEVOS-176** — Validation, documentation, and gap disclosure.

## Out of scope / deferred

The organisation-scoped agent marketplace (share/install) and the quality-aware selection tie-break — both deferred to Sprint 23 (`specs/sprints/sprint-23/`), which depends on this sprint's own quality signal (DEVOS-174). The full `EvaluationPolicy`/`Evaluation` entity model from `Analysis/DevOS_06_Agent_Framework_Specification_v1.0.docx` §23/§24 — no policy engine for evaluation rules exists or is scoped anywhere in this epic. Any part of E26–E27.

## Sprint-wide acceptance criteria (from the backlog's own exit criteria)

A real agent has two real published versions with two real, independently-confirmed, distinct pass rates, visible in a real UI.

## Governance

Per `AGENTS.md` §4 and the user's approval ("proceed", 2026-09-20), this sprint proceeds task by task. The user has not given the same standing "run the whole epic end-to-end" authorization granted for E24 — Sprint 23 (the marketplace half) requires the user's own separate, explicit go-ahead after this sprint's own completion is reported, per `AGENTS.md` §4.2/§30.

## Task index

| ID        | Story                                              | File           |
| --------- | -------------------------------------------------- | -------------- |
| DEVOS-172 | Agent version-authoring primitive                  | `DEVOS-172.md` |
| DEVOS-173 | Real per-project agent management UI               | `DEVOS-173.md` |
| DEVOS-174 | Real per-agent-version quality signal              | `DEVOS-174.md` |
| DEVOS-175 | Real end-to-end pilot: two real published versions | `DEVOS-175.md` |
| DEVOS-176 | Validation, documentation, and gap disclosure      | `DEVOS-176.md` |
