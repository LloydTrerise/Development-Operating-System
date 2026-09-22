# DEVOS-231 — Knowledge Sources restyle + detail view

**Priority:** P1
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.6

## Acceptance summary

`KnowledgeSourcesPage.tsx` restyled; closes `GET /knowledge-sources/:id` with a real detail view (status, permissions, freshness, per `ui-spec.txt` §17).

## Scope

- `apps/web/src/api-client.ts`: add `getKnowledgeSource(knowledgeSourceId)` wrapper against the existing, unmodified `GET /api/v1/knowledge-sources/:knowledgeSourceId` route.
- `apps/web/src/features/knowledge/KnowledgeSourcesPage.tsx`: restyle into a summary table (key, name, source type, status, shared badge, used-by count), wrapped in a `Paper`/`PanelHeader` panel, mirroring `WorkItemsPage.tsx`'s DEVOS-212 dense-table convention. Row click navigates to `/knowledge/:id`. The existing "New knowledge source" creation form stays on this page unchanged. The inline per-row edit form, share/archive actions, and reference count move to the new detail page.
- New `apps/web/src/features/knowledge/KnowledgeSourceDetailPage.tsx` at `/knowledge/:id` (`DetailPageLayout`, `backTo="/knowledge"`): identity (key, name, source type, status), the real `sharedAcrossOrganisation` flag as the "permissions" signal (§17) with its existing share/unshare toggle, `updatedAt`/`createdAt` as the "freshness" signal (§17) — disclosed as the only real recency signal that exists, not a dedicated sync-freshness concept — an editable content field (moved from the list row), the archive action, and the real usage/reference list from `getKnowledgeSourceReferences` (moved from the list row's count-only display).
- `apps/web/src/App.tsx`: add the `/knowledge/:id` route.

## Out of scope

A real permissions matrix or classification model beyond `sharedAcrossOrganisation` (no data source exists). A real ingestion/sync-freshness concept beyond `updatedAt` (no data source exists). Any change to `updateKnowledgeSource`/`archiveKnowledgeSource`/`shareKnowledgeSource`/`getKnowledgeSourceReferences` semantics.

## Validation

`pnpm --filter @devos/web typecheck lint build`; new `apps/web/tests/api-client.test.ts` case for `getKnowledgeSource`. Manual verification against a real running dev server (Playwright) with a real seeded knowledge source: list renders, row click navigates to the detail page, edit/share/archive still work from the detail page, real reference list renders.
