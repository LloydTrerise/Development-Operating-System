# DEVOS-244 — Agent marketplace API client

**Priority:** P0
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.9

## Acceptance summary

Adds `shareAgentVersion`/`listSharedAgentVersions`/`installAgentVersion` client wrappers against Sprint 23's existing, unchanged route contracts. Zero wrapper exists today (confirmed by grep — no `shareAgent|sharedAgents|installAgent` reference anywhere in `apps/web/src/api-client.ts`).

## Scope

- `apps/web/src/api-client.ts`:
  - Widen the existing `AgentVersion` interface with `sharedAcrossOrganisation: boolean` — already returned unconditionally by `toAgentVersionDto` (`version.sharedAcrossOrganisation ?? false`), simply untyped on the frontend until now.
  - New `SharedAgentVersion` interface extending `AgentVersion` with `agentKey: string`, `agentName: string`, `sourceProjectId: string` — mirroring `packages/domain/src/agents/agent-version.ts`'s real `SharedAgentVersion` exactly (no `sourceProjectName` field — see `README.md`'s own disclosed divergence from `SharedKnowledgeSource`).
  - `shareAgentVersion(agentId: string, version: number, shared: boolean): Promise<ApiResult<AgentVersion>>` against `POST /api/v1/agents/:agentId/versions/:version/share`, body `{ shared }`.
  - `listSharedAgentVersions(organisationId: string): Promise<ApiResult<SharedAgentVersion[]>>` against `GET /api/v1/organisations/:organisationId/shared-agents`.
  - `installAgentVersion(organisationId: string, agentVersionId: string, targetProjectId: string): Promise<ApiResult<Agent & { version: AgentVersion }>>` against `POST /api/v1/organisations/:organisationId/shared-agents/:agentVersionId/install`, body `{ targetProjectId }` — typed to match the real route response (`return { ...toAgentDto(agent), version: toAgentVersionDto(version) };`, confirmed by direct read of `apps/api/src/routes/agents.ts:146`).

## Out of scope

Any backend route or DTO change (no `sourceProjectName` added). An `unshareFromMarketplace`-style wrapper distinct from `shareAgentVersion(..., false)` (the same route handles both directions, matching `shareKnowledgeSource`'s own precedent).

## Validation

`pnpm --filter @devos/web typecheck lint build`; 3 new `apps/web/tests/api-client.test.ts` cases (one per new wrapper), mirroring DEVOS-240's own `listIntegrations`/`createIntegration` test pattern.
