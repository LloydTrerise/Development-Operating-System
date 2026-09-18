# Sprint 12 — A Second Workflow Type, Proven For Real (E20 Workflow Expansion, part 2)

**Source:** `specs/DEVOS-WORKFLOW-EXPANSION-AND-DESIGNER-BACKLOG.md` §6 "Sprint 12 — A Second Workflow Type, Proven For Real", grounded against direct inspection of the real, current implementation (this codebase's own `packages/application/src/tasks/run-condition-task.ts`, `run-parallel-task.ts`, `run-join-task.ts`, `run-wait-task.ts`, `run-approval-task.ts`, `packages/domain/src/workflows/validation.ts`, `apps/worker/src/agent-task-router.ts`/`tool-task-router.ts`, and `specs/architecture/organisations-and-project-types.md` §7/§8's clone pipeline).
**Conversion date:** 2026-09-18
**Status:** **COMPLETE** — DEVOS-124–127 all complete, per explicit user approval at each step ("proceed"). See `DEVOS-BUILD-STATE.md`'s 2026-09-18 state-change-log entries for full real evidence.

## Goal

Sprint 11 made `CONDITION`/`PARALLEL`/`JOIN`/`WAIT`/`APPROVAL` real, but every proof of that so far is a hand-built test graph, and the clone pipeline (`specs/architecture/organisations-and-project-types.md` §8) has only ever cloned one `ProjectType` ("Software Development") with one fixed 4-workflow/6-agent shape. This sprint proves both generalize by building and running a second, genuinely different workflow type — "Incident Response" — that exercises every Sprint 11 primitive together in one real graph, seeded as a new `ProjectType` template cloned through the same, unmodified pipeline.

## Grounding (confirmed by direct code inspection before scoping)

- `ConditionRule`'s `source: 'variable'` reads a dot-path out of the run's own `input` (`run-condition-task.ts`) — the mechanism this sprint's severity branch uses. **Correction to the source backlog document's own DEVOS-119 acceptance-summary prose:** the implemented `CONDITION` node config supports exactly two branches (`whenTrue`/`whenFalse`), not the ">2-way `cases` map" DEVOS-119's own spec file (`specs/sprints/sprint-11/DEVOS-119.md`) flagged as an assumption — confirmed absent from `run-condition-task.ts` by direct reading. This sprint's graph is designed around the real two-branch mechanism, not the never-built `cases` variant.
- `JOIN`'s `config.branchFailurePolicy: 'tolerant'` (DEVOS-120) and `WAIT`'s `config.waitType: 'duration'` (DEVOS-121) are both real and unit/e2e-tested, but only ever exercised in Sprint 11's own linear/two-branch test graphs — never together, and never behind a `PARALLEL` split with more than two branches feeding one `JOIN`. This sprint's graph is a real structural step up in shape complexity.
- `routeToolTask` (`apps/worker/src/tool-task-router.ts`) dispatches a `TOOL_TASK` by literal `task.taskKey` (the node's own graph id) — adding a new `TOOL_TASK` node type to a workflow requires adding a new `case` there and a new handler function, the same mechanical pattern every one of `validation`/`security-scan`/`release-readiness-check`/`release`/`rollback`/`closure` already follows. Two of those handlers (`runValidationTask`, `runSecurityScanTask`) additionally clone a real Git repository and call `invokeTool` through the Tool Gateway; the other four (`runReleaseReadinessCheckTask`, `runReleaseTask`, `runReleaseRollbackTask`, `runClosureTask`) are pure deterministic application-layer logic with no Git checkout and no Tool Gateway involvement at all — confirmed by reading each file directly.
- `routeAgentTask` (`apps/worker/src/agent-task-router.ts`) dispatches an `AGENT_TASK` by the resolved agent version's `configuration.role` against a fixed `ROLE_HANDLERS` map of exactly six roles (`DISCOVERY`/`REQUIREMENTS`/`TECHNICAL_DESIGN`/`PLANNING`/`DEVELOPMENT`/`REVIEW`), each bound to its own purpose-built handler function that reads specific prior-stage artifacts and publishes a specific artifact type. A genuinely new role (e.g. the source backlog document's own example, `INCIDENT_TRIAGE`) has no handler today — adding one is a new LLM-backed agent build (prompt, output schema, fixture, handler), comparable in scope to a Sprint-2-style task, not a small addition.
- `specs/architecture/organisations-and-project-types.md` §8 step 5 ("for every `ProjectTypeAgent` under the type, create an `Agent`...") is unconditionally correct for a type with **zero** `ProjectTypeAgent` rows — the loop simply does nothing. Confirmed by reading the clone pipeline spec directly: nothing about it assumes a non-empty agent template set.
- `SEED_TOOL_CAPABILITIES` (`packages/database/src/seed-constants.ts`) backs the Tool Gateway's `allowedCapabilities` enforcement (DEVOS-085) — only relevant to a `TOOL_TASK` handler that itself calls `invokeTool`. A handler that never calls `invokeTool` needs no new `tool_capabilities` row.

## Real scope decision this sprint makes explicit (flagged, not silently picked)

**No new agent role is introduced in Sprint 12 — confirmed by the user ("i dont want a real new agent role built this sprint", 2026-09-18).** The source backlog document's own DEVOS-124 acceptance summary names `INCIDENT_TRIAGE` only as an _example_ of "the new agent role(s) it needs," not a mandate, and its own §134 explicitly permits a disclosed local-staging-equivalent substitute over inventing new real capability "unless the user explicitly authorizes one" — Sprint 12's own stated objective (prove the engine primitives generalize) does not require a new LLM-backed agent to be true. Building one for real (prompt, output schema, Gemini fixture, a new `ROLE_HANDLERS` entry, its own artifact-consumption contract) is comparable in size to Sprint 2's own agent work and is not necessary to prove any of `CONDITION`/`PARALLEL`/`JOIN`/`WAIT`/`APPROVAL`. The Incident Response workflow below therefore uses zero `AGENT_TASK` nodes and zero `ProjectTypeAgent` templates — which is itself a _stronger_, not weaker, proof that the clone pipeline generalizes (a type with a completely different node/agent mix, not just relabelled agents).

