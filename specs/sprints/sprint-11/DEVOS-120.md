# DEVOS-120 — Real `PARALLEL`/`JOIN` node execution

**Priority:** P0 | **Estimate:** 3d
**Depends on:** DEVOS-119 (shares the `dependsOn`/terminal-status groundwork).

## Scope

A `PARALLEL` node makes every one of its declared branches' first tasks eligible concurrently (extending, not replacing, the existing `dependsOn` barrier). A `JOIN` node's task becomes eligible only once every branch it names has reached a terminal state (`SUCCEEDED`, `FAILED`, or `SKIPPED`). A configurable branch-failure policy (on the `JOIN` node's `config`) determines whether one failed branch fails the whole join or is tolerated.

## Grounding

`run-creation.ts` already creates one `WorkflowTask` per node unconditionally and computes `dependsOn` purely from declared edges — a `PARALLEL` node's own multiple outgoing edges already make every branch's first task depend only on the `PARALLEL` node itself, so concurrent eligibility falls out of the existing barrier for free once `PARALLEL`/`JOIN` have real (trivial, no-op-success) handlers registered — confirmed during implementation. `runParallelTask`/`runJoinTask` (`packages/application/src/tasks/`) do nothing but report `SUCCEEDED`; all real behavior lives in the shared queue/failure machinery below.

## Real architectural finding, resolved with explicit user approval before implementation

`resolveTaskFailure` (`packages/database/src/repositories/task-queue.ts`) — used by both `TaskQueue.fail()` and `reclaimStale()` — unconditionally calls `failRun()` on any task's permanent failure, and bulk-marks every other `PENDING` task in the run `FAILED`. Every workflow in this codebase (Sprint 1–10) implicitly depends on that "first failure kills the run" rule. A `JOIN` whose `branchFailurePolicy` is genuinely `'tolerant'` — one where the _run itself_ still reaches `COMPLETED` despite one real branch task failing — requires relaxing that rule, not just adding a `JOIN` handler. Flagged to the user before implementing (this task's own estimate assumed a config toggle, not a change to core failure semantics); user chose the full real semantics over a narrower "tolerate `SKIPPED` only" scope.

**Resolution implemented, deliberately bounded (not a general graph-reachability engine):** a permanently-failed task's failure counts as "tolerated" — skip `failRun()`/the bulk sibling-fail — **only if every one of its own outgoing edges leads directly to a `JOIN` node whose `config.branchFailurePolicy` is `'tolerant'`**, and it has at least one outgoing edge (a leaf task with none is never tolerated — guards the vacuous-truth case). Every other case (no tolerant path, strict policy, or no `PARALLEL`/`JOIN` in the graph at all — every existing Sprint 1–10 workflow) is byte-for-byte the existing behavior; zero regression risk for anything that predates this task. A task blocked behind the failed branch through some path _other than_ the tolerant `JOIN` itself is explicitly out of scope (none exists in this sprint's own target graph shapes) — true multi-hop/general reachability is DEVOS-123's territory, not this task's.

`claimNext()`'s barrier gains a second, opt-in mode: a `JOIN` task created from a `tolerant`-policy node carries `input.dependsOnTerminalOnly: true` (set in `run-creation.ts`), under which its named `dependsOn` upstreams need only reach _any_ terminal status (`SUCCEEDED`/`FAILED`/`SKIPPED`), not specifically `SUCCEEDED` — every other task's barrier is completely unchanged (still `SUCCEEDED`-only). `maybeCompleteRun`'s "every task must be terminal-ok" check accepts `FAILED` alongside `SUCCEEDED`/`SKIPPED` — safe because this function's own existing `run.status !== 'PENDING'` guard already short-circuits the instant a _non_-tolerated failure has called `failRun()`.

## Out of scope

Nested `PARALLEL`/`JOIN` pairs beyond one level (not required by DEVOS-124's incident-response graph, Sprint 12). Dynamic (runtime-determined) branch counts. General multi-hop failure-tolerance reachability beyond the direct-edge-to-tolerant-JOIN check above (DEVOS-123).

## Acceptance

A real graph with a `PARALLEL` node fanning into 2+ branches and a `JOIN` node reconverging them runs to completion for real against Postgres — once with every branch succeeding, and once with one branch deliberately, permanently failing under both a tolerant `JOIN` (run reaches `COMPLETED`, the failed branch's own task stays `FAILED`) and a strict `JOIN` (run reaches `FAILED`, matching every pre-existing workflow's behavior), proving the policy actually changes the run's real outcome, not just the `JOIN` task's own local eligibility.
