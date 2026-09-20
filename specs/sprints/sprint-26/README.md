# Sprint 26 — Wiring Repository-Derived Context Into the Development Agent (gap closure)

**Source:** `specs/DEVOS-KNOWLEDGE-PLATFORM-BACKLOG.md` §9's own disclosed exclusion — "Repository-derived context (`searchRepository`/`retrieveRepositoryFile`/`retrieveRepositoryListing`) remaining unwired... a distinct, not-yet-scoped gap, deliberately left out of \[E26\] to keep it focused on the `KnowledgeSource` database concept." The user then asked, in the same session, to scope and finish exactly that gap. This is a standalone gap-closure sprint, not part of E26 — the affected code (`run-development-agent-task.ts`) belongs to Stage 7/Controlled Development (Sprint 4-era), not Knowledge Platform; only the dead functions themselves live in `@devos/knowledge`.
**Conversion date:** 2026-09-20
**Status:** Converted and authorized to begin in the same message that requested scoping ("can you scope and finish the what not to build section of the above first").

## Goal

`packages/knowledge/src/retrieval/{search-repository,retrieve-repository-file,retrieve-repository-listing}.ts` are real, tested-in-isolation, exported functions with **zero real callers** anywhere in `packages/application`/`apps/*` — confirmed by grep before scoping E26 and re-confirmed here. Grounding this gap against the one real place repository content would matter — `run-development-agent-task.ts` — surfaced something more consequential than "unused exports": the development agent's own system prompt (`packages/agents/src/prompts/developer/v1/system.md`) explicitly tells the model it does not have "an existing file's exact current content" and must record that as `uncertainty` rather than guess. The agent proposes complete replacement file content for every path it touches, including files that already exist, having seen only a bare list of file paths (`repositoryFiles`, from `listRepositoryFiles` — the one of the four functions that *is* wired) — never their content. This sprint closes both gaps together: it gives the dead functions a real caller, and in doing so gives the development agent real, current file content for the files most relevant to its own assigned plan.

## Grounding (confirmed by direct code inspection before scoping)

- `run-development-agent-task.ts` hand-constructs a `{ type: 'REPOSITORY_LISTING', ref: 'repository-listing:${revision}' }` manifest source that mirrors `retrieveRepositoryListing`'s own ref format without ever calling that function — a real, if harmless, drift risk (the two could diverge silently).
- The `IMPLEMENTATION_PLAN` artifact schema (`packages/agents/src/schemas/implementation-plan/v1/output-schema.json`) has only `summary: string` and an untyped `tasks: array` — no structured field names specific files, so "fetch content for the files the plan names" cannot be done deterministically before the model runs. A single-model-call architecture (this codebase's own established, deliberate shape — no agentic tool-calling loop exists or is proposed here, per `AGENTS.md` §21) therefore cannot know exactly which files to fetch ahead of time.
- Given that constraint, the real, honest, bounded thing this codebase can do — mirroring DEVOS-187's own "real keyword relevance, never semantic, always bounded" discipline for `KnowledgeSource` retrieval, applied here to repository content — is: derive keyword terms from the plan's own `summary` text, run a real bounded `searchRepository` for each term, and fetch the real, bounded content (via `retrieveRepositoryFile`) of the distinct top-matching files. This is not "the agent's context is now complete" — it is a real, disclosed, bounded improvement over "zero content," not a claim of completeness.

## Real design decisions this sprint's own grounding surfaced

1. **A new composition function, not three separate call sites:** `retrieveRelevantRepositoryContext` (`packages/knowledge/src/retrieval/retrieve-relevant-repository-context.ts`) composes all three previously-dead functions into one deterministic pipeline, mirroring how `buildContext()` itself composes `packages/knowledge`'s other retrieval functions — a real caller for the first time, not three independent wiring points.
2. **Zero-query and zero-match fall back to today's exact existing behaviour** (the real repository listing only, no search/file content) — the same "fail toward what already works" discipline DEVOS-187 already established for knowledge-source relevance retrieval.
3. **Bounded on every axis**: capped distinct search terms, capped matches per term, capped distinct files, capped bytes per file — never an unbounded repository dump, per `system-context-engineering-knowledge.md` §10.
4. **The prompt is updated to describe the new field honestly** (`relevantRepositoryFiles`, real current content of the most plan-relevant files it found) rather than silently adding data the model was never told exists.

## In scope

- **DEVOS-192** — `retrieveRelevantRepositoryContext` and its wiring into `run-development-agent-task.ts` and the developer prompt.
- **DEVOS-193** — Validation: unit tests, and a real confirmation (via `tests/e2e/development-path.test.ts`'s existing real-repository fixture) that the model input genuinely contains real file content for a real plan/repository pair.

## Out of scope

Any agentic tool-calling loop letting the model itself request more files mid-generation (a materially larger, different architecture — not proposed here). Any change to the `IMPLEMENTATION_PLAN` schema to structurally name files (a real, separate, larger design question, not assumed or silently decided here). Any use of these functions by any other task handler (review/validation agents) — this sprint's own real, disclosed scope is the one consumer whose own prompt already names the gap.

## Task index

| ID        | Story                                                                  | File           |
| --------- | ----------------------------------------------------------------------- | -------------- |
| DEVOS-192 | Wire repository search/listing/file retrieval into the development agent | `DEVOS-192.md` |
| DEVOS-193 | Validation and real confirmation                                        | `DEVOS-193.md` |