Two smaller, same-pattern decisions, disclosed alongside it:

- The three new `TOOL_TASK` handlers this sprint adds (`diagnose`, `notify`, `incident-log` — DEVOS-125) follow the `runReleaseReadinessCheckTask`/`runClosureTask` pattern (pure deterministic logic, real Postgres/artifact-storage writes, no Git checkout, no Tool Gateway) rather than the `runValidationTask`/`runSecurityScanTask` pattern (real git clone + Tool Gateway command execution) — an Incident Response project needing a real Git integration just to diagnose or notify would be an unnecessary, unrequested dependency this sprint's own objective doesn't call for. `remediation` reuses the existing `rollback` taskKey/handler (`runReleaseRollbackTask`) completely unchanged — a real, non-fabricated capability reuse, not a new one.
- The `WAIT` node standing in for "external confirmation" uses the `duration` variant, not `dependency` — there is no real external actor in this codebase that could organically produce a "confirmation received" artifact for a `dependency` wait to poll for, and fabricating one would be exactly the kind of invented external integration §134 warns against. Disclosed as a simulated stand-in for a real external-confirmation system, the same way `createLocalStagingDeploymentProvider` (Sprint 6) discloses standing in for a real cloud deploy.

## The Incident Response workflow graph (DEVOS-124's own scoping output)

One workflow (`incident-response`), not a multi-run chain like the Software Change Workflow's four separate workflows — `APPROVAL` being a real graph node (DEVOS-122) removes the need for that older "a gate needs a run of its own" pattern entirely, since a single run can now pause mid-graph without ending.

```text
severity-check (CONDITION: run input "severity" == "high"?)
  --[branch: high]--> diagnose-and-notify (PARALLEL)
                         --> diagnose (TOOL_TASK)  --\
                         --> notify   (TOOL_TASK)  ---> diagnosis-join (JOIN, tolerant)
                                                          --> await-confirmation (WAIT, duration)
                                                               --> remediation-approval (APPROVAL)
                                                                    --> remediation (TOOL_TASK: reuses "rollback")
  --[branch: low]---> log-only (TOOL_TASK)
```

Running this graph once with `severity: "high"` exercises `CONDITION`, `PARALLEL`, a two-branch tolerant `JOIN`, a duration `WAIT`, and an `APPROVAL` node placed mid-branch (after a `PARALLEL`/`JOIN`, matching DEVOS-122's own required proof shape) — and its untaken `log-only` branch exercises DEVOS-123's `SKIPPED` propagation for real. A second real run with `severity: "low"` proves the other `CONDITION` branch: `diagnose-and-notify`/`diagnose`/`notify` reach `SKIPPED` via DEVOS-119/123's one-hop-then-cascade mechanism, but — a real finding from DEVOS-126's own live verification — `diagnosis-join` and everything after it do **not** cascade to `SKIPPED`: a tolerant `JOIN`'s handler unconditionally proceeds to `SUCCEEDED` once its dependencies reach any terminal state, so the low-severity run also creates a real approval request and requires the same decision as the high-severity run. Full node/edge/config detail, including this finding, is in `DEVOS-124.md`/`DEVOS-126.md`.

## Out of scope / deferred

Any new agent role (see the flagged decision above — revisit only if the user asks for one). A real external paging/status-page/incident-management provider (§134's own scoping discipline, carried forward from Sprint 4–9's Git/deployment precedent). `LOOP`/`SUBWORKFLOW`/`HUMAN_TASK`/`ARTIFACT`/`NOTIFICATION` node types (still not in `@devos/contracts`' `workflowNodeTypes`, unchanged from Sprint 11's own deferral). The Workflow Designer (E21, Sprints 13–14) and anything in E22–E27.

## Sprint-wide acceptance criteria

A real project of the new `incident-response` type is created through the existing, unmodified clone pipeline; two real runs of its cloned `incident-response` workflow (one `severity: "high"`, one `severity: "low"`) each run to completion against real Postgres, together exercising every Sprint 11 primitive and DEVOS-123's cascade in both directions; a real, deliberately-failing branch scenario (`notify` fails) proves the tolerant `JOIN` still lets `diagnosis-join`/downstream proceed, mirroring Sprint 11's own DEVOS-120 exit-criterion style.

## Governance

Per `AGENTS.md` §4: one task at a time (DEVOS-124 first), its own validation run and reported, then stop for explicit approval before DEVOS-125. No `DEVOS-SPRINT12-DECISIONS.md` file is planned — Sprint 11 discontinued the per-sprint decisions-doc convention in favor of recording decisions directly in `DEVOS-BUILD-STATE.md`'s state-change-log (no `DEVOS-SPRINT11-DECISIONS.md` exists either); Sprint 12 continues that.

## Task index

| ID        | Story                                             | File           |
| --------- | ------------------------------------------------- | -------------- |
| DEVOS-124 | Scope the Incident Response workflow              | `DEVOS-124.md` |
| DEVOS-125 | New "Incident Response" `ProjectType` + templates | `DEVOS-125.md` |
| DEVOS-126 | Real end-to-end pilot run                         | `DEVOS-126.md` |
| DEVOS-127 | Validation, documentation, and gap disclosure     | `DEVOS-127.md` |
