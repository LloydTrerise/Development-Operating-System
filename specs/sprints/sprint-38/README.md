# Sprint 38 — Knowledge Marketplace, Consume Side (net-new)

**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.10 (E28 UI/UX Redesign & Full Functional Coverage, tenth sprint).
**Conversion date:** 2026-09-22
**Status:** Converted and authorized per explicit user instruction ("proceed", 2026-09-22, following a prior turn's own position report naming Sprint 38 as next). Depends on Sprint 25's real, already-complete knowledge-sharing/install primitives (`shareKnowledgeSource`/`listSharedKnowledgeSourcesForOrganisation`/`installKnowledgeSource`, DEVOS-188/189) and Sprint 34's DEVOS-231 Knowledge Source detail view. Structurally mirrors Sprint 37's Agent Marketplace almost exactly, but for Knowledge Sources.

## Goal

Give the Knowledge area a real browse/install UI for the organisation-scoped knowledge-sharing primitive Sprint 25 built at the API layer (client wrappers included) but never wired to any UI — a browse view for knowledge sources other projects in the same organisation have shared, with an install-to-project action. This sprint adds zero backend routes, zero contract changes, and zero new API client code, per the epic's own Delivery Principle (`specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §7/§9).

## Grounding (confirmed by direct code inspection before scoping)

- **All backend routes and both client wrappers this sprint depends on already exist, unmodified.** Routes (`apps/api/src/routes/knowledge-sources.ts:133,147`, built in Sprint 25's E26 Knowledge Platform epic): `GET /organisations/:organisationId/shared-knowledge-sources` and `POST /organisations/:organisationId/shared-knowledge-sources/:knowledgeSourceId/install` (body `{ targetProjectId }`, returns the plain installed `KnowledgeSource`, not wrapped with a version like the agent marketplace's install response — knowledge sources have no version concept). Client wrappers (`apps/web/src/api-client.ts:1308` `listSharedKnowledgeSources(organisationId)`, `:1316` `installKnowledgeSource(organisationId, knowledgeSourceId, targetProjectId)`) already exist, fully typed against these exact routes — confirmed by direct read. **Genuinely zero call sites exist for either wrapper** anywhere under `apps/web/src/features/knowledge/` (confirmed by grep) — this sprint is UI-only, no new client code needed, per DEVOS-247's own backlog framing.
- **`SharedKnowledgeSource` (`packages/domain/src/knowledge/knowledge-source.ts:88`, `apps/web/src/api-client.ts:1237`) already carries `sourceProjectName: string`**, unlike `SharedAgentVersion` — confirmed by direct read of both the domain type and `apps/api/src/dto/knowledge-source.ts`'s `toSharedKnowledgeSourceDto`, which sets it directly from the real join. **This is the one real, confirmed divergence from Sprint 37's own precedent**: the marketplace page renders the source project's name directly from the API response — no client-side resolution against `useProjectContext()`'s own `projects` list is needed (though `projects` is still used to populate the install-target picker, same as Sprint 37).
- **`installKnowledgeSource` (`packages/application/src/knowledge/install-knowledge-source.ts:49-52`) already de-conflicts a colliding `(project_id, key)`** with a random 8-character suffix, rather than failing the install outright — confirmed by direct read. This is a real, disclosed contrast with `installAgentVersion`'s own unfixed Sprint-23 gap (Sprint 37's own disclosed finding): the collision-driven 500 Sprint 37 had to work around does **not** recur here.
- **No `ProjectTypeKnowledge` / template-clone concept exists anywhere in this codebase** (confirmed by grep — zero matches), unlike `ProjectTypeAgent`'s template-clone-at-project-creation behaviour that caused Sprint 37's disclosed collision scenario in the first place. Every project's knowledge sources are created directly, never cloned from a project type, so the collision scenario itself is far less likely to arise during this sprint's own live verification — a real shared knowledge source should install cleanly into a different real project without needing Sprint 37's "create a uniquely-keyed one first" workaround. This will be reconfirmed empirically during DEVOS-249's live verification, not just assumed from this grounding.
- **`KnowledgeSourceDetailPage.tsx`** already has a working Share/Unshare button (lines 116-193) wired to `shareKnowledgeSource`, shown for any non-archived source (no `PUBLISHED`-only gating, since `KnowledgeSource` has no draft/published lifecycle the way `AgentVersion` does) — the publish-side half of this feature is already complete and out of this sprint's scope to touch.
- **`Design/uploads/ui-spec.txt` §17 "Knowledge UI"** (line 307) gives only a generic field list for "Source detail" ("Status, permissions, freshness") — confirmed directly, same thin-framing finding Sprint 34 already made for this section. No marketplace-specific interaction guidance exists there; this sprint's own browse/install layout is not spec-dictated, same conclusion Sprint 37 reached for its own `ui-spec.txt` §15.
- **No client-side role/permission gating precedent exists anywhere in this codebase** (re-confirmed, same finding as Sprint 37's own grounding) — the marketplace page renders the install action unconditionally; a real backend rejection (e.g. not a member of the target project) surfaces through the existing `ErrorAlert` pattern.
- **Route-ordering**: `apps/web/src/App.tsx` already has `/knowledge/:id` registered. The same static-path-ranks-above-dynamic-path reasoning Sprint 37 relied on for `/agents/marketplace` vs `/agents/:id` applies identically to `/knowledge/marketplace` vs `/knowledge/:id` (same `react-router-dom@7.18.2` pin, same ranking algorithm) — no conflict.
- **No real divergence from the backlog's own framing was found** beyond the two disclosed above (already-present `sourceProjectName`, already-de-conflicted install collision) — both are favourable divergences that simplify this sprint relative to Sprint 37, not open questions.

## In scope

- **DEVOS-247** — Confirm the already-existing `listSharedKnowledgeSources`/`installKnowledgeSource` wrappers and types require zero changes (verified above); no client code changes in this story beyond what DEVOS-248 wires them into.
- **DEVOS-248** — Knowledge marketplace UI: a new `features/knowledge/KnowledgeMarketplacePage.tsx` at `/knowledge/marketplace` (new "Knowledge Marketplace" nav entry in the existing Platform group, immediately after "Knowledge") listing every real knowledge source shared across the caller's selected organisation, with an inline install-to-project action per row.
- **DEVOS-249** — Validation, documentation, and gap disclosure: full monorepo validation green; full real `tests/e2e` suite green; new unit tests for the two now-finally-used wrappers; live dev-server verification.

## Out of scope

Any new backend route, use case, or domain field. Any change to `shareKnowledgeSource`/`listSharedKnowledgeSourcesForOrganisation`/`installKnowledgeSource` semantics. Any change to `KnowledgeSourceDetailPage.tsx`'s existing Share/Unshare action or `KnowledgeSourcesPage.tsx`'s existing list/create behaviour. Client-side role/permission gating. A detail/viewer page for a single shared source beyond the browse list's own row.

## Task index

| ID        | Story                                          | File           |
| --------- | ----------------------------------------------- | -------------- |
| DEVOS-247 | Wire the already-written client functions       | `DEVOS-247.md` |
| DEVOS-248 | Knowledge marketplace UI                        | `DEVOS-248.md` |
| DEVOS-249 | Validation, documentation, and gap disclosure   | `DEVOS-249.md` |
