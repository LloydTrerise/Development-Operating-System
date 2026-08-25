# Sprint 8 — POC Hardening, Pilot & Production Readiness

**Historical source:** `Analysis/DevOS_POC_Sprint_8_Implementation_Tasks_v1.0.docx`
**Conversion date:** 2026-08-24

## Goal

Harden the POC, run a realistic pilot, and establish the path to production (source §1–§2).

## Architecture

Unlike Sprints 1–7 (each adding a new capability), Sprint 8 is entirely a hardening/verification/wrap-up pass across the reference workflow Sprint 6 completed and Sprint 7 secured/instrumented. Several of its eleven tasks are analysis or process deliverables rather than pure feature-builds (DEVOS-100 pilot execution, DEVOS-101 remediation, DEVOS-102 acceptance review, DEVOS-103 roadmap) — this mirrors DEVOS-091's own precedent (Sprint 7's security review), not a new pattern.

## Task authority

The task files in this directory are concise, version-controlled conversions of the historical developer-ready specification, following the exact conversion pattern used for Sprints 2–7. As with every prior sprint's source document, the per-task implementation-instructions/acceptance-criteria/DoD boilerplate is identical word-for-word across all eleven tasks; the substantive scope per task is the one-line description in the source backlog table. Each task file below grounds that line against the real, current state of the codebase — confirmed by direct inspection before writing, not assumed.

**Spec-grounding gaps and real, existing-code gaps, flagged up front:**

- **A real reliability bug, found while grounding DEVOS-094**: `TaskQueue.complete()`/`fail()` (`packages/database/src/repositories/task-queue.ts`) update a task row by `id` alone — no check that the row is still `RUNNING` under the same `attempt` the caller believes it holds. Combined with `reclaimStale()` judging staleness purely from `started_at` (never renewed while a handler is genuinely still working), a task whose real handler runs longer than `staleThresholdMs` gets incorrectly reclaimed and reprocessed by another worker while the original worker is still alive — and the original worker's eventual `complete()`/`fail()` call then silently clobbers whatever the second worker already recorded, with no fencing at all. This is a real, currently-live correctness gap, not a hypothetical one.
- **A real validation gap, found while grounding DEVOS-096**: `validateWorkflowGraph` (`packages/domain/src/workflows/validation.ts`) checks node shape and that `edges` is an array, but never checks for duplicate node ids, that an edge's `from`/`to` reference declared node ids, or that an `AGENT_TASK` node carries a non-empty `agentRef` — the last of which currently only fails at run time (`run-agent-task.ts` throws `"Task ... has no agentRef configured"` after a run has already started), not at publish time when the mistake is cheap to catch.
- **DEVOS-097's real scope, without a live model API key this session**: the existing `agent-fixtures-regression.test.ts` (DEVOS-037) only proves the recorded fixture chain still plumbs through schema validation and artifact chaining — it asserts nothing about output *quality* (whether a response is actually relevant to its input, not just shaped correctly). No `GEMINI_API_KEY` is available in this session (same limitation DEVOS-089 hit and disclosed), so this task adds content-relevance assertions to the *existing*, already-real recorded fixtures rather than fabricating new "recorded" ones that were never actually from a live call.
- **DEVOS-098 builds on, not duplicates, DEVOS-089**: usage/cost *recording* already exists; this task is specifically the enforcement/alerting half explicitly deferred at that task (`specs/api/poc-api-contracts.md` §51's "advanced cost/budget contracts," and DEVOS-089's own decision log) — now explicitly in scope because Sprint 8's own backlog names it. Scoped to a real, checkable per-project budget threshold and a real alert record (reusing DEVOS-090's existing governance "risk activity" surface), not a payment/billing system.
- **DEVOS-099/100 stay within this sprint's own carried-forward scoping decisions**: no real cloud/hosting provider deployment exists anywhere in this codebase (carried forward from Sprint 4–7 unchanged) — a "pilot environment" here means a real, reproducible, isolated local environment (its own Postgres schema/seed profile, real local git repositories), not a fabricated cloud deployment. "Pilot execution" means running the real reference workflow against that real environment and honestly reporting what happened, not a synthetic demo.
- **DEVOS-102/103 are analysis/documentation deliverables**, mirroring DEVOS-091's own precedent — not new application code, though any real defect either surfaces is fixed and tested like any other finding.
- **User-authorized scoping decisions, carried forward from Sprints 4–7 unchanged:** no real GitHub API calls, no real external deployment/hosting provider calls, no real distributed metrics/tracing backend.

