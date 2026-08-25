# Sprint 6 — Release, Post-Release & Full Workflow

**Historical source:** `Analysis/DevOS_POC_Sprint_6_Implementation_Tasks_v1.0.docx`
**Conversion date:** 2026-08-24

## Goal

Complete the Software Change Workflow through a controlled staging release and closure (source §1–§2).

## Architecture

`Release Readiness → Human Release Approval → Release/Deployment (Tool Gateway) → Post-Release Validation → Release Evidence → Failure Handling (retry/stop/rollback) → Closure`

This is Stages 11–12 of the Software Change Workflow (`specs/workflows/software-change-workflow.md` §6, §22–§23), plus the retry/failure rules (§24) and human-intervention actions (§25) that apply specifically to release. Sprint 5 ended at a deterministic release-readiness verdict (Stage 10); Sprint 6 covers everything from there through a closed, fully-evidenced run — and, per its own task list, also assembles the complete Stage 1–12 chain into one demonstrable end-to-end workflow for the first time (DEVOS-079/081), plus a workflow-timeline UI improvement (DEVOS-080).

Release is a controlled external action gated the same way development was gated behind planning approval (Sprint 4, ADR-SCW-002) and rework was resolved as a new run of the same workflow version (Sprint 5): reusing the existing `Policy`/`Approval`/`Tool Gateway` primitives rather than inventing parallel release-specific mechanisms, per this sprint's own implementation instructions ("Use existing domain/application contracts rather than introducing parallel models").

## Task authority

The task files in this directory are concise, version-controlled conversions of the historical developer-ready specification (`Analysis/DevOS_POC_Sprint_6_Implementation_Tasks_v1.0.docx`), following the exact conversion pattern used for Sprints 2–5. The source document's own per-task detail is generic boilerplate repeated verbatim across all ten tasks — the substantive scope per task is a single one-line description; each task file below grounds that one line against the actual specs and flags what the specs leave open. Per-task dependencies are inferred from the natural build order implied by the backlog sequence, not stated individually in the source.

**Spec-grounding gaps, flagged up front:**

