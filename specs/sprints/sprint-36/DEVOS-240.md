# DEVOS-240 — Integrations API client

**Priority:** P0
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.8

## Acceptance summary

Adds `listIntegrations`/`createIntegration` client wrappers against DEVOS-194's existing, unchanged route contracts. Zero wrapper exists today (confirmed by grep — no `Integration` reference anywhere in `apps/web/src/api-client.ts`).

## Scope

- `apps/web/src/api-client.ts`:
  - New `Integration` interface, mirroring `toIntegrationDto` (`apps/api/src/dto/integration.ts`) exactly: `id`, `projectId`, `type: string`, `provider: string`, `name: string`, `status: string`, `credentialReference: string`, `configuration: Record<string, unknown>`, `createdAt: string`, `updatedAt: string`.
  - `listIntegrations(projectId: string): Promise<ApiResult<Integration[]>>` against `GET /api/v1/projects/:projectId/integrations`.
  - `createIntegration(projectId: string, input: { type: string; provider: string; name: string; credentialReference: string; configuration?: Record<string, unknown> }): Promise<ApiResult<Integration>>` against `POST /api/v1/projects/:projectId/integrations` — typed to return `Integration` only, matching the real route response (confirmed by direct read of `apps/api/src/routes/integrations.ts`: `return toIntegrationDto(integration);`).

## Out of scope

Any backend route or DTO change. A `getIntegration`/`getIntegrationForPrincipal` wrapper (no route exists — see `README.md`'s own grounding). An update/disable/delete wrapper (no route exists).

## Validation

`pnpm --filter @devos/web typecheck lint build`; 2 new `apps/web/tests/api-client.test.ts` cases (one per new wrapper), mirroring DEVOS-234's own `createArtifact`/`listArtifactVersions` test pattern.
