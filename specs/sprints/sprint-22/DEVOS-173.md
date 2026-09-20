# DEVOS-173 — Real per-project agent management UI

**Priority:** P0 | **Estimate:** 3d
**Depends on:** DEVOS-172 (draft-new-version primitive).
**Depended on by:** DEVOS-175 (pilot exercises this).

## Scope

A new `AgentsPage.tsx` — the first web UI anywhere for real, non-template agents. Lists a project's real agents, shows each one's real version history, and supports creating a new agent, drafting a new version (DEVOS-172), and publishing.

## Implementation

- `apps/web/src/api-client.ts`: add `listAgents(projectId)` (already exists per `AgentExecutionSummary`-adjacent code — confirm and reuse if so), `createAgent(projectId, input)`, `createNewAgentVersion(agentId)`, `publishAgentVersion(agentId)`, `getAgent(agentId)` wrapper functions, matching the existing `ApiResult<T>` convention.
- `apps/web/src/pages/AgentsPage.tsx` (new): a project-scoped list of real agents (key, name, latest version + status), an expandable version history per agent, a "New agent" form (key/name/description/role/provider/modelRef/allowedCapabilities — mirroring `ProjectTypeAgentsEditor.tsx`'s own configuration-field set), a "Draft new version" action (calls DEVOS-172, shown only when the latest version is `PUBLISHED`), and a "Publish" action on a `DRAFT` version (reuses the existing, unchanged publish route).
- Route wiring into `apps/web/src/App.tsx`'s existing route table and nav (`/agents`), matching the existing page-registration pattern.

## Out of scope

Editing a draft's `configuration` inline beyond what DEVOS-172's own scope note covers. Any quality/pass-rate display (DEVOS-174's job — a later section on this same page).

## Acceptance

`pnpm --filter @devos/web typecheck build` green. A real running dev server (`apps/api` + `apps/web`) shows a real project's real agents, a real new agent creation, a real drafted v2, and a real publish — confirmed either via a real browser check or, if this session's own environment repeats a browser-rendering limitation already disclosed elsewhere in this codebase, via the same "typecheck/build clean, mirrors an already-proven pattern" fallback verification, disclosed identically if invoked.
