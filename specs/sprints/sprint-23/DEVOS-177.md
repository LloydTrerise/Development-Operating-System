# DEVOS-177 — Real, organisation-scoped "share" primitive

**Priority:** P0 | **Estimate:** 2d
**Depends on:** none (additive field on the existing `AgentVersion`).
**Depended on by:** DEVOS-178 (install reads this), DEVOS-180 (pilot exercises this).

## Scope

`AgentVersion` gains an additive `sharedAcrossOrganisation: boolean` (default `false`), settable only on a `PUBLISHED` version by a project `OWNER`.

## Implementation

- New migration: `agent_versions` gains `shared_across_organisation boolean not null default false`.
- `packages/domain/src/agents/agent-version.ts`: `AgentVersion` gains `sharedAcrossOrganisation: boolean`; `AgentVersionRepository` gains `setSharedAcrossOrganisation?(id, shared: boolean): Promise<void>`.
- `packages/application/src/agents/share-agent-version.ts` (new): resolves the version, requires `status === 'PUBLISHED'` (a `ValidationError` otherwise — sharing a draft makes no sense, mirroring `requireDraftAgentVersion`'s own inverse check), requires `canPublishAgent(membership.role)` (`OWNER`, same gate as publish itself), calls `setSharedAcrossOrganisation`, writes an `agent_version.shared`/`agent_version.unshared` audit record.
- `apps/api/src/routes/agents.ts`: new `POST /agents/:agentId/versions/:version/share` route (body: `{ shared: boolean }`).

## Out of scope

Any cross-organisation visibility (out of scope entirely — ADR-SEC-005). The install side (DEVOS-178's job).

## Acceptance

Unit tests: sharing a `DRAFT` version is rejected; a non-`OWNER` sharing attempt is rejected; a real `PUBLISHED` version's `sharedAcrossOrganisation` flips correctly and is audited. `pnpm --filter @devos/domain --filter @devos/database --filter @devos/application --filter @devos/api typecheck test` green.
