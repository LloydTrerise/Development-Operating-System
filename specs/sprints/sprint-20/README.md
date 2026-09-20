# Sprint 20 — Reporting Foundations: Quality & Release Visibility (E24 Engineering Intelligence, part 1)

**Source:** `specs/DEVOS-ENGINEERING-INTELLIGENCE-BACKLOG.md` §6 "Sprint 20 — Reporting Foundations: Quality & Release Visibility", grounded against direct inspection of the real, current implementation (`packages/observability/src/metrics/registry.ts`, `apps/worker/src/task-dispatcher.ts`, `packages/domain/src/artifacts/artifact.ts`, `packages/database/src/repositories/artifacts.ts`, `packages/application/src/tasks/run-review-agent-task.ts`/`run-validation-task.ts`/`run-security-scan-task.ts`/`run-release-task.ts`, `packages/database/src/repositories/agent-executions.ts`'s organisation-scoped query pattern, `apps/api/src/routes/cost.ts`/`audit.ts`).
**Conversion date:** 2026-09-19
**Status:** Approved to begin (user authorization: "convert to specs and start the sprint work. Do DEVOS-163 through 171 without asking for approval. After the sprint wait for authorisation to continue.", 2026-09-19, confirmed via clarifying question that the range is DEVOS-163–171, not DEVOS-087–117).

## Goal

`specs/DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §10 named E24 with the one-line scope "DORA metrics, quality trends, bottleneck analytics, using Sprint 9–10's now-exportable metrics as the data source" but left it entirely unscoped. `specs/DEVOS-ENGINEERING-INTELLIGENCE-BACKLOG.md` found the raw data (task-timing metrics, `REVIEW_EVIDENCE`/`TEST_EVIDENCE`/`SECURITY_SCAN_EVIDENCE`/`RELEASE_EVIDENCE` artifacts, `WorkflowRun` timestamps) is real and already captured across Sprints 7–14, but has exactly the same "captured with no reporting surface" gap `DEVOS-COST-MANAGEMENT-BACKLOG.md` found for cost data pre-Sprint-17. This sprint closes that gap: a real cross-project/organisation query layer, a real API surface, and a real dashboard over data that already exists — zero new capture.

## Grounding (confirmed by direct code inspection before scoping)

- `ArtifactRepository` (`packages/domain/src/artifacts/artifact.ts`) has exactly two read methods: `getById` and `listForProject` (unfiltered, project-scoped only). `Artifact.artifactType` is a bare `string`, not a constrained union — no contract change needed to add a type filter.
- `createArtifactRepository` (`packages/database/src/repositories/artifacts.ts`) queries `artifacts` directly by `project_id`; the table already has `project_id` as a direct column (no `workflow_tasks`/`workflow_runs` hop needed, unlike the cost queries' `agent_executions` chain), so an organisation-scoped query only needs one join: `artifacts` → `projects` on `projects.organisation_id = :organisationId`.
- The organisation-scoped query precedent is proven twice: `sumEstimatedCostUsdForOrganisation`/`costBreakdownByRoleForOrganisation` (`packages/database/src/repositories/agent-executions.ts`, DEVOS-150) and `listAuditRecordsForOrganisation` (`packages/database/src/repositories/audit-records.ts`, DEVOS-147) — both real joins, never a client-side loop over every project. This sprint's own queries follow the identical shape.
- The organisation-scoped route/use-case precedent is proven twice: `getOrganisationCostReport`/`GET /organisations/:organisationId/cost-report` (DEVOS-151) and `listAuditRecordsForOrganisation`/`GET /organisations/:organisationId/audit` (DEVOS-147) — both gated by `resolveOrganisationMembership`, both `NotFoundError`-on-missing-membership. This sprint's own route follows the identical shape, at `GET /organisations/:organisationId/engineering-report`.
- `REVIEW_EVIDENCE` (`run-review-agent-task.ts`) has `decision: 'PASS' | 'CHANGES_REQUIRED'`. `TEST_EVIDENCE`/`SECURITY_SCAN_EVIDENCE` (`run-validation-task.ts`/`run-security-scan-task.ts`) have `passed: boolean`. `RELEASE_EVIDENCE` (`run-release-task.ts`) has `passed: boolean` and `action: 'deploy' | 'rollback'`. All four are stored as each `ArtifactVersion.metadata` (already-persisted `jsonb`), not new columns.
- `WorkItem.metadata.reworkCount` (untyped `Record<string, unknown>`) is incremented by `run-review-agent-task.ts`, bounded by `MAX_AUTOMATIC_REWORK_CYCLES = 2`. No repository method aggregates it today.
- `apps/web/src/pages/CostPage.tsx` and `GovernancePage.tsx` are the established page pattern this sprint's own dashboard (`EngineeringIntelligencePage.tsx`) reuses.

## Real design decisions this sprint's own grounding surfaced (recorded here, not silently assumed)

1. **No migration needed (DEVOS-163):** `artifact_type` is already a plain text column with no enum constraint; filtering by it is a `WHERE` clause, not a schema change. Metadata fields (`decision`/`passed`/`action`) live in `artifact_versions.metadata` (`jsonb`), read via Postgres's `->>`/`@>` operators, the same pattern `costBreakdownByRoleForOrganisation` already established for `agent_versions.configuration->>'role'`.
2. **A third instance of the org-scoped-join pattern, not a new one (DEVOS-163):** deliberately mirrors DEVOS-147/DEVOS-150 exactly, for consistency with the now twice-established precedent.
3. **Report shape, not a raw list (DEVOS-164):** the API returns pre-aggregated pass rates/counts/rollups (mirroring `OrganisationCostReport`'s own shape), not a bare filtered artifact array — a human-consumable report, not a second `listArtifactsForProject`.
4. **Reuses the existing page pattern (DEVOS-165):** `EngineeringIntelligencePage.tsx` is a new page alongside `CostPage.tsx`/`GovernancePage.tsx`, not a new section bolted onto an existing one — each of those prior epics made and disclosed the same choice.

## In scope (DEVOS-163–166, executed in ID order)

- **DEVOS-163** — Cross-project and organisation evidence query layer.
- **DEVOS-164** — Real project and organisation engineering-report API.
- **DEVOS-165** — Quality trends dashboard UI.
- **DEVOS-166** — Validation, documentation, and gap disclosure.

## Out of scope / deferred

DORA metrics (deployment frequency, change failure rate, lead time, time-to-restore) and bottleneck analytics — deferred to Sprint 21 (`specs/sprints/sprint-21/`), which depends on this sprint's own query layer. Structured security-scan output parsing (vulnerability counts/severities) — no story anywhere in this sprint or Sprint 21 adds it (see the backlog document's own §9). Any part of E25–E27.

## Sprint-wide acceptance criteria (from the backlog's own exit criteria)

A real organisation's real accumulated review/test/security/release evidence across more than one of its projects is shown correctly in the new dashboard, matching a direct Postgres query of the same underlying artifacts.

## Governance

Per `AGENTS.md` §4 and the user's standing authorization ("Do DEVOS-163 through 171 without asking for approval"), this sprint and Sprint 21 proceed end-to-end without per-task pauses. Full monorepo validation runs at the end of each task; any real gap found is disclosed here or in `DEVOS-BUILD-STATE.md`, never silently patched. The user must give explicit authorization before any further epic/sprint begins after DEVOS-171 completes, per their own explicit instruction.

## Task index

| ID        | Story                                                | File           |
| --------- | ---------------------------------------------------- | -------------- |
| DEVOS-163 | Cross-project and organisation evidence query layer  | `DEVOS-163.md` |
| DEVOS-164 | Real project and organisation engineering-report API | `DEVOS-164.md` |
| DEVOS-165 | Quality trends dashboard UI                          | `DEVOS-165.md` |
| DEVOS-166 | Validation, documentation, and gap disclosure        | `DEVOS-166.md` |
