# DEVOS-192 — Wire repository search/listing/file retrieval into the development agent

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** none.
**Depended on by:** DEVOS-193.

## Scope

`searchRepository`/`retrieveRepositoryFile`/`retrieveRepositoryListing` (`packages/knowledge`) get a real, first-ever caller; the development agent gains real, bounded, current file content for the files most relevant to its own assigned plan.

## Implementation

- `packages/knowledge/src/retrieval/retrieve-relevant-repository-context.ts` (new): `retrieveRelevantRepositoryContext(repositoryPath, revision, query?, options?)` — always calls `retrieveRepositoryListing`; when `query` is non-empty, derives up to 5 distinct lowercase terms (length > 3) from it, calls `searchRepository` once per term (bounded matches per term), aggregates matches into one `REPOSITORY_SEARCH_RESULT`-shaped source, and calls `retrieveRepositoryFile` for up to 5 distinct matched paths (bounded bytes each). Returns `{ listing, searchResult?, files }`. Zero query, or zero matches, returns `{ listing, files: [] }` — today's exact prior information content, just sourced from the real function instead of a hand-rolled ref.
- `packages/knowledge/src/index.ts`: export the new function/types.
- `packages/application/src/tasks/run-development-agent-task.ts`: replaces its own `listRepositoryFiles(workspace.path)` call and hand-constructed `{ type: 'REPOSITORY_LISTING', ref: ... }` manifest source with a real call to `retrieveRelevantRepositoryContext(workspace.path, revision, latestPlanVersion.metadata?.summary)`; `repositoryFiles` in the model input is now sourced from the real listing's own content; when real search matches exist, the model input gains `relevantRepositoryFiles` (each matched file's real path/content/truncated flag) and the context manifest gains real `REPOSITORY_SEARCH_RESULT`/`REPOSITORY_FILE` sources (never ranked — matching `REPOSITORY_LISTING`'s own existing unranked treatment in this same manifest).
- `packages/agents/src/prompts/developer/v1/system.md`: documents the new optional `relevantRepositoryFiles` input honestly (real current content of the files most relevant to the plan, found via keyword search — not a complete or guaranteed-relevant set); the existing "record it in `uncertainty`" guidance is kept for any file this doesn't cover.

## Out of scope

Any change to how `proposedFiles` are applied (`repo-write`/`git-commit`/`pull-request-create` via the Tool Gateway) — completely unchanged. Any agentic tool-calling loop.

## Acceptance

Unit tests (new, in `packages/knowledge/tests/repository-context.test.ts`): a real query matching a real file's content returns that file's real content, bounded; a zero-match query returns `{ files: [] }`; a missing/empty query returns `{ files: [] }` — the pre-existing `retrieveRepositoryListing`/`searchRepository`/`retrieveRepositoryFile` tests continue to pass unmodified. `run-development-agent-task.test.ts` gains a case proving `relevantRepositoryFiles` is populated in the model input when the plan's summary matches real repository content, and that omitting/empty summary reproduces today's exact prior behaviour (no regression for every existing case). `pnpm --filter @devos/knowledge --filter @devos/application --filter @devos/agents typecheck test` green.
