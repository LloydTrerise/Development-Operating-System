# DEVOS-247 — Wire the already-written but never-called client functions

**Priority:** P0
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.10

## Acceptance summary

`listSharedKnowledgeSources`/`installKnowledgeSource` already exist in `api-client.ts` with zero call sites. This story is UI-only, no new client code needed — confirmed by grep (no `listSharedKnowledgeSources|installKnowledgeSource` reference anywhere under `apps/web/src/features/knowledge/`).

## Scope

- No changes to `apps/web/src/api-client.ts`. Confirm (not re-implement) that the existing wrappers are correctly typed against their real routes:
  - `listSharedKnowledgeSources(organisationId: string): Promise<ApiResult<SharedKnowledgeSource[]>>` against `GET /api/v1/organisations/:organisationId/shared-knowledge-sources` — matches `listSharedKnowledgeSourcesForOrganisation`'s real return shape (`toSharedKnowledgeSourceDto`, includes `sourceProjectId`/`sourceProjectName`).
  - `installKnowledgeSource(organisationId: string, knowledgeSourceId: string, targetProjectId: string): Promise<ApiResult<KnowledgeSource>>` against `POST /api/v1/organisations/:organisationId/shared-knowledge-sources/:knowledgeSourceId/install`, body `{ targetProjectId }` — matches the route's real response (`toKnowledgeSourceDto(source)`, a plain installed `KnowledgeSource`, no version wrapper unlike `installAgentVersion`'s response shape).
- The actual wiring (calling these from a real component) is DEVOS-248's scope.

## Out of scope

Any backend route or DTO change. Any change to the wrapper signatures or the `SharedKnowledgeSource`/`KnowledgeSource` frontend types (both already correct).

## Validation

`pnpm --filter @devos/web typecheck` (confirms the existing types still compile as-is); no behavioural change to verify on its own — DEVOS-248/249 cover the real, wired behaviour.