## In scope

Performance baselining with real, queryable numbers; a real task-queue fencing fix so a slow-but-alive worker's task is never silently duplicated or clobbered; workflow-graph validation hardening (duplicate ids, dangling edges, missing `agentRef`); agent output quality assertions beyond schema shape; a real per-project cost budget with a real alert; a reproducible local pilot environment; a real pilot run against it with an honest report; remediation of whatever that pilot surfaces; a written POC acceptance review; a written production-readiness roadmap consolidating every sprint's accumulated verification debt.

## Out of scope / deferred

General-purpose autonomous engineering; large-scale service decomposition unless the pilot proves a real need (source §4, verbatim). Also out of scope, continuing every prior sprint's carried-forward decisions: real GitHub API calls, real external deployment/hosting provider calls, a real external metrics/tracing backend, a real payment/billing cost-control system.

## Sprint-wide acceptance criteria

- Real baseline latency numbers exist for workflow/task/agent/tool execution, captured from the real metrics registry against a real run.
- A slow-but-alive worker's task can no longer be silently duplicated or have its real completion clobbered by a stale reclaim.
- A workflow graph with a duplicate node id, a dangling edge, or a missing `agentRef` on an `AGENT_TASK` node is rejected at publish time, not discovered mid-run.
- At least one quality-level (not just shape-level) regression assertion exists per planning-path agent.
- A project's accumulated real cost can exceed a configured budget and produce a real, visible alert.
- A pilot environment can be stood up reproducibly from a clean state and torn down.
- A real pilot run of the reference workflow against that environment is documented, including whatever it actually found.
- Any pilot-critical defect found is fixed and covered by a regression test.
- A written POC acceptance review exists, checked against the product overview's own stated outcomes.
- A written production-readiness roadmap exists, consolidating every sprint's own carried-forward verification debt into a single prioritized gap list.

(Source §8, Sprint-Level Definition of Done, concretized against the specs above.)

## Quality gates

Real, not simulated, latency/cost numbers; a real, reproduced-before-fixing race condition for the task-fencing bug; real workflow-validation rejection tests; real (not fabricated) fixture-based quality assertions; a real pilot run against a real environment, honestly reported regardless of outcome.

## Key risks (source §11, carried forward verbatim)

- **Scope creep** — protect the vertical slice; defer non-essential platform features.
- **Architecture drift** — enforce package boundaries and contract tests.
- **Agent quality** — require structured outputs, evidence, and regression fixtures.
- **Security** — never let model output become authority.
- **Provider lock-in** — use adapters from the first implementation.
- **Reliability** — test restart, duplicate delivery, and idempotency before adding autonomy — directly relevant to DEVOS-094's own fencing fix.
- **Over-engineering** — prefer modular monolith patterns until scale proves extraction necessary; this is the explicit reason DEVOS-098 stops at a budget threshold + alert, not a full billing platform, and DEVOS-099 stays a local, reproducible environment, not a cloud deployment.

## Exit criteria

Sprint 8 — and the POC as a whole — is complete when its sprint-level Definition of Done is met, the demo (a realistic pilot change plus the complete POC acceptance checklist) can be performed in the target environment, and no critical defect or security issue remains open against the sprint goal. (Source §10, §12.)
