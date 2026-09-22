# DEVOS-241 — Integrations page

**Priority:** P0
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.8

## Acceptance summary

New `features/integrations/IntegrationsPage.tsx` (per ui-spec.txt §24): list of configured integrations (type, health/status as the route's DTO actually provides — no fabricated health-check UI beyond what the backend returns) plus a register-new-integration form matching the route's real request shape. New "Integrations" nav entry (reserved in Sprint 29) now populated.

## Scope

- New `apps/web/src/features/integrations/IntegrationsPage.tsx`, structured like `ArtifactLibraryPage.tsx` (DEVOS-235): a `Paper variant="outlined"` list panel with a local `PanelHeader`, plus a separate "New integration" form section below — **not** a `DetailPageLayout`/`/{area}/:id` page, since no detail route exists (see `README.md`'s own grounding).
  - List table columns: Name, Type, Provider, Status (`StatusChip`), Created.
  - Data-derived Type and Status filter chips (mirroring `ArtifactLibraryPage.tsx`'s `Array.from(new Set(...))` convention) plus a name search field.
  - Rows are **not** clickable — no navigation target exists.
  - Register form fields: Type, Provider, Name, Credential reference, Configuration (optional, multiline JSON text — parsed client-side before submit; a parse failure shows a local form error without calling the API, an invalid-shape/secret-shaped-key rejection from the backend itself surfaces through the existing `ErrorAlert` pattern). Helper text under Type/Provider discloses the real dispatch-significant values found during grounding: `type: 'Git'` (source-control tasks) or `'Deployment'` (release tasks) for a row any real workflow task can actually use; `provider: 'github'`/`'gitlab'` for a `'Git'` integration's real pull-request provider selection. Not enforced as a closed set — the backend itself doesn't enforce one.
  - On successful create, reload the list (mirroring `ArtifactLibraryPage.tsx`'s `reloadToken` pattern) and clear the form.
- `apps/web/src/App.tsx`: add `IntegrationsPage` import, add `{ to: '/integrations', label: 'Integrations' }` to the existing empty `Integrations` nav group (`NAV_GROUPS`), add `<Route path="/integrations" element={<IntegrationsPage />} />`.

## Out of scope

A detail/viewer page (no `GET /integrations/:id` route). Any edit/disable/delete action (no route). Health/scopes/capabilities/credential-expiry/"Test connection"/resource-mapping UI from ui-spec.txt §24's fuller mockup — none of it is backed by real data or a real route.

## Validation

`pnpm --filter @devos/web typecheck lint build`; live dev-server verification against a real project (list renders real seeded integrations if any exist, filter chips work, a real integration is registered through the form and appears in the list, a deliberately secret-shaped `configuration` key is rejected with the real backend error surfaced in the UI).
