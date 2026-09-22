# DEVOS-230 — Agents restyle + Agent detail view

**Priority:** P1
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.6

## Acceptance summary

`AgentsPage.tsx` restyled; closes `GET /agents/:id` with a real detail view (per `ui-spec.txt` §15/§16: identity, role, status, version, capabilities, knowledge access, tools, policies) using Sprint 29's `/{area}/:id` routing convention.

## Scope

- `apps/web/src/api-client.ts`: add `getAgent(agentId)` wrapper against the existing, unmodified `GET /api/v1/agents/:agentId` route.
- `apps/web/src/features/agents/AgentsPage.tsx`: restyle into a summary table (key, name, status, latest version number, latest version status, latest version's review pass rate), wrapped in a `Paper`/`PanelHeader` panel, mirroring `WorkItemsPage.tsx`'s DEVOS-212 dense-table convention. Row click navigates to `/agents/:id`. The existing "New agent" creation form stays on this page unchanged. The per-agent full version table, quality-per-version, and Publish/Draft-new-version actions move to the new detail page.
- New `apps/web/src/features/agents/AgentDetailPage.tsx` at `/agents/:id` (`DetailPageLayout`, `backTo="/agents"`): identity (name, key, description, agent-level status), a version-history table (version, status, role, provider, model, review pass rate, Publish action) with the existing Publish/Draft-new-version actions, and a disclosed note that "knowledge access" and "policies" (named in `ui-spec.txt` §15) have no real per-agent data source anywhere in this codebase — not fabricated.
- `apps/web/src/App.tsx`: add the `/agents/:id` route.

## Out of scope

A real "knowledge access" or "policies" field/relationship (no data source exists). Any change to `createAgent`/`createNewAgentVersion`/`publishAgentVersion`/`getAgentQuality` semantics.

## Validation

`pnpm --filter @devos/web typecheck lint build`; new `apps/web/tests/api-client.test.ts` case for `getAgent`. Manual verification against a real running dev server (Playwright) with a real seeded agent: list renders, row click navigates to the detail page with real version/quality data, Publish/Draft-new-version still work from the detail page.
