# DevOS Build State

**Product:** DevOS
**Last Updated:** 2026-09-29 — Sprint 61 marked complete (standalone Epic E31 gap-closure sprint). This file previously accumulated a full per-sprint/per-task narrative inline (its "Current position"/"Task audit" evidence column/"State change log"/"Next state transition" sections all grew unboundedly across 55 sprints and 324 tasks — several sections exceeded 4,000 characters per row). That narrative is preserved in this file's own git history (`git log -p -- DEVOS-BUILD-STATE.md`) and, per sprint, in `specs/sprints/sprint-NN/README.md` and `specs/sprints/sprint-NN/DEVOS-XXX.md` (the authoritative per-task record from Sprint 1 onward, per `AGENTS.md` §35). Nothing was deleted — only removed from this file's live working copy.

---

## Current position

As of 2026-09-29, **Sprint 61 (DEVOS-345–349) is COMPLETE** — a standalone sprint (not part of any epic, mirroring Sprint 45's own "Nocturne theme fidelity pass" precedent) closing four of the six gaps `specs/sprints/sprint-60/DEVOS-344.md`'s own closing disclosure left open at candidate Epic E31's close. DEVOS-345 closes gap 1: a new, separate `platform_audit_records` table/domain type/repository/route now records every platform-operator grant/revoke, deliberately not widening `AuditRecord.organisationId` (a required field 113 existing call sites rely on) — mirrors this codebase's own established precedent of adding a new table for a new tier (`platform_operators`/`registration_tokens`, Sprint 56/57) rather than widening an existing organisation-scoped one. DEVOS-346 closes gap 2a: `createOrganisation`'s own create→membership→owner→redeem sequence now runs inside one real database transaction (`CreateOrganisationTransactionally`, `packages/database/src/repositories/create-organisation.ts`), mirroring the same `withTransaction` port/adapter pattern `createDecideApprovalAndTransition`/`createOrganisationLlmProviderReorderer` already established — proved against real Postgres in a new permanent e2e test (`tests/e2e/organisation-creation-atomicity.test.ts`) covering a real success, a real forced-crash rollback, and a real token-reuse rejection. Gap 2b (the initialisation guard's own read vs. a gated handler's own write, across all 47 gated routes) was deliberately left as the same accepted, disclosed race it already was — closing it for real would mean threading a shared transaction through every one of those 47 handlers' own dependency injection, judged out of proportion for this sprint. DEVOS-347 is a **correction, not a fix**: its own originally-planned narrow re-activation exemption was fully implemented, then its own route-level test failed — `getOrganisationInitialisationStatus`'s `hasLlmProvider` has always checked row *existence*, never `status` (`packages/application/src/organisations/get-organisation-initialisation-status.ts:61`), so disabling an organisation's only LLM provider was never actually able to lose it `INITIALISED` status. The "disable your only provider, then get stuck" scenario `DEVOS-340.md`/`DEVOS-344.md` disclosed across two prior sprints does not reproduce against the real code — a factually inaccurate premise never independently verified until this sprint's own test caught it. The exemption was fully reverted (both touched files confirmed byte-identical to their pre-sprint state); a corrected, permanent regression test was kept instead. DEVOS-348 closes gap 5: `OrganisationSetupChecklist`'s "Configure an AI provider" action now scrolls its own organisation row into view first, verified with a real Playwright session against the live `apps/web`/`apps/api` dev servers (a spy on `HTMLElement.prototype.scrollIntoView` confirmed the exact call fired, plus a full-page screenshot), using one temporary real organisation that was fully deleted afterward. Full monorepo validation (`pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests' --force`) is 76/76 green, matching Sprint 60's own baseline exactly; the full `tests/e2e` suite is 29 files / 57 tests green — one file and three tests more than the epic's own 28/54 baseline, a deliberate, disclosed addition (DEVOS-346's own new atomicity test). No bugs were found in the shipped code; the one significant finding (DEVOS-347's own false premise) was caught, investigated, and corrected before shipping, not shipped and found later. Full grounding, the three resolved design decisions, and gap 4's separate resolution (the one confirmed "Other Org …" residue row and its 4 dependent `job_roles` rows, deleted with the user's explicit approval before implementation began) are in `specs/DEVOS-E31-GAP-CLOSURE-SPRINT.md`; the closing disclosure is in `specs/sprints/sprint-61/DEVOS-349.md` — see the State change log (below) for the full, dated index. Marked COMPLETE per the user's explicit approval (2026-09-29).

