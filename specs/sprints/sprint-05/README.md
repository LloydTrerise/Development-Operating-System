# Sprint 5 — Build, Test, Review & Rework

**Historical source:** `Analysis/DevOS_POC_Sprint_5_Implementation_Tasks_v1.0.docx`
**Conversion date:** 2026-08-24

## Goal

Add build, test, code review, and a bounded rework loop so DevOS can validate a generated change before it is considered release-ready (source §1–§2).

## Architecture

`Code Change / Pull Request → Automated Validation (build + test, Tool Gateway) → Test Evidence → Engineering Review (Review Agent) → PASS → Release Readiness | CHANGES_REQUIRED → Rework → Development`

This is Stages 8–10 of the Software Change Workflow (`specs/workflows/software-change-workflow.md` §6, §18–§21): Automated Validation, Engineering Review, and Release Readiness, plus the Rework path that connects Review back to Development (§20, ADR-SCW-004). Sprint 4 covered approval through PR evidence (Stage 7); Sprint 5 covers everything from there through a deterministic release-readiness verdict — Stage 11 (Release) and its own human release-approval gate remain Sprint 6 scope. Build and test are new Tool Gateway capabilities (`build-run`, `test-run`), extending Sprint 4's gateway rather than introducing a second execution mechanism; the review agent is a normal `AgentDefinition`/`AgentVersion` (role `REVIEW`), extending Sprint 2's agent runtime exactly like DEVOS-057's development agent did.

## Task authority

The task files in this directory are concise, version-controlled conversions of the historical developer-ready specification (`Analysis/DevOS_POC_Sprint_5_Implementation_Tasks_v1.0.docx`), following the exact conversion pattern used for Sprints 2–4. The source document's own per-task detail is generic boilerplate repeated verbatim across all ten tasks ("Implement within the approved repository/package boundaries," "Add unit tests for business logic," etc.) — the substantive scope per task is a single one-line description; each task file below grounds that one line against the actual specs and flags what the specs leave open. Per-task dependencies are inferred from the natural build order implied by the backlog sequence, not stated individually in the source.

**Spec-grounding gaps, flagged up front:**

- **No numeric rework/retry limit exists anywhere in the spec corpus.** §20 Rework and Workflow Principle 7 ("Rework returns to the smallest appropriate prior stage," §8) establish that rework must be bounded in spirit, but no task file, ADR, or NFR states a number. DEVOS-068 must therefore adopt an explicit, flagged assumption.
- **The current workflow engine materializes every task in a run up front and only completes a run once every task in it has succeeded** (found during DEVOS-061: `maybeCompleteRun`, `run-creation.ts`). §20's "a new task execution is created" for rework reads naturally as a dynamic, in-run loop, which this engine cannot do without changes to that same machinery DEVOS-061 already decided not to touch. DEVOS-067 must resolve this the same way DEVOS-061 resolved an equivalent constraint for development-after-approval — investigated and decided at that task, not pre-decided here.
- **`packages/artifacts` (named in `specs/architecture/repository-code-structure.md` §44 for every artifact type's schema, including `test-evidence.schema.ts`/`review-evidence.schema.ts`) has remained an empty, unactivated scaffold through Sprints 1–4** despite that section already naming schema files for `triage-report`/`discovery-report`/`prd`/`technical-design`/`implementation-plan` too — none of which were ever created there either. Sprint 5 continues that established (if spec-diverging) precedent rather than activating the package for the first time now: agent-generated output (the review agent's findings) is schema-validated the same way DEVOS-031–034/057 already validate agent output, via `packages/agents/src/schemas/`, not `packages/artifacts`.
- **No concrete build/test command contract exists anywhere.** `specs/architecture/repository-code-structure.md` §45 names `build-run.ts`/`test-run.ts` as tool capabilities but specifies neither their input schema nor how a "build" or "test" is actually invoked. Modeled on DEVOS-054's Git adapter precedent (a real CLI process run against a real workspace): an explicit, flagged assumption, not a spec derivation.
- **"Acceptance criteria pass" and "security checks pass"** are named as Stage 10 release-readiness checks (§21) but neither acceptance-criteria validation nor security scanning has any implementation anywhere in this codebase, in this sprint, or in any prior one. DEVOS-069's evaluator is explicitly scoped to the evidence this sprint actually produces (test evidence, review evidence) rather than fabricating the remaining checks.
- **No dedicated `ValidationFailed`/`ReviewApproved` domain event is implemented anywhere** (§30 names them as conceptual events) — this codebase's existing audit-record mechanism (used throughout Sprints 1–4) continues to serve that role; a new first-class event bus is not introduced for this sprint alone.
- **User-authorized scoping decision, carried forward from Sprint 4:** no real GitHub API calls. Build/test commands run for real, locally, against the same real local git repository/workspace machinery DEVOS-054/055 already established; PR/git operations remain against the fake/local provider.

