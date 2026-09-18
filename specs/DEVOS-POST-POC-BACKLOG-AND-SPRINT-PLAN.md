# DevOS Post-POC Backlog & Sprint Plan

**Document:** Post-POC Backlog & Sprint Plan
**Version:** 1.0
**Status:** Proposed — awaiting explicit user approval before Sprint 9 begins
**Predecessor:** `Analysis/DevOS_POC_Product_Backlog_and_Sprint_Plan_v1.0.docx` (the original 8-sprint POC plan, complete — see `DEVOS-BUILD-STATE.md`)
**Task-ID authority:** This document continues the real, continuous task numbering used by `specs/sprints/sprint-01`–`sprint-08` (`DEVOS-001`–`DEVOS-103`), starting at `DEVOS-104`. It does **not** reuse the historical product backlog's own epic/story numbering (`specs/sprints/README.md` already notes that scheme conflicts with the task-ID authority).

## 1. Purpose

Sprint 8 closed the POC with 9 of 10 stated success criteria fully met (`DEVOS-102`) and a consolidated, prioritized gap list against real production use (`DEVOS-PRODUCTION-READINESS-ROADMAP.md`). `DEVOS-BUILD-STATE.md` has recorded, since 2026-08-25, that Sprint 9 is "not yet defined anywhere in the spec corpus." This document defines it, and the shape of what follows, translating:

- the 21 already-flagged production-readiness gaps (`DEVOS-PRODUCTION-READINESS-ROADMAP.md`), and
- the "Post-POC Roadmap Themes" the original POC backlog itself named as what comes after (source §41) and never scoped further,

into an executable plan, in the same sprint/story format the POC itself used.

## 2. Delivery Principles (carried forward, source §2, still correct)