**Candidate Epic E31 (Organisation Onboarding, Registration Gating & Mandatory Initialisation) remains CLOSED** (Sprints 56–60). Sprint 61 builds standalone gap-closure work on top of that already-closed epic — it does not reopen it. Of `DEVOS-344.md`'s own six consolidated gaps: gap 1 closed, gap 2 partially closed (2a only), gap 3 corrected (found not to be a real gap), gap 4 resolved separately, gap 5 closed, gap 6 still open and still unrelated to this epic. See "Explicit verification debt" below for the carried-forward index.

**No further sprint or epic is currently authorized or scoped.**

---

## Task audit (Sprints 1–10, DEVOS-001–118)

Per-task acceptance evidence for these 115 tasks lives in `specs/sprints/sprint-01/` through `specs/sprints/sprint-10/` (one file per task) and this file's own git history — this table is a status index only. From Sprint 11 onward, task-level evidence was never duplicated into this file in the first place; see the State change log below for the sprint-by-sprint index instead.

| Task                                                                   | Status                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------- |
| DEVOS-001 — Bootstrap Monorepo                                         | COMPLETE                                        |
| DEVOS-002 — TypeScript & Tooling                                       | COMPLETE                                        |
| DEVOS-003 — Shared Contracts                                           | COMPLETE                                        |
| DEVOS-004 — Configuration Package                                      | PARTIAL — see Explicit verification debt item 1 |
| DEVOS-005 — API Application                                            | COMPLETE                                        |
| DEVOS-006 — Worker Application                                         | COMPLETE                                        |
| DEVOS-007 — Web Application                                            | COMPLETE                                        |
| DEVOS-008 — PostgreSQL Foundation                                      | COMPLETE                                        |
| DEVOS-009 — Database Migrations                                        | COMPLETE                                        |
| DEVOS-010 — Identity Abstraction                                       | COMPLETE                                        |
| DEVOS-011 — Projects & Memberships                                     | COMPLETE                                        |
| DEVOS-012 — Work Items                                                 | COMPLETE                                        |
| DEVOS-013 — Workflow Definitions                                       | COMPLETE                                        |
| DEVOS-014 — Workflow Runs & Tasks                                      | COMPLETE                                        |
| DEVOS-015 — Queue & Worker Dispatch                                    | COMPLETE                                        |
| DEVOS-016 — Deterministic Task Stub                                    | COMPLETE                                        |
| DEVOS-017 — Artifact Service                                           | COMPLETE                                        |
| DEVOS-018 — Events & Outbox                                            | COMPLETE                                        |
| DEVOS-019 — Audit                                                      | COMPLETE                                        |
| DEVOS-020 — Basic Run UI                                               | COMPLETE                                        |
| DEVOS-021 — End-to-End Vertical Slice                                  | COMPLETE                                        |
| DEVOS-022 — CI Pipeline                                                | COMPLETE                                        |
| DEVOS-023 — Local Developer Environment                                | COMPLETE                                        |
| DEVOS-024 — Sprint Hardening & Demo                                    | COMPLETE                                        |
| DEVOS-025 — Implement Agent Definition Model                           | COMPLETE                                        |
| DEVOS-026 — Implement Agent Runtime                                    | COMPLETE                                        |
| DEVOS-027 — Implement LLM Provider Adapter                             | COMPLETE                                        |
| DEVOS-028 — Implement Prompt/Version Management                        | COMPLETE                                        |
| DEVOS-029 — Implement Agent Output Schemas                             | COMPLETE                                        |
| DEVOS-030 — Implement Context Manifest                                 | COMPLETE                                        |
| DEVOS-031 — Implement Discovery Agent                                  | COMPLETE                                        |
| DEVOS-032 — Implement Requirements Agent                               | COMPLETE                                        |
| DEVOS-033 — Implement Technical Design Agent                           | COMPLETE                                        |
| DEVOS-034 — Implement Planning Agent                                   | COMPLETE                                        |
| DEVOS-035 — Connect Agents to Workflow                                 | COMPLETE                                        |
| DEVOS-036 — Add Agent Execution UI                                     | COMPLETE                                        |
| DEVOS-037 — Agent Evaluation Fixtures                                  | COMPLETE                                        |
| DEVOS-038 — Planning-Path End-to-End                                   | COMPLETE                                        |
| DEVOS-039 — Implement Knowledge Source Model                           | COMPLETE                                        |
| DEVOS-040 — Implement Repository/Document Retrieval                    | COMPLETE                                        |
| DEVOS-041 — Implement Context Builder                                  | COMPLETE                                        |
| DEVOS-042 — Implement Context Provenance                               | COMPLETE                                        |
| DEVOS-043 — Implement Policy Model                                     | COMPLETE                                        |
| DEVOS-044 — Implement Policy Evaluator                                 | COMPLETE                                        |
| DEVOS-045 — Implement Approval Model                                   | COMPLETE                                        |
| DEVOS-046 — Implement Approval UI                                      | COMPLETE                                        |
| DEVOS-047 — Add Planning Approval Gate                                 | COMPLETE                                        |
| DEVOS-048 — Add Uncertainty Handling                                   | COMPLETE                                        |
| DEVOS-049 — Security/Context Tests                                     | COMPLETE                                        |
| DEVOS-050 — Planning Approval E2E                                      | COMPLETE                                        |
| DEVOS-051 — Implement Tool Definition Model                            | COMPLETE                                        |
| DEVOS-052 — Implement Tool Gateway                                     | COMPLETE                                        |
| DEVOS-053 — Implement Integration Credential Abstraction               | COMPLETE                                        |
| DEVOS-054 — Implement Git Adapter                                      | COMPLETE                                        |
| DEVOS-055 — Implement Controlled Workspace                             | COMPLETE                                        |
| DEVOS-056 — Implement Repository Context                               | COMPLETE                                        |
| DEVOS-057 — Implement Development Agent                                | COMPLETE                                        |
| DEVOS-058 — Implement PR Creation Capability                           | COMPLETE                                        |
| DEVOS-059 — Add Mutation Safety Controls                               | COMPLETE                                        |
| DEVOS-060 — Implement Development UI                                   | COMPLETE                                        |
| DEVOS-061 — Development E2E                                            | COMPLETE                                        |
| DEVOS-062 — Implement Build Adapter                                    | COMPLETE                                        |
| DEVOS-063 — Implement Test Adapter                                     | COMPLETE                                        |
| DEVOS-064 — Implement Test Evidence Artifact                           | COMPLETE                                        |
| DEVOS-065 — Implement Review Agent, DEVOS-066 — Review Evidence Schema | COMPLETE                                        |
| DEVOS-067 — Rework Transitions, DEVOS-068 — Retry/Rework Limits        | COMPLETE                                        |
| DEVOS-069 — Implement Release-Readiness Evaluator                      | COMPLETE                                        |
| DEVOS-070 — Build/Test/Review UI                                       | COMPLETE                                        |
| DEVOS-071 — Build/Test/Review E2E                                      | COMPLETE                                        |
| DEVOS-072 — Implement Release Policy Model                             | COMPLETE                                        |
| DEVOS-073 — Implement Release Approval Gate                            | COMPLETE                                        |
| DEVOS-074 — Implement Deployment Adapter                               | COMPLETE                                        |
| DEVOS-075 — Implement Post-Release Validation                          | COMPLETE                                        |
| DEVOS-076 — Implement Release Evidence                                 | COMPLETE                                        |
| DEVOS-077 — Implement Release Failure Handling                         | COMPLETE                                        |
| DEVOS-078 — Implement Closure Service                                  | COMPLETE                                        |
| DEVOS-079 — Full Software Change Workflow                              | COMPLETE                                        |
| DEVOS-080 — Workflow Timeline Improvements                             | COMPLETE                                        |
| DEVOS-081 — Full Happy/Failure E2E                                     | COMPLETE                                        |
| DEVOS-082 — Harden RBAC                                                | COMPLETE                                        |
| DEVOS-083 — Secret management integration                              | COMPLETE                                        |
| DEVOS-084 — Tenant isolation tests                                     | COMPLETE                                        |
| DEVOS-085 — Agent/tool security controls                               | COMPLETE                                        |
| DEVOS-086 — Implement structured audit                                 | COMPLETE                                        |
| DEVOS-087 — Implement metrics                                          | COMPLETE                                        |
| DEVOS-088 — Implement tracing                                          | COMPLETE                                        |
| DEVOS-089 — Implement usage/cost telemetry                             | COMPLETE                                        |
| DEVOS-090 — Implement governance dashboard                             | COMPLETE                                        |
| DEVOS-091 — Security review                                            | COMPLETE                                        |
| DEVOS-092 — Operational recovery tests                                 | COMPLETE                                        |
| DEVOS-093 — Performance baseline                                       | COMPLETE                                        |
| DEVOS-094 — Reliability hardening                                      | COMPLETE                                        |
| DEVOS-095 — UX refinement                                              | COMPLETE                                        |
| DEVOS-096 — Workflow configuration hardening                           | COMPLETE                                        |
| DEVOS-097 — Agent evaluation suite                                     | COMPLETE                                        |
| DEVOS-098 — Cost controls                                              | COMPLETE                                        |
| DEVOS-099 — Pilot environment                                          | COMPLETE                                        |
| DEVOS-100 — Pilot execution                                            | COMPLETE                                        |
| DEVOS-101 — Defect/remediation sprint                                  | COMPLETE                                        |
| DEVOS-102 — POC acceptance review                                      | COMPLETE                                        |
| DEVOS-103 — Production-readiness roadmap                               | COMPLETE                                        |
| DEVOS-104 — Real GitHub `PullRequestProvider` adapter                  | COMPLETE                                        |
| DEVOS-105 — Real `DeploymentProvider` adapter                          | COMPLETE                                        |
| DEVOS-106 — Wire `CredentialResolver` to a real secret backend         | COMPLETE                                        |
| DEVOS-107 — Real OIDC-based `AuthProvider`                             | COMPLETE                                        |
| DEVOS-108 — Real-provider end-to-end pilot verification                | COMPLETE                                        |
| DEVOS-109 — Wire `buildContext()` into every planning-path agent task  | COMPLETE                                        |
| DEVOS-110/111 — Policy-gated, atomic approval decisions                | COMPLETE                                        |
| DEVOS-112 — The planning re-planning loop                              | COMPLETE                                        |
| DEVOS-113 — Real security/static-analysis scanning stage               | COMPLETE                                        |
| DEVOS-114 — Wire a real rollback trigger                               | COMPLETE                                        |
| DEVOS-115 — Extend audit-record coverage                               | COMPLETE                                        |
| DEVOS-116 — Extend agent-version capability attribution                | COMPLETE                                        |
| DEVOS-117 — Export metrics/tracing to a real external backend          | COMPLETE                                        |
| DEVOS-118 — Move rate limiting to a shared store                       | COMPLETE                                        |

