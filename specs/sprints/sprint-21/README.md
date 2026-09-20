# Sprint 21 — DORA Metrics & Bottleneck Analytics (E24 Engineering Intelligence, part 2)

**Source:** `specs/DEVOS-ENGINEERING-INTELLIGENCE-BACKLOG.md` §6 "Sprint 21 — DORA Metrics & Bottleneck Analytics", grounded against direct inspection of the real, current implementation (`apps/api/src/routes/artifacts.ts`'s `getArtifactProvenance` (DEVOS-095), `apps/worker/src/task-dispatcher.ts`'s existing `workflow_task.duration_ms` histogram emission, `packages/observability/src/metrics/prometheus-format.ts`).
**Conversion date:** 2026-09-19
**Status:** Approved to begin (user authorization: "Do DEVOS-163 through 171 without asking for approval. After the sprint wait for authorisation to continue.", 2026-09-19).

## Goal

Sprint 20 built the reporting surface. This sprint computes the source backlog's own named DORA metrics — deployment frequency, change failure rate, lead time for changes, and a disclosed time-to-restore proxy — plus a first, deliberately bounded step toward genuine bottleneck analytics (today's task-duration metrics are labelled only by coarse `taskType`, not by workflow). All four DORA metrics are computed from data Sprint 1–14 already captures; the only new capture in this whole epic is one additive metric label (DEVOS-170).

## Grounding (confirmed by direct code inspection before scoping)

- **Corrected during DEVOS-168's own implementation:** `getArtifactProvenance` (`packages/application/src/artifacts/get-artifact-provenance.ts`, DEVOS-095) does **not** actually walk `derivedFromArtifactId` — it only returns an artifact's own `workflowRunId`/`workflowTaskId`, confirmed by direct inspection, not assumed. The real chain is simpler than this line originally claimed: every evidence-writing task handler (`run-validation-task.ts`/`run-security-scan-task.ts`/`run-review-agent-task.ts`/`run-release-task.ts`) independently sets `derivedFromArtifactId` to the _same_ project's latest `CODE_CHANGE` artifact directly — a flat one-hop fan-out, not a multi-hop chain `getArtifactProvenance` or anything else needed to walk. `CODE_CHANGE` artifacts carry a real `commitSha` and `generatedAt`; `RELEASE_EVIDENCE` artifacts carry `passed`/`action`/`completedAt`/`derivedFromArtifactId` — a lead-time computation is a one-hop `Map` lookup over rows DEVOS-163's own generic evidence query already fetches, not a provenance walk.
- `apps/worker/src/task-dispatcher.ts`'s `processNext()` emits `metrics?.observeHistogram('workflow_task.duration_ms', Date.now() - startedAt, labels)` with `labels = { taskType: task.taskType }` only — no `workflowVersionId`, no node id. `task` (`WorkflowTask`, claimed via `queue.claimNext()`) already has a `workflowRunId` in scope at that point; resolving it to a `workflowVersionId` needs one additional lookup this task adds.
- `formatPrometheusText` (`packages/observability/src/metrics/prometheus-format.ts`) serializes whatever labels a metric key carries with no special-casing per label name — adding a new label requires no change to the exporter itself, only to the one call site that constructs `labels`.
- No timestamp anywhere in this codebase distinguishes "incident detected" from "incident work item created" or "release failed" from "release marked failed" — confirmed by grep across `WorkItem`/`RELEASE_EVIDENCE`/audit-record shapes. A true MTTR figure has no real data source; this sprint computes only the disclosed proxy `specs/DEVOS-ENGINEERING-INTELLIGENCE-BACKLOG.md` §2/§6 names.

## Real design decisions this sprint's own grounding surfaced (recorded here, not silently assumed)

1. **Pure functions in `@devos/domain`, not inline in a use case (DEVOS-167/168/169):** mirrors `computeExecutionPaths`/`diffWorkflowVersions`/`selectAgentForTask`'s own established pattern — a real, unit-testable function with no I/O, called by an application-layer use case that supplies the real rows.
2. **`workflowVersionId`, not full per-node labels (DEVOS-170):** a deliberately bounded first step. Per-node-id labelling would multiply this metrics registry's own in-memory label-combination cardinality far more (every node of every version of every workflow, vs. one label per version) — flagged as a real, disclosed limitation of this sprint's own scope, not silently expanded to cover it.
3. **Time-to-restore is presented as two distinct, separately labelled figures, not one blended number (DEVOS-169):** a release-based proxy (any project) and an incident-work-item-based proxy (Incident Response `ProjectType` only) measure genuinely different things and must not be averaged together into a single misleading figure.

## In scope (DEVOS-167–171, executed in ID order)

- **DEVOS-167** — Deployment frequency and change failure rate.
- **DEVOS-168** — Lead time for changes via provenance walk.
- **DEVOS-169** — Time-to-restore proxy (disclosed).
- **DEVOS-170** — Richer task-duration labels for bottleneck analytics.
- **DEVOS-171** — DORA/bottleneck dashboard UI, real end-to-end pilot, and validation.

## Out of scope / deferred

Full per-node bottleneck attribution (§9 of the backlog document — a real, larger cardinality tradeoff deferred, not dropped). Structured security-scan output parsing. Any external BI/analytics tool integration. Automatic policy/gate changes based on computed metrics (E27's own named scope). A real incident-detection/paging system. Any part of E25–E27.

## Sprint-wide acceptance criteria (from the backlog's own exit criteria)

A real organisation's real deployment history produces correct deployment-frequency/change-failure-rate/lead-time figures, a real incident work item or failed release produces a correctly labelled time-to-restore proxy, and a real slow workflow definition is correctly identified as the current p50/mean outlier — all independently confirmed against direct Postgres queries.

## Governance

Continues Sprint 20's standing end-to-end authorization. After DEVOS-171 completes with full validation, work stops and waits for the user's explicit authorization before any further epic/sprint begins, per their own explicit instruction.

## Task index

| ID        | Story                                                               | File           |
| --------- | ------------------------------------------------------------------- | -------------- |
| DEVOS-167 | Deployment frequency and change failure rate                        | `DEVOS-167.md` |
| DEVOS-168 | Lead time for changes via provenance walk                           | `DEVOS-168.md` |
| DEVOS-169 | Time-to-restore proxy (disclosed)                                   | `DEVOS-169.md` |
| DEVOS-170 | Richer task-duration labels for bottleneck analytics                | `DEVOS-170.md` |
| DEVOS-171 | DORA/bottleneck dashboard UI, real end-to-end pilot, and validation | `DEVOS-171.md` |
