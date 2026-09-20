# Sprint 24 — Real Knowledge Lifecycle, Authoring UI & Closing the Traceability Gap (E26 Knowledge Platform, part 1)

**Source:** `specs/DEVOS-KNOWLEDGE-PLATFORM-BACKLOG.md` §6 "Sprint 24", grounded against direct inspection of the real, current implementation (`packages/domain/src/knowledge/*.ts`, `packages/database/src/repositories/knowledge-sources.ts`/`knowledge-references.ts`, `apps/api/src/routes/knowledge-sources.ts`, `packages/application/src/tasks/run-agent-task.ts`).
**Conversion date:** 2026-09-20
**Status:** Converted and authorized to begin, per the user's explicit "proceed with the spec'ing and implementation, run the whole process through without waiting for approval" (2026-09-20) — a standing authorization for this whole epic (Sprints 24–25), the same shape as the standing authorization E24 (Sprint 20/21) received.

## Goal

Knowledge sources are real but minimal: create-only (no update/archive), no web UI at all, and a real usage-traceability table (`KnowledgeReference`) that has never been written to in three sprints. This sprint closes all three gaps for real, bringing `KnowledgeSource` to the same lifecycle/UI parity every other real resource in this codebase already has, and making `software-change-workflow.md` §28's "context is authorised and traceable" claim true for traceability for the first time.

## Grounding (confirmed by direct code inspection before scoping)

- `KnowledgeSourceRepository` has `getById`/`getByProjectAndKey`/`listForProject`/`create` only — no update, archive, or delete method anywhere (`packages/domain/src/knowledge/knowledge-source.ts`). `createKnowledgeSource` always writes `status: 'ACTIVE'`; no code path ever writes any other value.
- `apps/web/src/pages` has zero references to "knowledge" (case-insensitive grep) — a knowledge source can only be created/read via direct API calls to `apps/api/src/routes/knowledge-sources.ts` (`GET`/`POST` list+create, `GET` by id — no `PATCH`/`DELETE`).
- `KnowledgeReferenceRepository`/`create` (`packages/database/src/repositories/knowledge-references.ts`) is never called anywhere in `packages/application` or `apps/*` outside its own repository unit test — confirmed by direct grep. `buildContext()`'s real call site (`run-agent-task.ts:317`) does not write it.
- `run-agent-task.ts` already resolves `workItem` (line 271) before calling `buildContext()` (line 317) and already has `task.id`/`execution.id` in scope at that point — the exact real capture point this sprint's traceability wiring needs, with no new lookup required.

## Real design decisions this sprint's own grounding surfaced (recorded here, not silently assumed)

1. **A plain two-state `ACTIVE`/`ARCHIVED` lifecycle (DEVOS-182):** no spec requires knowledge edits to go through a draft/review/publish gate (unlike agents/policies/workflows); the existing `status` column already exists and is simply unused beyond `ACTIVE` today.
2. **`KnowledgeReference` rows are written for every `KNOWLEDGE_SOURCE`-type source `buildContext()` actually selects (DEVOS-184), not for `PROJECT_CONTEXT`/`ARTIFACT`:** the domain model's own three-sprint-old doc comment ties this table specifically to "a knowledge source it intentionally used" — widening it to every context source type would be a new, undiscussed scope change, not a fix to the one real, disclosed gap this sprint targets.
3. **The UI (DEVOS-183) is a new dedicated `KnowledgeSourcesPage.tsx`, mirroring `AgentsPage.tsx`'s own "first UI for this concept" precedent exactly** — not a bolted-on section of an existing page.

## In scope (DEVOS-182–186, executed in ID order)

- **DEVOS-182** — Knowledge source update & archive lifecycle.
- **DEVOS-183** — Real per-project knowledge management UI.
- **DEVOS-184** — Real usage traceability: wire `KnowledgeReference` into `buildContext()`.
- **DEVOS-185** — Real end-to-end pilot: authored, used, and traced.
- **DEVOS-186** — Validation, documentation, and gap disclosure.

## Out of scope / deferred

Any embeddings/vector/semantic retrieval (Sprint 25's own honest ceiling, per `specs/DEVOS-KNOWLEDGE-PLATFORM-BACKLOG.md` §10). Any organisation-scoped sharing (Sprint 25). Any knowledge-graph/relationship model (never scoped). A richer `status` taxonomy beyond `ACTIVE`/`ARCHIVED`. Wiring the already-dead `searchRepository`/`retrieveRepositoryFile`/`retrieveRepositoryListing` functions (a separate, unrelated gap). Any part of E27.

## Sprint-wide acceptance criteria (from the backlog's own exit criteria)

A real knowledge source is created, used, and archived entirely through a real UI, with a real, independently-confirmed traceability record for its use.

## Governance

Authorized to begin and to run through to Sprint 25's own completion without an intermediate approval gate, per the user's own explicit instruction (2026-09-20). `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` are still updated at each real completion point, per `AGENTS.md` §18/§19, recording that standing authorization rather than a per-step "proceed".

## Task index

| ID        | Story                                                            | File           |
| --------- | ----------------------------------------------------------------- | -------------- |
| DEVOS-182 | Knowledge source update & archive lifecycle                       | `DEVOS-182.md` |
| DEVOS-183 | Real per-project knowledge management UI                          | `DEVOS-183.md` |
| DEVOS-184 | Real usage traceability: wire `KnowledgeReference` into `buildContext()` | `DEVOS-184.md` |
| DEVOS-185 | Real end-to-end pilot: authored, used, and traced                 | `DEVOS-185.md` |
| DEVOS-186 | Validation, documentation, and gap disclosure                     | `DEVOS-186.md` |
