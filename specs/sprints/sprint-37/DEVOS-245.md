# DEVOS-245 — Agent marketplace UI

**Priority:** P0
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.9

## Acceptance summary

Within the Agents area: a Share/Unshare action on a published agent version (wiring the share route for the first time in the UI), and a browse/install view for organisation-shared versions, per `ui-spec.txt` §15's thin agent-catalogue framing (no marketplace-specific interaction guidance exists there — see `README.md`'s own grounding — so this task's own layout choices are not spec-dictated).

## Scope

- `apps/web/src/features/agents/AgentDetailPage.tsx`:
  - Versions table gains a "Shared" column (a plain `Chip`/text indicator, not `StatusChip`, since `sharedAcrossOrganisation` is a boolean flag, not a `Status` union) showing "Shared" or "Not shared" for each version.
  - The existing action cell (currently only a `Publish` button on the draft row) gains a Share/Unshare button, shown only when `version.status === 'PUBLISHED'` (mirroring the existing `hasDraft`/`Publish`-button gating precedent exactly — one conditional action per real, backend-enforced state transition). No client-side role check (see `README.md`'s own grounding on this codebase's established "backend enforces, `ErrorAlert` surfaces the rejection" convention); a non-`OWNER`'s attempt surfaces the real `ForbiddenError` message through the existing `actionError`/`ErrorAlert` pattern already used for `Publish`.
  - `handleShareToggle(version)` calls `shareAgentVersion(id, version.version, !version.sharedAcrossOrganisation)` then `setRefreshToken` on success, matching `handlePublish`'s own shape exactly.
- New `apps/web/src/features/agents/AgentMarketplacePage.tsx` at `/agents/marketplace`:
  - Reads `selectedOrganisationId` from `useOrganisationContext()` and `projects` from `useProjectContext()` (already organisation-filtered, per `README.md`'s own grounding).
  - Fetches `listSharedAgentVersions(selectedOrganisationId)` whenever `selectedOrganisationId` changes; renders nothing but a prompt to select an organisation when none is selected (matching `AgentsPage.tsx`'s own "select a project" empty-state precedent for consistency).
  - A `Paper variant="outlined"` list panel (local `PanelHeader`, matching every other list page in this epic) with columns: Agent (name + key), Version, Role/Provider/Model (from `configuration`), Capabilities (chips, matching `AgentDetailPage.tsx`'s own rendering), Source project (resolved from `projects` by `sourceProjectId`, falling back to the raw id when not found in the caller's own organisation-scoped project list), and an inline install action.
  - Install action: a per-row `Select` of the organisation's own `projects` (excluding none — installing into the same project that already owns the source agent is a harmless no-op the backend itself doesn't reject, so it is not filtered out client-side) plus an "Install" button; on success, show a transient inline "Installed as {agent.name} v{version.version}" confirmation in that row (the newly created agent does not appear in this same shared-versions list, since installing does not itself share the new copy — no list reload needed).
  - New "Agent Marketplace" nav entry in `apps/web/src/App.tsx`'s existing `Platform` `NAV_GROUPS` group, immediately after the existing `/agents` entry; new `<Route path="/agents/marketplace" element={<AgentMarketplacePage />} />` registered alongside the existing `/agents`/`/agents/:id` routes (static path, ranks above the dynamic `:id` route regardless of declaration order — see `README.md`'s own grounding).

## Out of scope

Any backend change. A detail/viewer page for a single shared version beyond the browse list's own row (no additional route exists to back one). Unsharing from the browse view (only the sharing project's own `AgentDetailPage.tsx` can unshare — matching where the Share action lives). Filtering the install-target picker to exclude the source project.

## Validation

`pnpm --filter @devos/web typecheck lint build`; live dev-server verification against the real seeded "DevOS POC" project/organisation: publish a real draft version, share it, confirm it appears in `/agents/marketplace` for the same organisation, install it into a different real project in that organisation, confirm the real new `Agent`/`AgentVersion` row exists via `getAgent`, then unshare the original and confirm it disappears from the marketplace list.
