# DEVOS-248 — Knowledge marketplace UI

**Priority:** P0
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.10

## Acceptance summary

Within the Knowledge area: a browse/install view for organisation-shared knowledge sources, alongside the existing share (publish-side) action already wired on `KnowledgeSourceDetailPage.tsx` (Sprint 34's DEVOS-231), per `ui-spec.txt` §17's thin framing (no marketplace-specific interaction guidance exists there — see `README.md`'s own grounding — so this task's own layout choices are not spec-dictated).

## Scope

- New `apps/web/src/features/knowledge/KnowledgeMarketplacePage.tsx` at `/knowledge/marketplace`, structurally mirroring `AgentMarketplacePage.tsx` (Sprint 37) with the following real differences:
  - Reads `selectedOrganisationId` from `useOrganisationContext()` and `projects` from `useProjectContext()` (already organisation-filtered) — `projects` is used only to populate the install-target picker, not to resolve the source project's name (see below).
  - Fetches `listSharedKnowledgeSources(selectedOrganisationId)` whenever `selectedOrganisationId` changes; renders nothing but a prompt to select an organisation when none is selected (matching `KnowledgeSourcesPage.tsx`'s own "select a project" empty-state precedent, adapted to organisation scope).
  - A `Paper variant="outlined"` list panel (local `PanelHeader`, matching every other list page in this epic) with columns: Key/Name, Type, Source project, Install. `SharedKnowledgeSource.sourceProjectName` is rendered directly from the API response — **no client-side resolution against the `projects` list is needed** (a real, favourable divergence from `AgentMarketplacePage.tsx`'s own workaround, since `SharedKnowledgeSource` already carries `sourceProjectName` — see `README.md`'s grounding).
  - Install action: a per-row `Select` of the organisation's own `projects` (excluding none — installing into the same project that already owns the source is a harmless no-op the backend itself doesn't reject, matching `AgentMarketplacePage.tsx`'s own precedent) plus an "Install" button; on success, show a transient inline "Installed as {result.data.name}." confirmation in that row (no version number, since `KnowledgeSource` has no version concept — unlike the agent marketplace's "Installed as … v1." message). The newly installed source does not appear in this same shared-sources list, since installing does not itself share the new copy — no list reload needed.
  - New "Knowledge Marketplace" nav entry in `apps/web/src/App.tsx`'s existing `Platform` `NAV_GROUPS` group, immediately after the existing `/knowledge` entry; new `<Route path="/knowledge/marketplace" element={<KnowledgeMarketplacePage />} />` registered alongside the existing `/knowledge`/`/knowledge/:id` routes (static path, ranks above the dynamic `:id` route regardless of declaration order — same `react-router-dom@7.18.2` ranking Sprint 37 already confirmed for `/agents/marketplace`).

## Out of scope

Any backend change. A detail/viewer page for a single shared source beyond the browse list's own row. Unsharing from the browse view (only the sharing project's own `KnowledgeSourceDetailPage.tsx` can unshare — matching where the Share action lives, same convention as the agent marketplace). Filtering the install-target picker to exclude the source project. Any change to `KnowledgeSourcesPage.tsx`.

## Validation

`pnpm --filter @devos/web typecheck lint build`; live dev-server verification against the real seeded "DevOS POC" project/organisation: create a real knowledge source, share it, confirm it appears in `/knowledge/marketplace` for the same organisation with its real source project name, install it into a different real project in that organisation, confirm the real new `KnowledgeSource` row exists via `getKnowledgeSource`, then unshare the original and confirm it disappears from the marketplace list.
