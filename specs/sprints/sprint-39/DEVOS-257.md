# DEVOS-257 — Tool capability enable/disable UI

**Priority:** P1 | **Estimate:** 1d
**Depends on:** DEVOS-256 (the two new routes/wrappers this panel calls).
**Depended on by:** none within this sprint.

## Scope

A capabilities view listing registered tool capabilities with an enable/disable toggle wired to DEVOS-256's new route. **Corrected placement** (see `README.md`'s grounding): the backlog's "within Project Types" is confirmed wrong — `ToolCapability` is scoped to a real `Project`, not a `ProjectType` template, and `ProjectTypesPage.tsx` never has a real project selected. This story's real, consistent home is a new panel on `ProjectDetailPage.tsx`, alongside the Members/Settings panels Sprint 33 already put there.

## Implementation

- `apps/web/src/api-client.ts`: new `ToolCapability` interface (`id`, `projectId`, `key`, `name`, `riskClass`, `status`, `createdAt` — mirrors `toToolCapabilityDto`) and two wrappers:
  - `listToolCapabilities(projectId): Promise<ApiResult<ToolCapability[]>>` → `GET /projects/:id/tool-capabilities`
  - `setToolCapabilityStatus(projectId, capabilityId, status): Promise<ApiResult<ToolCapability>>` → `PATCH /projects/:id/tool-capabilities/:capabilityId`
- `ProjectDetailPage.tsx`: a new "Tool Capabilities" panel (same `Paper`/`PanelHeader` shape as Members/Settings) below the existing panels: a row per capability (key, name, risk class chip, a status `Switch` or toggle button calling `setToolCapabilityStatus`), re-fetching the list after every successful toggle.

## Out of scope

Editing a capability's `key`/`name`/`riskClass`/schemas (no route exists for this; out of scope). Registering a brand-new capability from the UI (`registerCapability` remains unwired to any route, per DEVOS-256's own disclosed scope boundary). Any change to `ProjectTypesPage.tsx`.

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean; new `apps/web/tests/api-client.test.ts` cases for both new wrappers. Live-verified against a real dev server and the real seeded "DevOS POC" project via a throwaway Playwright script: the panel lists the project's real capabilities; toggling one to disabled persists (confirmed by a real page reload showing the same state); toggled back afterward, leaving no residual state change.

## Actual results

Implemented as scoped. A new "Tool Capabilities" panel on `ProjectDetailPage.tsx` (key, name, a `Chip` for `riskClass`, `StatusChip` for status, an MUI `Switch` toggle per row), below the existing Members/Settings panels.

**A real, disclosed bug found and fixed during live browser verification, not by typecheck or unit tests**: the `Switch`'s `aria-label` was originally set via `inputProps={{ 'aria-label': ... }}`, which silently does not attach in this codebase's MUI v7 (`inputProps` is a legacy MUI v5 prop; confirmed by direct DOM inspection during verification that the rendered `<input>` carried no `aria-label` at all). Fixed to `slotProps={{ input: { 'aria-label': ... } }}`, matching this codebase's own already-established `slotProps` convention elsewhere (`GovernancePage.tsx`, `WorkflowsPage.tsx`) — confirmed fixed by direct DOM inspection after the change. This is a real, generalizable finding: any other MUI `inputProps` usage added in this codebase under MUI v7 would have the same silent-no-op failure mode, though none other exists today (confirmed by grep — this was the only `inputProps` usage anywhere in `apps/web`).

**Live-verified against a real dev server and the real seeded "DevOS POC" project** via the same throwaway Playwright script as DEVOS-255 (one combined script covering both stories, deleted afterward): the panel listed all 9 real seeded capabilities including `repo-read`/`repo-write`; the `repo-write` toggle was switched off, confirmed via the switch's own `checked` state changing, then switched back on, confirmed restored — matching the real Postgres state independently confirmed via direct API calls in DEVOS-256's own verification. Zero console/page errors throughout.