---

## Explicit verification debt

1. DEVOS-004's fail-fast-on-missing-mandatory-configuration criterion remains unverified. No API/worker config keys are mandatory yet, by explicit decision (2026-08-20): DEVOS-005 had no database/queue dependency, so introducing mandatory keys would have been invented scope. This gate opens naturally when a future task (e.g. persistence) first requires `DATABASE_URL`/`QUEUE_URL` at startup.
2. `WorkflowTaskStatus` and `ArtifactStatus` in `@devos/contracts` are explicitly marked PROVISIONAL in source — no specification defines an authoritative enumeration for either. Revisit when task execution / artifact endpoints are implemented.
3. DEVOS-035's live verification never completed all four planning-path stages with both the real `TaskDispatcher`/queue _and_ the real Gemini API simultaneously in one run — Gemini's free-tier daily quota (20 requests/day/model) was exhausted mid-verification from the same day's cumulative DEVOS-031–034 testing. **Closed by DEVOS-038**: its automated proof exercises the real dispatcher/queue/routing/ordering end-to-end (just with fixtures standing in for the live model call, per that task's own CI-safety requirement) — the real-dispatcher mechanism itself is now covered by a repeatable, permanent test, not just a one-off manual verification.
4. DEVOS-037's `refresh-fixtures.ts` script was only live-verified end-to-end for one stage (`discovery`) — the other three (`requirements`/`technical-design`/`planning`) hit the same Gemini free-tier **daily** quota exhaustion (not the short rolling-window limit the script's new retry logic already handles) before they could be re-recorded in this session. Their fixture files still carry genuinely real Gemini responses, just recorded during DEVOS-032–034's live verification earlier the same day rather than through this specific script run. Low priority: re-run `pnpm --filter @devos/agents refresh-fixtures` once quota allows, purely to confirm all four stages refresh cleanly through the script in one pass — not required for the fixtures' validity.
5. `apps/worker/src/agent-task-router.ts` (DEVOS-035) routes `AGENT_TASK` by matching a task's `agentRef` against four specific hardcoded seeded agent keys, not by the resolved agent version's `role`. Found while building DEVOS-038: a freshly-created, differently-keyed (but otherwise correctly configured) agent has no route today. Worked around for DEVOS-038 by running its e2e proof against the seeded agents/workflow rather than fresh ones; the underlying router design wasn't changed. Revisit if a future task needs dynamically-created agents to route correctly — the fix would be resolving the task's `agentVersion.configuration.role` and dispatching on that instead of the literal `agentRef` string.
6. **Sprint 3 gaps, carried forward from `DEVOS-SPRINT3-DECISIONS.md` (see there for full context):** DEVOS-039's `KnowledgeReference` table is modeled/migrated but nothing writes to it yet. DEVOS-041's `buildContext()` and DEVOS-048's `assessContextSufficiency()`/policy-conflict detection are standalone, tested, and live-verified, but were not wired into the live `runAgentTask` path at the time (later closed — see DEVOS-109 in the Task audit above). DEVOS-044's policy evaluator was not yet consulted by the approval flow. DEVOS-045's `requestApproval` checks artifact-version existence by id only, not project ownership. DEVOS-047's approval-decide-then-run-transition was two sequential operations, not one atomic transaction (later closed — see DEVOS-110/111). DEVOS-048 only implements 2 of context-sufficiency's 5 categories. None of these blocked Sprint 3's own acceptance criteria.
7. **Sprint 5 gaps, carried forward from `DEVOS-SPRINT5-DECISIONS.md`:** `packages/artifacts` remained an unactivated scaffold. `MAX_AUTOMATIC_REWORK_CYCLES = 2` (DEVOS-067/068) is a flagged assumption with no numeric bound stated anywhere in the spec corpus. `evaluateReleaseReadiness` (DEVOS-069) is scoped to exactly two checks (test evidence, review decision) — acceptance-criteria validation and security scanning had no implementation yet (security scanning later closed — see DEVOS-113). No real GitHub API call was made in Sprint 5. None of these blocked Sprint 5's own acceptance criteria.
8. **Sprint 6 gaps, carried forward from `DEVOS-SPRINT6-DECISIONS.md`:** no real external deployment/hosting provider call was made in Sprint 6 — `createLocalStagingDeploymentProvider` (a real local filesystem action, not a mock) was the only implementation (later closed for real production adapters — see DEVOS-105). No release-specific rollback loop bound was exercised beyond one manual call. `packages/artifacts` remained an unactivated scaffold. None of these blocked Sprint 6's own acceptance criteria.
9. **Sprint 7 gaps, carried forward from `DEVOS-SPRINT7-DECISIONS.md`:** `CredentialResolver` (DEVOS-053) remained completely unwired (later closed — see DEVOS-106). `allowedCapabilities` enforcement (DEVOS-085) was scoped to one call site. Audit-trail coverage (DEVOS-086) was scoped to four operation families, not exhaustive (later extended — see DEVOS-115). Metrics/tracing (DEVOS-087/088) existed only in-process, no external export (later closed — see DEVOS-117). Usage/cost telemetry (DEVOS-089) used an approximate rate. The API rate limiter (DEVOS-091) was in-process only (later closed — see DEVOS-118). None of these blocked Sprint 7's own acceptance criteria — several were deliberate, reasoned accepted risk from DEVOS-091's own security review.
10. **Sprint 8 gaps, carried forward from `DEVOS-SPRINT8-DECISIONS.md` and `DEVOS-PRODUCTION-READINESS-ROADMAP.md`:** no real GitHub/deployment provider call was made in Sprint 8 (later closed — see DEVOS-104/105). Cost-budget enforcement (DEVOS-098) is alert-only, by explicit scope (unchanged through E23/E30). DEVOS-099's isolated pilot environment was database-level isolation only. DEVOS-100's real pilot run found zero defects. A full, prioritized debt consolidation (Sprints 1–8) exists in `DEVOS-PRODUCTION-READINESS-ROADMAP.md` (DEVOS-103).
11. **Sprint 9 loose ends, carried forward from `DEVOS-SPRINT9-DECISIONS.md`:** `DEVOS-PRODUCTION-READINESS-ROADMAP.md`'s A1/A2/A3/C1 (real GitHub, deployment, secret management, OIDC auth) closed with real evidence. Two gaps DEVOS-108's live verification surfaced were both fixed the same sprint: (a) tasks are now genuinely dependency-ordered at dispatch, proven against real Postgres; (b) ~56 unformatted files fixed via `pnpm format`. Resolved debt, not open debt.
12. **Sprint 10 gaps, carried forward from `DEVOS-SPRINT10-DECISIONS.md`:** every P1 gap this sprint targeted is CLOSED (see Task audit rows DEVOS-109–118 above). Two real, disclosed gaps remained: (a) DEVOS-113's stage could not be freshly re-verified against a live Gemini call due to quota exhaustion — covered instead by `run-security-scan-task.test.ts`'s LLM-independent test coverage; (b) two transient e2e batch-run flakes under heavy parallel load, root-caused to Windows real-process/Postgres resource contention, confirmed not a code defect by repeated clean isolated re-runs. Neither blocks Sprint 10's own acceptance criteria.
13. **E19 gate pilot (2026-08-31) finding — FIXED in `bdcacd0` (2026-09-18):** a real `apps/web` timing bug where a post-login data-fetch could race Auth0's access-token getter registration, falling back to the dev-only seed-user identity. Root-caused (React child-effect-before-parent-effect ordering) and fixed by gating on a new `tokenGetterReady` flag and re-keying fetch effects on resolved identity. Full monorepo validation green. **Not yet re-verified against a live Auth0 login** — the fix is grounded in a confirmed root cause and passing automated validation, not a fresh repeat of the pilot's own live-browser verification.
14. **Sprints 15–16 gaps (E22 Governance & Policy-as-Code):** a policy's `REQUIRE_APPROVAL` decision on a real tool invocation still does not create an `Approval` row — `invoke-tool.ts` treats `REQUIRE_APPROVAL` identically to `DENY`. Pre-existing behaviour this epic did not introduce and deliberately did not fix (still open as of Sprint 55). `decide-approval.ts`'s policy check still has no capability/agent-version/workflow-version/risk-class context. `createPolicy`/`createOrganisationPolicy` draft creation is not OWNER-gated (only publish is). DEVOS-141's policy simulation only replays `tool_invocation.*`-shaped audit records. DEVOS-143's N-of-M rejection semantics are fail-fast, a flagged assumption. None of these block Sprints 15–16's own acceptance criteria.
15. **Candidate Epic E31 gaps (Organisation Onboarding, Registration Gating & Mandatory Initialisation, Sprints 56–60, closed 2026-09-29), consolidated at `specs/sprints/sprint-60/DEVOS-344.md`'s own "Whole-epic closing disclosure" — four of six CLOSED/RESOLVED by Sprint 61 (standalone gap-closure sprint, 2026-09-29), see `specs/DEVOS-E31-GAP-CLOSURE-SPRINT.md` and `specs/sprints/sprint-61/`:**
    - **CLOSED (DEVOS-345):** platform-operator grant/revoke now write to a new, separate `platform_audit_records` concept — `AuditRecord.organisationId` itself was deliberately left untouched (its own required-field invariant preserved).
    - **PARTIALLY CLOSED (DEVOS-346):** a real database transaction now spans organisation creation and token redemption. The initialisation guard's own read vs. the gated handler's own write (across all 47 gated routes) remains the same accepted, disclosed race — closing it for real would mean threading a shared transaction through every gated handler's own dependency injection, judged out of proportion for a standalone gap-closure sprint.
    - **CORRECTED, not a real gap (DEVOS-347):** the disclosed "disabling an organisation's only LLM provider loses INITIALISED status, then gets stuck" scenario does not reproduce against the real code — `hasLlmProvider` has always checked row existence, never `status` (`get-organisation-initialisation-status.ts:61`). This was a factually inaccurate premise carried across two prior sprints' own disclosures, caught by Sprint 61's own test, corrected rather than fixed (a permanent regression test now guards the actual behavior).
    - **RESOLVED (gap 4, separately, before Sprint 61's own implementation began):** the one confirmed real "Other Org …" residue row (not two, as previously disclosed) and its 4 dependent `job_roles` rows were deleted with the user's explicit confirmation, verified gone.
    - **CLOSED (DEVOS-348):** `OrganisationSetupChecklist`'s "Configure an AI provider" action now scrolls its own row into view before opening the panel.
    - **Still open, unrelated to this epic:** the pre-existing `@devos/api` "access control catalogue" test stderr noise (gap 6) — present since before this epic, untouched by every sprint that has disclosed it, including this one.
    None of these blocked any of Sprints 56–61's own acceptance criteria.

---

## State change log

Full per-sprint narrative previously recorded here (one dated row per sprint, frequently several thousand words of real, dated evidence) is preserved in this file's own git history (`git log -p -- DEVOS-BUILD-STATE.md`) and, per sprint, in `specs/sprints/sprint-NN/README.md` and its per-task `DEVOS-XXX.md` files — the authoritative source per `AGENTS.md` §35. This table is the current condensed index. For what each sprint actually delivered, see `DEVOS-ROADMAP.md`'s own "Delivery roadmap" table (same sprint numbers, one-line outcome per sprint). Every sprint below is COMPLETE.

| Date       | Sprint | Tasks         | Epic         |
| ---------- | ------ | ------------- | ------------ |
| 2026-08-20 | 1      | DEVOS-001–024 | -            |
| 2026-08-21 | 2      | DEVOS-025–038 | -            |
| 2026-08-21 | 3      | DEVOS-039–050 | -            |
| 2026-08-22 | 4      | DEVOS-051–061 | -            |
| 2026-08-24 | 5      | DEVOS-062–071 | -            |
| 2026-08-24 | 6      | DEVOS-072–081 | -            |
| 2026-08-24 | 7      | DEVOS-082–092 | -            |
| 2026-08-24 | 8      | DEVOS-093–103 | -            |
| 2026-08-28 | 9      | DEVOS-104–108 | -            |
| 2026-08-28 | 10     | DEVOS-109–118 | -            |
| 2026-09-18 | 11     | DEVOS-119–123 | -            |
| 2026-09-18 | 12     | DEVOS-124–127 | -            |
| 2026-09-18 | 13     | DEVOS-128–132 | -            |
| 2026-09-18 | 14     | DEVOS-133–137 | -            |
| 2026-09-19 | 15     | DEVOS-138–142 | E22          |
| 2026-09-19 | 16     | DEVOS-143–148 | E22          |
| 2026-09-19 | 17     | DEVOS-149–153 | E23          |
| 2026-09-19 | 18     | DEVOS-154–157 | E23          |
| 2026-09-19 | 19     | DEVOS-158–162 | E23          |
| 2026-09-19 | 20     | DEVOS-163–166 | E24          |
| 2026-09-19 | 21     | DEVOS-167–171 | E24          |
| 2026-09-20 | 22     | DEVOS-172–176 | E25          |
| 2026-09-20 | 23     | DEVOS-177–181 | E25          |
| 2026-09-20 | 24     | DEVOS-182–186 | E26          |
| 2026-09-20 | 25     | DEVOS-187–191 | E26          |
| 2026-09-20 | 26     | DEVOS-192–193 | -            |
| 2026-09-20 | 27     | DEVOS-194–197 | E27          |
| 2026-09-20 | 28     | DEVOS-198–202 | E27          |
| 2026-09-21 | 29     | DEVOS-203–207 | E28          |
| 2026-09-22 | 30     | DEVOS-208–211 | E28          |
| 2026-09-22 | 31     | DEVOS-212–217 | E28          |
| 2026-09-22 | 32     | DEVOS-218–221 | E28          |
| 2026-09-22 | 33     | DEVOS-222–228 | E28          |
| 2026-09-22 | 34     | DEVOS-229–233 | E28          |
| 2026-09-22 | 35     | DEVOS-234–239 | E28          |
| 2026-09-22 | 36     | DEVOS-240–243 | E28          |
| 2026-09-22 | 37     | DEVOS-244–246 | E28          |
| 2026-09-22 | 38     | DEVOS-247–249 | E28          |
| 2026-09-22 | 39     | DEVOS-254–260 | E28          |
| 2026-09-22 | 40     | DEVOS-261–263 | E28          |
| 2026-09-23 | 41     | DEVOS-264–266 | E28          |
| 2026-09-23 | 42     | DEVOS-267–270 | E28          |
| 2026-09-23 | 43     | DEVOS-271–272 | E28          |
| 2026-09-23 | 44     | DEVOS-273–276 | E28 (closes) |
| 2026-09-23 | 45     | DEVOS-277–283 | -            |
| 2026-09-23 | 46     | DEVOS-284–287 | E29          |
| 2026-09-23 | 47     | DEVOS-288–294 | E29          |
| 2026-09-24 | 48     | DEVOS-295–298 | E29          |
| 2026-09-25 | 49     | DEVOS-299–302 | E29          |
| 2026-09-25 | 50     | DEVOS-303–307 | E29          |
| 2026-09-25 | 51     | DEVOS-308–310 | E29 (closes) |
| 2026-09-25 | 52     | DEVOS-311–313 | E30          |
| 2026-09-25 | 53     | DEVOS-314–318 | E30          |
| 2026-09-25 | 54     | DEVOS-319–322 | E30          |
| 2026-09-28 | 55     | DEVOS-323–324 | E30 (closes) |
| 2026-09-29 | 56     | DEVOS-325–328 | E31          |
| 2026-09-29 | 57     | DEVOS-329–332 | E31          |
| 2026-09-29 | 58     | DEVOS-333–336 | E31          |
| 2026-09-29 | 59     | DEVOS-337–340 | E31          |
| 2026-09-29 | 60     | DEVOS-341–344 | E31 (closes) |
| 2026-09-29 | 61     | DEVOS-345–349 | -            |

---

## Next state transition

Sprint 61 (DEVOS-345–349, standalone Epic E31 gap-closure sprint) is **COMPLETE** — marked complete by explicit user approval (2026-09-29). Candidate Epic E31 (Organisation Onboarding, Registration Gating & Mandatory Initialisation, Sprints 56–60) remains closed; Sprint 61 closed four of the six gaps its own closing disclosure (`specs/sprints/sprint-60/DEVOS-344.md`) left open — see "Explicit verification debt" item 15 above for the consolidated, item-by-item disposition.

**No further sprint or epic is currently authorized or scoped.** The next DevOS session should not assume any particular next epic — per `AGENTS.md` §3/§35, a new epic requires its own backlog document, conversion, and explicit authorization before any implementation begins.
