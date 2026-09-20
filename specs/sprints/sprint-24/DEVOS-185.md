# DEVOS-185 — Real end-to-end pilot: authored, used, and traced

**Priority:** P0 | **Estimate:** 1.5d
**Depends on:** DEVOS-182, DEVOS-183, DEVOS-184.
**Depended on by:** DEVOS-186.

## Scope

A real knowledge source is authored through the real API contract DEVOS-183's UI itself calls, used by a real workflow run, and its use is durably, independently confirmed — then archived and confirmed excluded from the next run.

## Implementation

- New `tests/e2e/knowledge-platform-lifecycle-pilot.test.ts`, mirroring `agent-platform-marketplace-pilot.test.ts`'s own established pattern exactly: real spawned `apps/api`+`apps/worker` (`AGENT_MODEL_ADAPTER=fixture`), a real project fixture, a real single-`AGENT_TASK` workflow run.
- Scenario: create a knowledge source via `POST /projects/:projectId/knowledge-sources`; run a real workflow (any published agent role); confirm via a direct Postgres query that a real `knowledge_references` row now exists linking the source to the real `workflow_task_id`/`agent_execution_id`; confirm `GET /knowledge-sources/:id/references` reports it. Archive the source via `POST /knowledge-sources/:id/archive`; run a second real workflow for the same project; confirm via `context_manifests`/a direct query that the archived source is not among the sources retrieved this time (unlike run 1).
- Full real row cleanup afterward, mirroring the marketplace pilot's own established FK-ordering discipline.

## Out of scope

Any Sprint 25 scenario (relevance retrieval, sharing).

## Acceptance

The new pilot test passes against the real, already-running local Postgres/Redis stack (`infrastructure/docker/docker-compose.yml`). Test data fully cleaned up afterward, confirmed by a follow-up row-count check.