## In scope

A build capability and a test capability (both real, local command execution through the Tool Gateway), a test/validation evidence artifact, a review agent (structured findings + PASS/CHANGES_REQUIRED decision), a review evidence artifact, a rework transition connecting a `CHANGES_REQUIRED` review outcome back to a new development cycle, a bounded limit on how many rework cycles run automatically before escalation, a deterministic (non-agent) release-readiness evaluator over the evidence this sprint produces, a minimal UI surface for all of the above, and an end-to-end proof covering both the straight-through pass path and at least one full rework cycle.

## Out of scope / deferred

Production deployment, advanced autonomous remediation (source §4, verbatim). Also out of scope: the Stage 11 Release action and its human release-approval gate (Sprint 6); real GitHub API calls of any kind (carried-forward Sprint 4 scoping decision); acceptance-criteria validation and security scanning as their own mechanisms (no implementation exists anywhere to gate on).

## Sprint-wide acceptance criteria

- A real build and a real set of tests can be run and recorded through the Tool Gateway, against a real local repository.
- Test/validation evidence is persisted with enough detail to reconstruct what ran, what passed/failed, and against which revision (§18).
- The review agent independently assesses a code change against the approved requirements/design/plan and prior validation evidence, producing classified findings and a PASS/CHANGES_REQUIRED decision (§19).
- A `CHANGES_REQUIRED` decision returns the work to development without destroying the traceability of what was already produced (§20, ADR-SCW-004).
- Rework is bounded — it does not loop indefinitely.
- Release readiness is evaluated deterministically from persisted evidence, not by agent claim (§21, Workflow Principle 12).
- The full pass-path and at least one full rework cycle are demonstrated end-to-end.

(Source §8, Sprint-Level Definition of Done, concretized against the specs above.)

## Quality gates

Build/test adapter correctness against a real local repository, test evidence completeness (commands/results/failures/warnings/environment/revision/timestamp), review-agent output schema validation, rework-loop traceability (no artifact or run is overwritten/destroyed), rework boundedness (the configured limit is actually enforced), and release-readiness determinism (the same evidence always yields the same verdict).

## Key risks (source §11, carried forward verbatim)

- **Scope creep** — protect the vertical slice; defer non-essential platform features.
- **Architecture drift** — enforce package boundaries and contract tests.
- **Agent quality** — require structured outputs, evidence, and regression fixtures.
- **Security** — never let model output become authority (the review agent proposes a decision; a deterministic evaluator and the workflow engine, not the model, decide what happens next).
- **Provider lock-in** — use adapters from the first implementation.
- **Reliability** — test restart, duplicate delivery, and idempotency before adding autonomy — directly relevant to the build/test adapters (their invocations must remain idempotent, mirroring DEVOS-059) and to the rework loop (DEVOS-068's bounded-limit requirement).
- **Over-engineering** — prefer modular monolith patterns until scale proves extraction necessary.

## Exit criteria

Sprint 5 is complete when its sprint-level Definition of Done is met, the demo (build/test/review pass, and a review failure returning to development) can be performed in the target environment, and no critical defect or security issue remains open against the sprint goal. (Source §10, §12.)