- **No release/deployment/closure database schema exists anywhere** (`specs/database/poc-database-schema.md` has no `deployments`/`releases`/`closures` table — only the existing generic `approvals` table, whose `approval_type` column is explicitly documented as "Planning/Release/etc.," §14.2). Release approval is therefore modeled as another `Approval` row (`approval_type: 'RELEASE'`), exactly like DEVOS-045/047 already modeled planning approval — not a new table.
- **No release/deployment REST endpoints are documented anywhere** in `specs/api/poc-api-contracts.md` (the same gap DEVOS-069's release-readiness route and DEVOS-060/070's summary routes already found and worked around for their own stages) — any new routes this sprint needs are built to the task's own acceptance criterion, flagged rather than presented as literal spec text.
- **"Environment-specific release authority" (DEVOS-072) has no concrete rule shape specified anywhere.** The existing `Policy`/`evaluatePolicies` mechanism (DEVOS-043/044/048) already supports conditional rules; whether it needs a new `environment` condition dimension or can be satisfied with the existing shape is decided at DEVOS-072, not pre-decided here.
- **The deployment target is a real, but non-production, environment — continuing the Sprint 4/5 "no real external system" scoping decision.** §35's MVP configuration states "Release automation: Staging first; production controlled," and §44 (POC Boundary) states the POC should use only "staging/non-production release." No real cloud/hosting provider account exists for this project; DEVOS-074's deployment adapter is therefore built as a swappable port with a real-but-local implementation (mirroring DEVOS-058's `PullRequestProvider` precedent exactly), not a call to a real external deployment platform. This continues, not newly invents, the sprint-4-established scoping boundary.
- **The current workflow engine still materializes every task in a run up front and only completes a run once every task in it succeeds, and a human approval gate still requires starting a genuinely separate run** (found in DEVOS-061, reused in DEVOS-067). Release approval, sitting after review/release-readiness, is therefore expected to need the same separate-run pattern already used twice — decided concretely at DEVOS-073/079, not pre-decided here.
- **No numeric retry/rollback bound exists anywhere in the spec corpus** for release failure handling (§24 Retry Rules state retry must be bounded "in spirit" but no task file, ADR, or NFR states a number) — mirrors the exact same gap DEVOS-068 already had to resolve for rework, with an explicit flagged assumption expected again at DEVOS-077.
- **`packages/artifacts` remains an unactivated scaffold**, continuing the Sprint 1–5 precedent (§44 names `release-evidence.schema.ts` there; DEVOS-076's schema instead lives alongside the rest of this codebase's agent/tool schemas, not in that empty package).
- **User-authorized scoping decision, carried forward from Sprint 4/5 unchanged:** no real GitHub API calls, and (new to this sprint) no real external deployment/hosting provider calls either — every external-facing action in this sprint continues to run against real local infrastructure this repository controls (a real local git repo, a real local "staging" directory/process), never a real third-party account.

## In scope

An environment-aware release policy check, a human release-approval gate bound to release-readiness evidence (mirroring the planning-approval gate), a deployment tool capability with a real-but-local staging provider adapter, a post-release validation step, a `RELEASE_EVIDENCE` artifact, bounded release-failure handling (retry/stop/authorised rollback), a closure step that publishes the final linked evidence chain and reaches a terminal work-item/run outcome, the first fully-connected Stage 1–12 workflow definition, a workflow-timeline UI improvement, and an end-to-end proof covering the full happy path, a rework cycle, and a release failure.

## Out of scope / deferred

Uncontrolled production autonomy, multi-region release orchestration (source §4, verbatim). Also out of scope: any real external deployment/hosting provider account or API call; any real GitHub API call (carried-forward Sprint 4/5 scoping decision); production release itself (staging only, per §35/§44).

## Sprint-wide acceptance criteria

- A release cannot proceed to a target environment the release policy does not authorise (§21–§22).
- Release does not execute until a bound, attributable, auditable human approval exists for the exact release-readiness evidence being approved (§22, mirroring ADR-SCW-002).
- A real deployment action executes through the Tool Gateway against a real, local, non-production target and is recorded with action/target/revision/result/timing/outcome (§22).
- Post-release validation runs for real and its result is recorded (§21 "Smoke/health validation," source description).
- Release evidence captures deployment and post-release-validation provenance sufficient for traceability (§18-style completeness, applied to Stage 11).
- A release failure is retried, stopped, or rolled back only through an authorised, bounded path — never silently retried indefinitely (§24).
- Closure publishes the complete linked evidence chain (validation, review, approval, release) and reaches a terminal outcome only when the required success criteria are satisfied (§23, §32).
- The full Stage 1–12 chain is demonstrated end-to-end at least once, including a rework cycle and a release failure (§37 POC Acceptance Scenario, source §10).

(Source §8, Sprint-Level Definition of Done, concretized against the specs above.)

## Quality gates

Release-policy correctness against real published policies, release-approval gate enforcement (no release action reachable without a granted approval bound to the correct evidence), deployment-adapter correctness against a real local target, post-release-validation completeness, release-evidence completeness/traceability, release-failure-handling boundedness (no infinite retry, rollback requires authorisation), and closure correctness (the linked evidence chain is complete and the terminal outcome is only reached when success criteria hold).

## Key risks (source §11, carried forward verbatim)

- **Scope creep** — protect the vertical slice; defer non-essential platform features.
- **Architecture drift** — enforce package boundaries and contract tests.
- **Agent quality** — require structured outputs, evidence, and regression fixtures.
- **Security** — never let model output become authority (release proceeds only on deterministic evidence/policy/approval, never on any agent's own claim).
- **Provider lock-in** — use adapters from the first implementation (the deployment adapter is a swappable port, exactly like the Git/PR adapters).
- **Reliability** — test restart, duplicate delivery, and idempotency before adding autonomy — directly relevant to the deployment adapter (its invocations must remain idempotent, mirroring DEVOS-059) and to failure handling's bounded retry/rollback.
- **Over-engineering** — prefer modular monolith patterns until scale proves extraction necessary.

## Exit criteria

Sprint 6 is complete when its sprint-level Definition of Done is met, the demo (work item → release approval → staging deployment → validation → closure) can be performed in the target environment, and no critical defect or security issue remains open against the sprint goal. (Source §10, §12.)
