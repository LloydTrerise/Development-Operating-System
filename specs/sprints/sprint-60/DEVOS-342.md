# DEVOS-342 — Guided mandatory-setup checklist

**Priority:** P1
**Depends on:** Sprint 58 (`GET /organisations/:organisationId/initialisation-status`, DEVOS-334) — read-only, unchanged. DEVOS-341 (auto-opens for a just-created organisation).
**Depended on by:** DEVOS-343 (the pilot completes these same three requirements through this same checklist's own links).

## Scope

Surface Sprint 58/DEVOS-333/334's three requirements (`hasProjectType`/`hasLlmProvider`/`hasPolicy`) as an explicit, required, real-time checklist — not an optional aside — each item linking to its real, already-existing creation surface. No new requirement, no new persistence, no change to how any of the three booleans is computed (`getOrganisationInitialisationStatus`, unchanged).

## Implementation

`apps/web/src/api-client.ts` gains one new client function and DTO, mirroring the file's own established per-route convention (placed alongside `RegistrationToken`/`PlatformOperator`, same file):

```ts
export interface OrganisationInitialisationStatus {
  organisationId: string;
  hasProjectType: boolean;
  hasLlmProvider: boolean;
  hasPolicy: boolean;
  initialised: boolean;
}

export function getOrganisationInitialisationStatus(
  organisationId: string,
): Promise<ApiResult<OrganisationInitialisationStatus>> {
  return request<OrganisationInitialisationStatus>(
    `/api/v1/organisations/${organisationId}/initialisation-status`,
  );
}
```

New component `apps/web/src/features/organisations/OrganisationSetupChecklist.tsx`, following `OrganisationRow`'s own established icon-toggled `Collapse` panel pattern (Members/AI Providers/Settings, `OrganisationsPage.tsx:460-577`) as a fourth such panel:

- Fetches `getOrganisationInitialisationStatus(organisationId)` on mount and exposes a `refresh()` the panel calls after returning from a navigation that could have changed status (window focus, or a manual "Refresh" affordance — polling on an interval is not required).
- Renders three rows, each a checkmark/empty-circle icon plus label plus an action:
  1. **"Create your first project"** (`hasProjectType`) — a link/button navigating to `/projects` (React Router `useNavigate`), where the real, existing "New project" form (`ProjectsPage.tsx:239`) already operates against `useOrganisationContext()`'s selected organisation.
  2. **"Configure an AI provider"** (`hasLlmProvider`) — a button that opens *this same row's* existing `AiProvidersPanel` (lifts a callback/ref from `OrganisationRow`, or simply also toggles that row's own `aiProvidersOpen` state) rather than navigating away, since that panel already lives on this exact page/row.
  3. **"Author an organisation policy"** (`hasPolicy`) — a link/button navigating to `/governance`, where `PolicyAuthoringForm`'s existing `scope: 'organisation'` option (`GovernancePage.tsx:283-287`) already creates the required row.
- When `initialised` is `true`, the panel shows a single confirmation line ("Setup complete.") instead of the checklist rows.
- `OrganisationRow` gains a fourth icon toggle (e.g. a checklist icon) alongside its existing Members/AI Providers/Settings icons, and a small, visible indicator (a `Chip` reading "Setup incomplete") next to the organisation's name/status when `initialised` is `false` — visible without requiring the user to open the panel first, satisfying "explicit, required... not optional."
- `OrganisationsPage.tsx` wires DEVOS-341's `onCreated` callback to auto-open the newly-created organisation's checklist panel (selecting it, per the existing `selectOrganisation` call, and setting its checklist-open toggle to `true`) so the guided flow continues directly from creation into setup with no extra click to discover it.

## Out of scope

Any change to the three requirements' own computation or persistence (Sprint 58, unchanged). Enforcement itself (Sprint 59, unchanged) — this checklist is a read-only guide; a user can still navigate away and attempt a gated mutation directly, which the real server-side guard (unchanged) still rejects regardless of whether this checklist was ever opened.

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. Manual verification during implementation, against the real dev API: a freshly created, non-initialised organisation shows all three rows unchecked and the "Setup incomplete" indicator; completing each of the three (creating a project, adding an LLM provider, authoring an organisation policy) via this checklist's own links flips that row's own status to checked on the next `refresh()`, without requiring a page reload; once all three are complete, the panel shows "Setup complete." and the "Setup incomplete" indicator disappears from the row.
