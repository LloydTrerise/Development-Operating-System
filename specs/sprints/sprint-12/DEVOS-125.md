# DEVOS-125 — New "Incident Response" `ProjectType` + templates

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-124 (graph design).

## Scope

A new seeded `ProjectType` (`key: 'incident-response'`) with one `ProjectTypeWorkflow` template (DEVOS-124's graph) and **zero** `ProjectTypeAgent` templates, created through the existing, unmodified clone pipeline (`specs/architecture/organisations-and-project-types.md` §7/§8) — the first real proof that pipeline generalizes beyond the single "Software Development" type it has only ever cloned until now, and (per `README.md`'s flagged decision) a stronger proof precisely because this type's node/agent mix is genuinely different, not a relabelled copy.

## Grounding

`packages/database/src/seed.ts`/`seed-constants.ts` already seed the one `software-development` `ProjectType` plus its 4 `ProjectTypeWorkflow` and 6 `ProjectTypeAgent` rows (`specs/architecture/organisations-and-project-types.md` §7 step 2–4). This task adds a second, sibling `ProjectType` the same way — new fixed seed-constant ids, new `ON CONFLICT DO NOTHING` inserts in `seed.ts`, following the exact existing pattern — not a new migration or schema change (the `project_types`/`project_type_workflows`/`project_type_agents` tables already exist and are type-agnostic).

## Implementation

1. `packages/database/src/seed-constants.ts`: add `SEED_INCIDENT_RESPONSE_PROJECT_TYPE_ID`, `SEED_INCIDENT_RESPONSE_WORKFLOW_GRAPH` (DEVOS-124's graph, verbatim), `SEED_PT_INCIDENT_RESPONSE_WORKFLOW_ID`.
2. `packages/database/src/seed.ts`: insert the new `project_types` row (`key: 'incident-response'`, `status: 'ACTIVE'`) and the one new `project_type_workflows` row under it — mirroring the existing software-development insert blocks exactly.
3. `packages/application/src/tasks/`: the three new handlers DEVOS-124 named (`run-diagnose-incident-task.ts`, `run-notify-stakeholders-task.ts`, `run-incident-log-task.ts`), each exported from `packages/application/src/index.ts`.
4. `apps/worker/src/tool-task-router.ts`: three new `case` branches in `routeToolTask`'s switch, dispatching to the three new handlers by their taskKey (`diagnose`/`notify`/`incident-log`) — `remediation`'s `rollback` taskKey already routes to the existing `runReleaseRollbackTask` unchanged.
5. `packages/domain/src/workflows/validation.ts`: no new validation rules required — `CONDITION`/`JOIN`/`WAIT`/`APPROVAL` node config validation already covers every node type this graph uses (confirmed by reading the file: DEVOS-119–122 already added exactly these checks).

## Out of scope

Any UI for creating an `incident-response`-typed project — the existing generic "create project" flow (already accepting a `projectTypeId`, per `specs/architecture/organisations-and-project-types.md` §8 step 1) is reused unchanged; no new web UI is required or built.

## Acceptance

Seeding runs cleanly (`ON CONFLICT DO NOTHING`, matching every existing seed row) and produces exactly one new `ProjectType` (`incident-response`) with one `ProjectTypeWorkflow` and zero `ProjectTypeAgent` rows — confirmed by a real query against real Postgres after running the seed script. `pnpm --filter @devos/database build` and the package's own existing tests stay green with no changes needed beyond the new seed content.

## Real finding disclosed during implementation

`runReleaseRollbackTask` (reused unchanged for the `rollback` node) calls `performRelease`, which requires the project to have either a real `Deployment` integration or a real `Git` integration (`repositoryPath`/`releaseEnvironment`/`stagingRoot` configured) — confirmed by reading `resolveReleaseTarget` in `run-release-task.ts` directly. This is not a gap in this task's own scope (the handler is reused genuinely unchanged, as designed), but it means DEVOS-126's pilot project needs one of these integrations registered before its high-severity run can reach `remediation` successfully — the same precondition every prior sprint's release/rollback pilot already required, not a new one this sprint introduces.

## Real validation performed

- `pnpm --filter @devos/domain build`, `pnpm --filter @devos/application build`/`typecheck`/`lint`/`test` (227/227 existing tests green, no regressions), `pnpm --filter @devos/database typecheck`/`build`, `pnpm --filter @devos/worker typecheck`/`build`, `pnpm --filter @devos/database lint`/`pnpm --filter @devos/worker lint` — all clean.
- `pnpm --filter @devos/database migrate`/`seed` run for real against real Postgres (`docker-postgres-1`); a real query confirms exactly one new `project_types` row (`incident-response`, `ACTIVE`), one new `project_type_workflows` row under it, and zero `project_type_agents` rows for it.
- `validateWorkflowGraph(SEED_INCIDENT_RESPONSE_WORKFLOW_GRAPH)` returns zero issues when run for real against the built `@devos/domain` package — confirming this task's own claim that no new validation rules were needed.

**DEVOS-125 is COMPLETE.**
