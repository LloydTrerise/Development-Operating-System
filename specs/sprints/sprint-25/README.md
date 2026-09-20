# Sprint 25 — Real Relevance Retrieval & Organisation-Scoped Knowledge Sharing (E26 Knowledge Platform, part 2)

**Source:** `specs/DEVOS-KNOWLEDGE-PLATFORM-BACKLOG.md` §6 "Sprint 25", grounded against `packages/knowledge/src/context/build-context.ts`/`retrieve-knowledge-sources.ts` (unconditional flat inclusion, confirmed unchanged since Sprint 3) and Sprint 23's own twice-proven organisation-scoped share/install precedent (`packages/application/src/agents/share-agent-version.ts`/`install-agent-version.ts`).
**Conversion date:** 2026-09-20
**Status:** Converted and authorized to begin, per the user's standing authorization for this whole epic (2026-09-20) — see Sprint 24 README.

## Goal

Sprint 24 closed the lifecycle/UI/traceability parity gaps. This sprint closes E26's remaining two sub-themes: real, query-scoped relevance retrieval (the honest, no-new-dependency slice of "advanced retrieval") and a real organisation-scoped knowledge-sharing mechanism (the honest slice of "enterprise"), mirroring E25 Sprint 23's own share/install shape applied to a different resource.

## Grounding (confirmed by direct code inspection before scoping)

- `retrieveActiveKnowledgeSources` (`packages/knowledge/src/retrieval/retrieve-knowledge-sources.ts`) unconditionally includes every `ACTIVE` source for the project — no query, no ranking. `buildContext()`'s caller, `run-agent-task.ts`, already resolves the real `WorkItem` (title/description) before calling `buildContext()` — the exact real query text this sprint's relevance retrieval needs, with no new lookup required.
- No `knowledge_sources` column carries any organisation scoping or sharing flag (`packages/database/migrations/0018_knowledge_sources.ts`) — no cross-project reuse mechanism exists at all, confirmed absent by grep.
- The organisation-scoped share/install pattern is already proven for `AgentVersion` (DEVOS-177/178, migration `0039_agent_versions_add_shared_across_organisation.ts`, `share-agent-version.ts`/`install-agent-version.ts`/`list-shared-agent-versions.ts`) — this sprint applies the identical shape to `KnowledgeSource`, not a new design.

## Real design decisions this sprint's own grounding surfaced (recorded here, not silently assumed)

1. **Real Postgres full-text search (`tsvector`/`plainto_tsquery`), never embeddings (DEVOS-187):** the user's own accepted ceiling from `specs/DEVOS-KNOWLEDGE-PLATFORM-BACKLOG.md` §10 — no new external dependency, honestly labelled "keyword relevance."
2. **An additive `sharedAcrossOrganisation: boolean` flag on `KnowledgeSource`, not a new table (DEVOS-188):** mirrors DEVOS-177's identical `AgentVersion` design exactly, for the same additive-field-discipline reasons.
3. **Install is a one-time clone, never a live link (DEVOS-189):** mirrors DEVOS-178's `installAgentVersion` precedent exactly.
4. **Zero-match relevance search falls back to full unconditional inclusion, not an empty context (DEVOS-187):** avoids surprising a run with no context at all when a work item's title/description happens to share no keywords with any stored source — the same "fail toward today's existing behaviour" discipline DEVOS-159/179 already applied to agent selection's own zero-data fallback.

## In scope (DEVOS-187–191, executed in ID order)

- **DEVOS-187** — Real query-scoped relevance retrieval.
- **DEVOS-188** — Real, organisation-scoped "share" primitive.
- **DEVOS-189** — Real "install into project" primitive.
- **DEVOS-190** — Real end-to-end pilot: relevance retrieval + share + install.
- **DEVOS-191** — Validation, documentation, and gap disclosure.

## Out of scope / deferred

Any embeddings/vector database. Any knowledge-graph/relationship model. Any cross-organisation sharing (ADR-SEC-005, never violated). A general-purpose query language. Any part of E27.

## Sprint-wide acceptance criteria (from the backlog's own exit criteria)

A real knowledge source genuinely moves from one project to another within the same organisation, and a real relevance signal genuinely changes which sources a real execution's context includes for the first time in this codebase.

## Governance

Closes the whole E26 Knowledge Platform epic on completion. `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` updated at completion per `AGENTS.md` §18/§19, recording the user's own standing authorization for this epic rather than a per-step "proceed".

## Task index

| ID        | Story                                                          | File           |
| --------- | --------------------------------------------------------------- | -------------- |
| DEVOS-187 | Real query-scoped relevance retrieval                            | `DEVOS-187.md` |
| DEVOS-188 | Real, organisation-scoped "share" primitive                      | `DEVOS-188.md` |
| DEVOS-189 | Real "install into project" primitive                            | `DEVOS-189.md` |
| DEVOS-190 | Real end-to-end pilot: relevance retrieval + share + install     | `DEVOS-190.md` |
| DEVOS-191 | Validation, documentation, and gap disclosure                    | `DEVOS-191.md` |
