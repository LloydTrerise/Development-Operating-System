# DEVOS-214 — Runs restyle

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** none.
**Depended on by:** DEVOS-215 (the run-scoped approval UI is added to the restyled `RunCard`).

## Scope

Restyle `RunsPage.tsx`'s per-run display (currently one flat card per run: a linear task list with inline agent/tool-invocation details, plus stacked accordions) into a mockup-inspired master/detail layout, split into `features/runs/` sub-components as the backlog's own acceptance text explicitly allows. Same real data/logic — `getRun`, `listRunTasks`, `listAgentExecutionSummaries`, `listToolInvocationSummaries`, `listArtifacts`, `getArtifactVersion`, `getReleaseReadiness` are all reused unchanged.

## Implementation

- New `apps/web/src/features/runs/RunPipelineHeader.tsx`: a horizontal step sequence built from the run's own ordered `tasks` list (each task's `nodeId` as the step label, `status` driving the step's color/icon via the same status semantics `StatusChip` already uses) — the one real per-run "stage-like" sequence that exists (see README grounding on why a fabricated separate stage concept is not introduced).
- New `apps/web/src/features/runs/RunTaskList.tsx`: the master list — a dense, clickable list of the run's tasks (replacing the current flat `List`), selecting a task for detail.
- New `apps/web/src/features/runs/RunTaskDetail.tsx`: the detail pane for the selected task — agent execution (role, prompt reference, context manifest, output), tool invocations, and the task's own error, exactly the content `RunCard` already renders inline today, just scoped to one selected task at a time instead of all tasks stacked.
- `apps/web/src/features/runs/RunCard.tsx` (moved out of `RunsPage.tsx`): composes `RunPipelineHeader` + `RunTaskList`/`RunTaskDetail` (master/detail row) above the existing Artifacts/Test evidence/Review evidence/Release readiness accordions, which are preserved unchanged.
- `RunsPage.tsx`: orchestration only — the "Start a run" form, the "Runs started this session" list, and the "Work item timeline" list, each rendering the restyled `RunCard`. No change to `runs`/`workItemRuns` state logic (the pre-existing session-only/per-work-item-timeline limitation is re-disclosed in this sprint's README, not fixed — see Out of scope).

## Out of scope

A project-wide "list all runs for this project" route/UI (a real, separate, pre-existing gap — re-disclosed in the README, not this task's scope). A fabricated stage/milestone entity distinct from the run's own task list. Any change to run polling behavior (`POLL_INTERVAL_MS`, terminal-status detection) — restyle only.

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check: a real running run shows its real pipeline header reflecting real task statuses, the master task list is clickable and shows the correct task's real detail (agent output / tool invocations) in the detail pane, and the existing Artifacts/evidence/readiness accordions still render their real data unchanged.

## Actual results

`pnpm --filter @devos/web typecheck lint build` clean. Split into `apps/web/src/features/runs/{RunPipelineHeader,RunTaskList,RunTaskDetail,RunCard}.tsx`, with `RunsPage.tsx` reduced to orchestration only. Real dev-server check against real runs in the seeded project (both a freshly-started single-task run and a real completed 3-task `development → validation → review` run): the pipeline header renders one step per real task with correct status-driven coloring/icons; the master task list is clickable and the detail pane correctly shows the selected task's real agent output (role, prompt reference, context manifest, JSON output) and tool invocations (capability key, status, evidence reference); the pre-existing Artifacts/Test evidence/Review evidence/Release readiness accordions render unchanged below. Confirmed in both light and dark mode with zero console errors.
