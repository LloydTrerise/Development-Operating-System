# DEVOS-183 — Real per-project knowledge management UI

**Priority:** P0 | **Estimate:** 3d
**Depends on:** DEVOS-182 (edit/archive actions the UI exposes).
**Depended on by:** DEVOS-185 (pilot authors through this UI).

## Scope

The first web UI this concept has ever had: list, create, edit, and archive a project's real knowledge sources.

## Implementation

- `apps/web/src/api-client.ts`: `KnowledgeSource` type (mirroring `toKnowledgeSourceDto`'s shape) plus `listKnowledgeSources`, `createKnowledgeSource`, `updateKnowledgeSource`, `archiveKnowledgeSource`, `getKnowledgeSourceReferences` (DEVOS-184's read side, added here since the page renders it) client functions, mirroring `Agent`/`listAgents`/`createAgent`'s own established shape.
- `apps/web/src/pages/KnowledgeSourcesPage.tsx` (new): lists a project's knowledge sources (key, name, sourceType, status) with inline edit and an archive action; a create form mirroring `AgentsPage.tsx`'s own form pattern; archived sources are shown (greyed / status chip) rather than hidden, so the archive action is visibly reversible-in-spirit even though un-archive is not itself scoped.
- `apps/web/src/App.tsx`: new `{ to: '/knowledge', label: 'Knowledge' }` nav entry and `<Route path="/knowledge" element={<KnowledgeSourcesPage />} />`, mirroring the `/agents` entry exactly.

## Out of scope

Any relevance/search UI (Sprint 25's own DEVOS-187 is retrieval-side, not authoring-side). Any organisation-scoped share/install UI (Sprint 25's DEVOS-188/189).

## Acceptance

A real dev-server run (`pnpm --filter @devos/web dev`) confirmed manually: create, edit, and archive a real knowledge source through the page against a real running `apps/api`. `pnpm --filter @devos/web typecheck lint build` green.
