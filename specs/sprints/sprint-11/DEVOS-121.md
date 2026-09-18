# DEVOS-121 — Real `WAIT` node execution

**Priority:** P1 | **Estimate:** 2d
**Depends on:** DEVOS-119 (terminal-status/handler-registration groundwork).

## Scope

A `WAIT` node supports at minimum a time-based wait (resume after a configured duration) and a dependency-based wait (resume once a named upstream artifact/task exists), reusing the existing task-queue/dispatcher polling model — no new scheduler subsystem.

## Grounding

`workflowTaskStatuses` already includes `WAITING` (`packages/contracts/src/status.ts`) — unlike `SKIPPED` (DEVOS-119), this one is real and pre-existing, confirmed by direct read; confirmed by grep during implementation to be genuinely unused by any real code path before this task. Every other task's flow was `RUNNING` -> `complete()`/`fail()` only — `WAITING` needed a third real outcome the dispatcher (`task-dispatcher.ts`) didn't have a path for yet.

## Design implemented

A `WAIT` handler reports "not ready yet" by returning a reserved `waitUntil` (ISO timestamp) output key instead of a normal completion — `task-dispatcher.ts`'s `processNext()` checks for it and calls a new `TaskQueue.markWaiting()` (RUNNING -> `WAITING`, storing `{ waitUntil }` in the task's own `output`, same attempt-fencing contract as `complete()`/`fail()`) instead of `complete()`. A new `TaskQueue.resumeReadyWaits()` — called from the exact same periodic tick that already runs `reclaimStale()` in the dispatcher's loop, no separate timer — finds every `WAITING` task whose recorded `waitUntil` has passed and resets it to `PENDING`, so `claimNext()` hands it back to the same handler for a real re-check. Both existing fake `TaskQueue`s in `apps/worker/tests/task-dispatcher.test.ts` were updated for the two new interface methods.

Both variants share this one mechanism, differing only in what each computes/re-checks:

- **`config: { waitType: 'duration', durationSeconds: number }`** — the first call (no `waitUntil` yet in this task's own `output`) reports one `waitUntil = now + durationSeconds`; by the time `resumeReadyWaits()` ever resurfaces it, real time has already passed, so the second call just completes.
- **`config: { waitType: 'dependency', taskKey: string, pollIntervalSeconds?: number }`** — every call actually checks whether the named upstream task's own output already carries an `artifactId` (the same convention `run-condition-task.ts`'s artifact-source rule already uses via `resolveUpstreamTask`); if not, it reports a short `waitUntil` (default 1s) so it gets re-checked again soon. Deliberately does **not** require a graph edge from the named task to the `WAIT` node — the point of this variant is polling for a real-world condition that isn't already covered by the existing structural `dependsOn` barrier (an edge would make this variant redundant with the barrier itself, since the `WAIT` node would then never even be claimable before the named task finished).

`validateWorkflowGraph` now requires a `WAIT` node's `config.waitType` to be `'duration'` (with a positive `durationSeconds`) or `'dependency'` (with a non-empty `taskKey`), mirroring the `CONDITION`/`JOIN` config checks already added this sprint.

## Out of scope

An external event-driven wait (e.g., waiting on a webhook). A `WAIT` with no bound (must always have either a duration or a named dependency) — enforced by the validation above.

## Acceptance

A real graph with a time-based `WAIT` node resumes and completes only after its configured duration has actually elapsed (proven by a real elapsed-time assertion against `Date.now()`, not a mocked clock). A real graph with a dependency-based `WAIT` node — deliberately with no graph edge to the task it names, so it must genuinely poll rather than rely on the structural `dependsOn` barrier — resumes only once that named task's own output actually carries an artifact reference, proven against real Postgres.
