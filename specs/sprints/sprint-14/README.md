# Sprint 14 — Lifecycle, Preview & Library (E21 Workflow Designer, part 2)

**Source:** `specs/DEVOS-WORKFLOW-EXPANSION-AND-DESIGNER-BACKLOG.md` §7 "Sprint 14 — Lifecycle, Preview & Library", grounded against direct inspection of the real, current implementation (`packages/application/src/workflows/*.ts`, `packages/application/src/policy/create-policy.ts`, `packages/contracts/src/status.ts`, `apps/api/src/routes/workflows.ts`/`agents.ts`, `apps/web/src/api-client.ts`, `apps/web/src/pages/RunsPage.tsx`, `packages/domain/src/workflows/validation.ts`).
**Conversion date:** 2026-09-18
**Status:** Approved to begin (user: "start sprint 14").

## Goal

Sprint 13 built a real visual canvas but scoped it to `ProjectType` **templates** only. This sprint closes the other half of the gap `specs/architecture/organisations-and-project-types.md` §2 already confirmed ("the web app has zero client functions or UI for it" — `WorkflowVersion`'s own draft → validate → publish lifecycle) and adds the Designer spec's remaining §43 acceptance surface: version comparison, execution-path preview, and a real workflow library.

## Grounding (confirmed by direct code inspection before scoping)

- **A real, load-bearing gap found before any implementation: there is no mechanism anywhere in this codebase to create a new draft version of an already-`PUBLISHED` `WorkflowDefinition`.** `createWorkflowDraftCreator`/`CreateWorkflowDraft` (`packages/database/src/repositories/create-workflow-draft.ts`) is a combined create-definition-and-version-1 transaction, called only by `createWorkflowDefinition` (`packages/application/src/workflows/create-workflow-definition.ts`) — it always hardcodes `version: 1`. `updateDraftWorkflow`/`validateDraftWorkflow`/`publishWorkflowVersion` all call `requireDraftVersion` (`packages/application/src/workflows/draft-access.ts`), which fetches the **latest** version and throws `"The current workflow version is published and immutable; no draft is available."` the moment that latest version is anything other than `DRAFT`. Since every real `WorkflowDefinition` in this codebase (seeded or cloned) is created already-`PUBLISHED` (per `specs/architecture/organisations-and-project-types.md` §8's own "published immediately" clone-pipeline step), **no `WorkflowDefinition` anywhere has ever had, or could ever get, a second version** — confirmed by grep: no `createWorkflowVersion`/`createNewDraftVersion`-equivalent function exists, and no route for it exists in `apps/api/src/routes/workflows.ts`.
- **This same missing primitive blocks three of this sprint's five stories**, not just one: DEVOS-133 (version diff) needs two published versions of the same definition to exist at all; DEVOS-135's own "clone-into-new-draft" phrase needs a way to create a new draft; DEVOS-136 (per-project editing) cannot let an author edit an already-published project workflow without first starting a new draft of it. **`packages/application/src/policy/create-policy.ts` already solved the identical problem for `Policy`** — "a policy is revised by drafting a new version, never by editing a published one" — computing `version: (latest?.version ?? 0) + 1` and rejecting if the latest version is already an unpublished draft. This sprint's new primitive (DEVOS-136) mirrors that exact, already-proven pattern for `WorkflowVersion` instead of inventing a new one.
- **Real task-order correction, disclosed here rather than followed blindly:** the source backlog document's own DEVOS-133/135 acceptance summaries silently assume the new-draft-version primitive already exists (it doesn't) and sequences them (133, 134, 135) _before_ DEVOS-136, which is what actually builds it. This sprint executes DEVOS-136 **first** (it is also the backlog's own highest-priority P0 story), then DEVOS-134 (no dependency on the new primitive), then DEVOS-133 and DEVOS-135 (both now buildable), then DEVOS-137 last (needs everything). Task IDs are kept exactly as the source document assigned them — only the _execution order_ changes, matching this codebase's own established "flag a real fork/gap, don't silently proceed on a false premise" discipline (e.g. Sprint 12's DEVOS-132 scope correction).
- `WorkflowDefinitionSummary` (`apps/web/src/api-client.ts`, backed by `toWorkflowDefinitionDto`, `apps/api/src/dto/workflow.ts`) carries only `id/projectId/key/name/description/createdAt/updatedAt` — no status, version count, or run-health data. DEVOS-135's library page needs an extended summary (composed from the existing `listWorkflowVersions`/run-listing endpoints, not necessarily a new database column).
- `GET /projects/:projectId/agents` already exists server-side (`apps/api/src/routes/agents.ts`) but `apps/web/src/api-client.ts` has no client function calling it (only `listProjectTypeAgents`, for templates) — DEVOS-136 needs a new `listAgents(projectId)` client function so a real project's own workflow's `AGENT_TASK` nodes can populate `agentRef` from the project's own real agents, not its type's templates.
- `validateWorkflowGraph` (`packages/domain/src/workflows/validation.ts`) does not traverse edges for execution ordering at all (referential integrity only, confirmed again by reading it directly) — confirmed by a broad repo-wide grep that **no topological-sort/path-enumeration logic exists anywhere in this codebase**. DEVOS-134's "computed paths" is genuinely new logic, not a reuse of anything the runtime engine already does — and per the Designer spec's own explicit warning (§30, honoured verbatim in DEVOS-134's own acceptance), it must not claim to guarantee runtime success.
- `RunsPage.tsx` already establishes the real, reusable patterns DEVOS-135's own acceptance names: fetching a project's workflows via `listWorkflows(projectId)` into a picker; a `setInterval`-based run-status poller that stops at a real terminal status; `listWorkflowRunsForWorkItem` for a scoped run history. DEVOS-135 reuses these verbatim rather than inventing new ones.

## In scope (DEVOS-133–137, executed in the corrected order above)

- **DEVOS-136** — the new draft-version primitive (mirroring `createPolicy`'s proven pattern) plus wiring Sprint 13's canvas/palette/inspector components to a real project's own `WorkflowDefinition`/`WorkflowVersion`.
- **DEVOS-134** — a new, explicitly-static execution-path computation (happy/failure/approval/parallel paths) over an already-validated graph.
- **DEVOS-133** — a real structural diff between two published versions of the same definition, now that a second version can exist.
- **DEVOS-135** — a workflow library page (search/filter, clone-into-new-draft via DEVOS-136's primitive, version history, run-health summary), reusing `RunsPage.tsx`'s own established patterns.
- **DEVOS-137** — a real end-to-end pilot: author a brand-new workflow entirely through the visual designer, publish it as a real immutable version, run it to completion for real.

## Out of scope / deferred

Anything E22–E27. Any change to `ProjectType` template editing (Sprint 13's own scope, unchanged). A full visual side-by-side canvas diff for DEVOS-133 (a structural before/after list is the real, scoped acceptance, matching the source backlog's own explicit narrowing). Any runtime engine change — DEVOS-134's path computation is a client/application-layer-only addition; the real dispatcher/task-queue execution model is completely unchanged.

## Sprint-wide acceptance criteria

A user can go from a blank canvas to a real, running workflow without ever touching a database seed script, a raw JSON body, or a developer — the Designer spec's own §43 acceptance criteria (structure/agents/tools/inputs-outputs/conditions/approvals/validation/publication/comparison/preview/library) fully closed for the node types E20 makes real.

## Governance

Per `AGENTS.md` §4: one task at a time, its own validation run and reported, then stop for explicit approval before the next. Real execution order: **DEVOS-136 → DEVOS-134 → DEVOS-133 → DEVOS-135 → DEVOS-137**. Decisions recorded directly in `DEVOS-BUILD-STATE.md`'s state-change-log as each task completes (no separate `DEVOS-SPRINT14-DECISIONS.md`, continuing the convention Sprint 11–13 already established).

## Task index

| ID        | Story                                                                                 | Execution order | File           |
| --------- | ------------------------------------------------------------------------------------- | --------------- | -------------- |
| DEVOS-136 | Extend the canvas to per-project workflow editing (+ the new draft-version primitive) | 1st             | `DEVOS-136.md` |
| DEVOS-134 | Execution-path preview                                                                | 2nd             | `DEVOS-134.md` |
| DEVOS-133 | Version diff                                                                          | 3rd             | `DEVOS-133.md` |
| DEVOS-135 | Workflow library page                                                                 | 4th             | `DEVOS-135.md` |
| DEVOS-137 | Real end-to-end pilot: author, publish, run                                           | 5th (last)      | `DEVOS-137.md` |