- Prioritise closing what already blocks real production use over new capability.
- Do not build a new workflow type, designer, or platform-scale feature until the platform can safely touch a real external system.
- Hold the decision gate the original plan calls for (source §42) before committing to any theme beyond hardening — do not pre-select "the next big feature" without real pilot data.
- Keep published workflow definitions immutable; keep agent authority outside the model — both already proven, both must survive every new provider integration untouched.
- Every sprint ends with demonstrable functionality, verified for real (this repo's own established convention — real Postgres, real dev servers, real provider calls where one now exists), not simulated.

## 3. What changed since the original plan was written

The original plan's own Epic Map (E1–E16) predates two things now true of this codebase:

1. **Organisations & Project Types** (this session, pre-dating this document) is already built: real Organisation CRUD, a Project Type template model, a clone pipeline, and role-based agent routing (which also happened to close gap **G1** below). This is exactly the "reusable primitive" the Workflow Expansion theme needs — a second workflow type is now a data problem (a second Project Type with its own templates), not an architecture change.
2. **G1** (`apps/worker/src/agent-task-router.ts` hardcoded to 6 literal seed keys) is **resolved**, ahead of `DEVOS-PRODUCTION-READINESS-ROADMAP.md` being updated to reflect it. It is not repeated as a task below.

## 4. Priority Model (unchanged, source §6)

| Priority | Meaning                                                                             |
| -------- | ----------------------------------------------------------------------------------- |
| P0       | Blocks any real production deployment                                               |
| P1       | Should resolve before meaningful production load                                    |
| P2       | Real but lower urgency                                                              |
| Gate     | Not a build task — a decision point requiring real data before scoping further work |

## 5. Epic Map

| Epic | Outcome                                                                                           | Priority                   | Sprint     | Story detail              |
| ---- | ------------------------------------------------------------------------------------------------- | -------------------------- | ---------- | ------------------------- |
| E17  | Production Provider Integration — real GitHub, real deployment target, real secrets, real auth    | P0                         | 9          | §7 below                  |
| E18  | Engine Reliability & Policy Wiring — everything `DEVOS-PRODUCTION-READINESS-ROADMAP.md` scored P1 | P1                         | 10         | §8 below                  |
| E19  | Pilot Decision Gate                                                                               | Gate                       | 11 (start) | §9 below                  |
| E20  | Workflow Expansion — a second real workflow type                                                  | P1 (pending gate)          | 11+        | Epic-level only — see §10 |
| E21  | Workflow Designer — visual authoring over multiple workflow types                                 | P2 (pending gate)          | 12+        | Epic-level only — see §10 |
| E22  | Governance & Policy-as-Code                                                                       | P2 (pending gate)          | 13+        | Epic-level only — see §10 |
| E23  | Cost Management                                                                                   | P2 (pending gate)          | 14+        | Epic-level only — see §10 |
| E24  | Engineering Intelligence (DORA/quality/bottleneck analytics)                                      | P2 (pending gate)          | 15+        | Epic-level only — see §10 |
| E25  | Agent Platform (marketplace, output evaluation)                                                   | P2 (pending gate)          | 16+        | Epic-level only — see §10 |
| E26  | Knowledge Platform (enterprise indexing/graph/retrieval)                                          | P2 (pending gate)          | 17+        | Epic-level only — see §10 |
| E27  | Autonomy & Integration Expansion (risk-based gate reduction; more Git/CI/Jira/cloud providers)    | P2 (ongoing, pending gate) | Ongoing    | Epic-level only — see §10 |

Per this repo's own governance (`specs/sprints/README.md`, `AGENTS.md` §35), **E20–E27 are not authorized for implementation**. They are named here so the plan's shape is visible, exactly as the original plan named its own E16 "Future Governance/Cost/Analytics" without breaking it into stories. Each gets its own converted `specs/sprints/sprint-XX/` task files only once chosen at the Sprint 11 decision gate.

## 6. Sprint Strategy

| Sprint | Theme                                          | Primary outcome                                                                                                                                                              |
| ------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9      | Production Provider Integration                | A real software change can open a real GitHub PR and reach a real deployment target, authenticated via real OIDC, with real secrets — nothing simulated in the critical path |
| 10     | Engine Reliability & Policy Wiring             | Every P1 gap in `DEVOS-PRODUCTION-READINESS-ROADMAP.md` closed; the platform is safe under real, sustained, multi-instance production load                                   |
| 11     | Decision Gate + first Workflow Expansion incit | A real product decision, backed by real Sprint 9/10 usage, selects and begins the next theme                                                                                 |
| 12+    | Whatever Sprint 11's gate selects              | Defined at that time, per §10                                                                                                                                                |

## 7. Product Backlog — E17 Production Provider Integration (Sprint 9)

| ID        | Story                                                           | Est. | Pri | Acceptance summary                                                                                                                             |
| --------- | --------------------------------------------------------------- | ---- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| DEVOS-104 | Real GitHub `PullRequestProvider` adapter                       | 2d   | P0  | A real PR is opened against a real GitHub repository through the existing `PullRequestProvider` port                                           |
| DEVOS-105 | Real `DeploymentProvider` adapter for an actual target platform | 3d   | P0  | A real deploy reaches a real external target (container registry + orchestrator, or a PaaS API) through the existing `DeploymentProvider` port |
| DEVOS-106 | Wire `CredentialResolver` to a real secret-management backend   | 2d   | P0  | DEVOS-104/105's adapters resolve their live credentials through `CredentialResolver`, not an environment variable read inline                  |
| DEVOS-107 | Real OIDC-based `AuthProvider`                                  | 3d   | P0  | A real user authenticates through a real OIDC identity provider; the local dev auth provider remains available for tests only                  |
| DEVOS-108 | Real-provider end-to-end pilot verification                     | 1d   | P0  | A real Software Change Workflow run opens a real PR, deploys to a real target, and is triggered by a real OIDC-authenticated user, in one run  |

**Sprint objective:** every external system the reference workflow touches is real, not simulated.
**Exit criteria:** `DEVOS-PRODUCTION-READINESS-ROADMAP.md` items A1, A2, A3, C1 are closed and re-verified false (i.e., a real call now exists where none did).

## 8. Product Backlog — E18 Engine Reliability & Policy Wiring (Sprint 10)

| ID        | Story                                                                       | Est. | Pri | Acceptance summary                                                                                                                                                    |
| --------- | --------------------------------------------------------------------------- | ---- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEVOS-109 | Wire the generic context builder into `runAgentTask`                        | 2d   | P1  | Every planning-path agent's context resolution goes through `buildContext()`, not its own bespoke lookup                                                              |
| DEVOS-110 | Wire the policy evaluator into the approval-decision path                   | 2d   | P1  | A published policy can gate an approval decision, not only a tool invocation                                                                                          |
| DEVOS-111 | Make approval-decide and run-transition one atomic transaction              | 1d   | P1  | A decision and its resulting run-status transition commit or roll back together                                                                                       |
| DEVOS-112 | Implement the planning re-planning loop                                     | 2d   | P1  | A rejected planning approval starts a new planning-path run for the same work item instead of failing it outright                                                     |
| DEVOS-113 | Real security/static-analysis scanning stage                                | 2d   | P1  | Release readiness includes a real scan result, not only test-evidence and review-decision                                                                             |
| DEVOS-114 | Wire a real rollback trigger                                                | 1d   | P1  | `runReleaseRollbackTask` is reachable from a real UI action or a real workflow node, not only a manual call                                                           |
| DEVOS-115 | Extend audit-record coverage                                                | 2d   | P1  | Project/work-item create+update, workflow definition/version create, and knowledge-source creation all produce audit records                                          |
| DEVOS-116 | Extend agent-version capability attribution to every `invokeTool` call site | 2d   | P1  | Capability enforcement is a blanket guarantee across every task handler, not one call site                                                                            |
| DEVOS-117 | Export metrics/tracing to a real external backend                           | 2d   | P1  | The real metrics registry and correlation-id tracing are queryable from a real external system (e.g. Prometheus/Grafana or a managed equivalent), not only in-process |
| DEVOS-118 | Move rate limiting to a shared store                                        | 1d   | P1  | The rate limiter survives a restart and coordinates correctly across multiple `apps/api` instances                                                                    |

**Sprint objective:** close every P1 gap `DEVOS-PRODUCTION-READINESS-ROADMAP.md` named.
**Exit criteria:** that document's entire P1 row set is re-verified false; only P2 (accepted, lower-urgency) items remain open.

## 9. E19 — Pilot Decision Gate (Sprint 11, start)

Not a backlog of stories — a repeat, with real data, of the process the original plan already specified (source §42) and that Sprint 8 could not fully exercise because the platform was still local-only. With Sprints 9–10 done, run a real pilot against real external systems and answer the same questions the original plan posed:

- Did DevOS reliably complete the reference workflow against real providers?
- Did users trust the generated artifacts and the real PR/deployment outcome?
- Where did humans still need to intervene?
- Which of E20–E27 has the highest real value right now?

The answer selects Sprint 11's remaining scope and Sprint 12's theme. Convert the selected epic's stories into a real `specs/sprints/sprint-11/` (or later) task set at that point — not before, per `specs/sprints/README.md`.

## 10. E20–E27 — Named, not yet scoped

Each of these is a direct carry-forward of the original plan's own "Post-POC Roadmap Themes" (source §41) and the Functional Specification's "Future Functional Capabilities" (source §36). None has an approved story breakdown. Recorded here only so the plan's overall shape — and the fact that none of this is authorized yet — is explicit:

| Epic                                 | Representative scope (unscoped)                                                                                                                                                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E20 Workflow Expansion               | A second real workflow type (incident, release, dependency-update, or documentation — the gate decides which), built on the existing Project Type template mechanism                                                                                                 |
| E21 Workflow Designer                | Visual authoring over the existing table-based Project Type Workflow editor — explicitly deferred until multiple workflow types exist to justify it (original plan, verbatim: "do not build the visual workflow designer before the fixed reference workflow works") |
| E22 Governance & Policy-as-Code      | A real policy engine beyond today's capability/risk check; richer approval models; compliance reporting                                                                                                                                                              |
| E23 Cost Management                  | Real spend attribution/optimization beyond today's alert-only budget check (`DEVOS-098`)                                                                                                                                                                             |
| E24 Engineering Intelligence         | DORA metrics, quality trends, bottleneck analytics, using Sprint 9–10's now-exportable metrics as the data source                                                                                                                                                    |
| E25 Agent Platform                   | Agent marketplace, output-quality evaluation, organisation-specific agent authoring beyond the template CRUD already built                                                                                                                                           |
| E26 Knowledge Platform               | Enterprise indexing/graph/advanced retrieval, beyond today's flat permission-tagged source list                                                                                                                                                                      |
| E27 Autonomy & Integration Expansion | Risk-based reduction of human approval gates as reliability is demonstrated; additional real Git/CI/Jira/cloud provider adapters beyond the one each E17 built                                                                                                       |

## 11. Dependencies

- Sprint 10 (E18) depends on Sprint 9 (E17) only for DEVOS-113 (a security scan feeding release readiness benefits from, but does not strictly require, a real deployment target) — otherwise Sprints 9 and 10 are independent workstreams and could run in parallel with two engineers.
- Sprint 11's gate (E19) depends on both Sprint 9 and Sprint 10 being complete — the gate's own question ("did DevOS reliably complete the reference workflow against real providers") is unanswerable without both.
- E20–E27 each depend on E19's outcome for scope; E21 additionally depends on E20 (a second workflow type existing) per the original plan's own explicit sequencing.

## 12. Definition of Done (Sprints 9–10)

- Every acceptance-summary cell in §7 and §8 is independently, really verified (real external API call, real DB transaction, real load test where applicable) — not asserted from code review alone.
- `DEVOS-PRODUCTION-READINESS-ROADMAP.md` is updated to mark every closed item, with a decision-log entry per item citing the real verification evidence, mirroring how `DEVOS-BUILD-STATE.md` has recorded every prior sprint.
- Full monorepo `pnpm turbo run typecheck test lint build --force` stays green throughout.
- No new capability from E20–E27 is pulled forward into Sprint 9 or 10 scope.

## 13. What NOT to build in Sprints 9–10 (mirrors source §36's own discipline)

Any part of E20–E27. A new workflow type. A visual designer. A policy-as-code product. An agent marketplace. Advanced cost optimization. Engineering analytics. These are exactly what the original plan protected the POC's own vertical slice from pulling in early — the same discipline now protects the hardening sprints from becoming a second feature push before production-readiness is actually real.
