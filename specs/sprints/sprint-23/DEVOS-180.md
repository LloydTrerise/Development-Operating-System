# DEVOS-180 — Real end-to-end pilot: share, install, quality-aware dispatch

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-177, DEVOS-178, DEVOS-179.
**Depended on by:** DEVOS-181 (validation closes the sprint after this).

## Scope

Two real scenarios: (1) a real agent shared and installed across two real, same-organisation projects, dispatching successfully; (2) a real quality-aware selection outcome, changed by real data for the first time in this codebase.

## Implementation

- A real pilot (new `tests/e2e/agent-platform-marketplace-pilot.test.ts`, mirroring this codebase's established pilot convention): a real organisation with two real projects; a real published, shared agent in project A; a real install into project B; a real workflow run in project B dispatches to the installed agent successfully.
- Separately: two real candidate agents in one project, same role/capability, with genuinely different DEVOS-174 pass rates (via real `CODE_CHANGE`/`REVIEW_EVIDENCE` fixtures); a real multi-candidate run confirms `selectAgentForTask` picks the real higher-pass-rate candidate — independently confirmed via a direct Postgres query joining `workflow_tasks` → `agent_executions` → `agent_versions`.
- All test data (organisations/projects reused from seed where possible, or created and fully cleaned up) confirmed via a follow-up query.

## Out of scope

Anything beyond confirming DEVOS-177/178/179 work together for real.

## Acceptance

Both real scenarios pass, independently confirmed against direct Postgres queries. `pnpm --filter @devos/e2e-tests typecheck` green; both pilot tests pass against real Postgres.
