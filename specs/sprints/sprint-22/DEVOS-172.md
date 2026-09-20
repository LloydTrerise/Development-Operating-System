# DEVOS-172 — Agent version-authoring primitive

**Priority:** P0 | **Estimate:** 2d
**Depends on:** none (extends the existing `AgentVersionRepository`/`AgentUseCaseDeps`).
**Depended on by:** DEVOS-173 (UI calls this), DEVOS-175 (pilot exercises this).

## Scope

A new `createNewAgentVersion` mirrors `createNewWorkflowVersion`'s (`packages/application/src/workflows/create-new-workflow-version.ts`, DEVOS-136) already-proven "revise by drafting a new version" pattern exactly: given an `Agent` whose latest version is `PUBLISHED`, drafts a new `DRAFT` version copying the latest's `configuration` verbatim as a real starting point to edit from.

## Implementation

- `packages/application/src/agents/create-new-agent-version.ts` (new): `createNewAgentVersion(deps, principalId, agentId): Promise<AgentVersion>`. Resolves `agent` → `project` → `resolveMembership` (any member, matching `createAgent`'s own membership-only gate — publish stays `OWNER`-gated, unchanged). Loads `deps.agentVersions.getLatestForAgent(agentId)`; if the latest version's `status === 'DRAFT'`, throws `ValidationError` ("already has an unpublished draft (version N); edit or publish it instead") — the identical rule `createNewWorkflowVersion` already enforces. Otherwise creates `{ ...same shape as AgentVersion, version: latest.version + 1, status: 'DRAFT', configuration: latest.configuration, createdBy: principalId }`, calls `deps.agentVersions.create(version)`, and writes an `agent_version.drafted` audit record (mirroring `workflow.version.drafted`'s exact shape).
- `apps/api/src/routes/agents.ts`: new `POST /agents/:agentId/versions` route calling `createNewAgentVersion`, returning `toAgentVersionDto(version)`.
- No change to `createAgent` (still creates only version 1) or `publishAgentVersion` (still the same single-step, `OWNER`-gated publish, now simply reusable against any drafted version, not only version 1).

## Out of scope

Any UI (DEVOS-173's job). Editing a draft's `configuration` after it's created (the draft is already a real, mutable-until-published row — confirm during implementation whether `AgentVersionRepository` needs an `update` method for the draft's `configuration`/`promptReference` fields, since today it has none; if absent, add the minimal method needed, scoped narrowly to updating only a `DRAFT` row's `configuration`/`promptReference`, disclosed here).

## Acceptance

Unit tests: a `PUBLISHED`-only agent gets a real new `DRAFT` v2 with configuration copied verbatim; an agent that already has a `DRAFT` version is rejected with the exact `ValidationError` message; a non-member is rejected with `NotFoundError`, matching every other project-scoped use case. `pnpm --filter @devos/application --filter @devos/api typecheck test` green; every existing `create-agent`/`publish-agent-version` test passes unmodified.
