# DevOS Sprint 7 — Decision Log

**Authorization:** The user explicitly authorized Sprint 7 ("Start sprint 7") following the same autonomous operating model established and used throughout Sprints 3–6: convert the sprint's historical docx spec into version-controlled Markdown task files, implement each task in sequence with unit tests and live verification against real infrastructure, log every consequential decision here, update governance docs per task, and move to the next task without stopping for per-task approval — pausing only at the end of the sprint for explicit user direction before Sprint 8.

**How to read this log:** One entry per task, in build order. Each entry records the architectural decision made and why, new/modified files, unit tests added, the live-verification narrative (what was actually run against real infrastructure, not simulated), full validation-gate confirmation, and a closing note on the next task.

**Carried-forward, user-authorized scoping decisions (unchanged from Sprints 4–6):** no real GitHub API calls (`PullRequestProvider`'s only implementation remains the fake/local one); no real external deployment/hosting provider calls (`DeploymentProvider`'s only implementation remains the real-local-filesystem `createLocalStagingDeploymentProvider`); real Postgres always; real local git repositories for Git-adapter-touching tasks; real Gemini API calls only when recording fixtures.

---

## Sprint-wide spec conversion

`Analysis/DevOS_POC_Sprint_7_Implementation_Tasks_v1.0.docx` was extracted and converted into `specs/sprints/sprint-07/README.md` and eleven per-task files (`DEVOS-082.md` through `DEVOS-092.md`), following the exact conversion pattern used for Sprints 2–6. The source document's per-task detail is generic boilerplate repeated verbatim across all eleven tasks (implementation instructions, acceptance criteria, and DoD are identical word-for-word for every task); the actual per-task scope is a single one-line description in the source backlog table. Each converted file grounds that one line against the real, current state of the codebase — confirmed by direct inspection/grep before writing the file, not assumed — and flags exactly what the specs leave open. Three concrete, pre-verified gaps anchor the sprint's riskiest tasks: `allowedCapabilities` validated but never enforced at runtime (DEVOS-085), only 7 of many state-changing repositories currently write audit records (DEVOS-086), and no token/cost telemetry exists anywhere despite Gemini's REST responses already carrying `usageMetadata` (DEVOS-089).

Marked COMPLETE. DEVOS-082 is next.

---

## DEVOS-082 — Harden RBAC

**Decision:** Centralize the RBAC checks that were either scattered as inline `role !== 'OWNER'` literals or missing entirely, through five new named predicates in `packages/domain/src/projects/authorization.ts` (`canDecideApproval`, `canPublishPolicy`, `canRegisterIntegration`, `canPublishAgent`, `canPublishWorkflow`), following the exact shape of the two predicates already there (`canManageMembers`, `canUpdateProject`). All five are OWNER-gated — no richer role model exists anywhere in the spec corpus to build against, so none was invented.

**Rationale:** Before implementing, each candidate use case was actually inspected rather than assumed. `decide-approval.ts` already checked `membership.role !== 'OWNER'` inline — refactored to call the new `canDecideApproval` helper, preserving identical behavior. `publish-policy.ts`, `create-integration.ts`, and the agent/workflow draft-access modules (`requireDraftAgentVersion`, `requireDraftVersion`) had **no role check at all** — any project MEMBER could publish a policy, register an integration with a credential reference, publish an agent version, or publish a workflow version. This is exactly the kind of real, pre-existing gap the sprint README flagged before any code was touched.

`requireDraftAgentVersion` and `requireDraftVersion` are also called from non-publish use cases (`update-draft-workflow.ts`, `validate-draft-workflow.ts`) where a MEMBER should still be able to act — so the role check was **not** pushed into those shared draft-access functions (which would have over-restricted editing). Instead, both were extended to also return the already-resolved `Membership` object (a lookup they already perform internally), and the role check was added only at the publish call site (`publish-agent-version.ts`, `publish-workflow-version.ts`), which is the actual security-significant, state-changing action.

**Files changed:**

- `packages/domain/src/projects/authorization.ts` — 5 new exported predicates.
- `packages/application/src/approval/decide-approval.ts` — inline literal replaced with `canDecideApproval`.
- `packages/application/src/policy/publish-policy.ts` — new `canPublishPolicy` check (previously absent).
- `packages/application/src/integrations/create-integration.ts` — new `canRegisterIntegration` check (previously absent).
- `packages/application/src/agents/draft-access.ts` — `requireDraftAgentVersion` now also returns `membership`.
- `packages/application/src/agents/publish-agent-version.ts` — new `canPublishAgent` check (previously absent).
- `packages/application/src/workflows/draft-access.ts` — `requireDraftVersion` now also returns `membership`.
- `packages/application/src/workflows/publish-workflow-version.ts` — new `canPublishWorkflow` check (previously absent).
- Unit tests: `packages/application/tests/policies.test.ts`, `integrations.test.ts`, `agents.test.ts`, `workflows.test.ts` — one new case each, asserting a non-owner `MEMBER` is rejected with `ForbiddenError` for the four previously-unchecked operations (approval-decision denial was already covered by the pre-existing `approvals.test.ts`).

**Incidental fix (pre-existing, unrelated flake, not a regression from this task):** `packages/application/tests/run-validation-task.test.ts`'s real-git "passing build+test" case exceeded Vitest's default 5000ms timeout once under full `pnpm turbo` parallel load — the same recurring pattern documented at DEVOS-067/076/077 — fixed the same narrow way, an explicit `30_000` as the test's third argument. Re-confirmed stable under a second forced parallel run afterward.

**Live/full verification:** `@devos/domain` and `@devos/application` typecheck and lint clean. `@devos/application` test suite: 138/138 (4 new). `@devos/api`: 45/45 unaffected (confirmed by inspection: `createProject` grants the creator `OWNER`, and `alice` — the principal used for every publish/register call in this suite — is always that creator, so no existing scenario exercised the new denial path). `@devos/worker`: 25/25 unaffected. Full forced `pnpm turbo run typecheck test lint --force` across all four touched packages: 24/24 tasks green. `pnpm format:check`/`prettier --check` clean on every touched file, including the two governance docs after re-formatting.

**Governance docs updated:** `DEVOS-BUILD-STATE.md` (current-position table, new DEVOS-082 task-audit row, new state-change-log entry, next-state-transition block) and `DEVOS-ROADMAP.md` (current-position table, Authority paragraph, delivery-roadmap Sprint 7 row → IN PROGRESS).

Marked COMPLETE. DEVOS-083 is next.

---

## DEVOS-083 — Secret management integration

**Decision:** Audit the existing reference-only credential mechanism end-to-end before changing anything, then fix only what the audit actually found — not build a new secret store (per the sprint README's own grounding, and confirmed correct by the audit itself: there is no local/plaintext secret storage anywhere to replace).

**Audit findings, each confirmed by direct inspection, not assumed:**

1. `CredentialResolver`/`createEnvCredentialResolver` (DEVOS-053, `packages/integrations/src/credential-resolver.ts`) is fully built and unit-tested but **never called from any production code path**. Grepped every call site of `.resolve(` across the repo: the only real invocations are `PromptRepository`/`SchemaRepository`/`AgentFixtureRepository` resolvers (an unrelated naming coincidence) and the resolver's own test. `run-development-agent-task.ts`, `run-validation-task.ts`, and `run-release-task.ts` all read `gitIntegration.configuration.repositoryPath` directly — a local filesystem path, never a credential — and none of them ever touch `credentialReference`. This is consistent with, not contradictory to, the carried-forward Sprint 4-6 scoping decision (no real GitHub API calls, no real external deployment/hosting provider calls): the only two adapter kinds that would ever need a live-resolved secret don't exist as real providers yet. Wiring a consumer now would mean either prematurely building a real external provider (AGENTS.md §21 forbids this) or a wide, unrelated refactor of every existing adapter's interface (AGENTS.md §8 forbids this for a narrowly-scoped task). Decision: leave unwired, record as accepted, explained debt.
2. `apps/api` has **no integrations route at all** — grepped `apps/api/src/routes/` and found no match for `integrations`. There is currently no HTTP response surface through which an integration (or anything inside it) could leak.
3. The global error handler (`apps/api/src/app.ts`'s `toErrorBody`) already returns a generic `'An unexpected error occurred.'` message for any unrecognized error, and never echoes the request body or raw error object back to the caller.
4. No request-body logging middleware exists anywhere in `apps/api/src` (only three `console.log` calls, all static startup/shutdown messages) — so there is no logging surface that could print a credential value or reference today.
5. The one genuine, concrete gap found: `Integration.configuration` is a free-form, unvalidated JSONB bag (`Record<string, unknown>`). Nothing stopped a caller from pasting an actual secret value into it (e.g. `configuration.token = 'ghp_...'`) instead of using `credentialReference` as the spec intends — defeating the "credentials are references only" guarantee for that one field.

**Fix:** Added `assertNoSecretShapedConfiguration` to `packages/application/src/integrations/create-integration.ts` — recursively walks `configuration` (including nested objects and arrays) and rejects with `ValidationError` any key matching `/(password|secret|token|api[-_]?key|credential)/i`, forcing that material through `credentialReference` instead.

**Files changed:**

- `packages/application/src/integrations/create-integration.ts` — new `assertNoSecretShapedConfiguration` + `SECRET_LIKE_CONFIGURATION_KEY` pattern, called before persisting.
- `packages/application/tests/integrations.test.ts` — 4 new cases: rejects a top-level secret-shaped key, rejects a nested one, and two cases confirming ordinary (non-secret-shaped) configuration still passes unchanged.

**Live/full verification:** `@devos/domain`, `@devos/application`, `@devos/integrations` typecheck and lint clean. `@devos/application` test suite: 140/140 (4 new). `@devos/integrations`: 19/19 unaffected (its own `credential-resolver.test.ts` untouched — no production wiring changed, only the create-integration guard). `@devos/api`: 45/45 unaffected. `@devos/worker`: 25/25 unaffected. Full forced `pnpm turbo run typecheck test lint --force` across all five touched packages: 27/27 tasks green. `pnpm format:check`/`prettier --check` clean on every touched file, including both governance docs after re-formatting.

**Governance docs updated:** `DEVOS-BUILD-STATE.md` (current-position table, new DEVOS-083 task-audit row, new state-change-log entry, next-state-transition block) and `DEVOS-ROADMAP.md` (current-position table, verification-debt cell recording `CredentialResolver`'s unwired status as accepted debt).

Marked COMPLETE. DEVOS-084 is next.

---

## DEVOS-084 — Tenant isolation tests

**Decision:** Rather than assuming which resource types needed isolation coverage, grepped `apps/api/tests/app.test.ts` for existing non-member-denial tests first. Found every resource family already had at least one (`projects`, `work-items`, `workflows`, `agents`, `workflow-runs`, `agent-execution-summaries`, `tool-invocation-summaries`, `release-readiness`, `artifacts`), except four with **zero** coverage of any kind, not even a happy path: **policies, approvals, knowledge sources, audit**. Integrations was considered but excluded — DEVOS-083's own audit already established `apps/api` has no integrations route at all, so there is nothing at the API layer to isolation-test yet (its isolation coverage already exists at the application-test level in `integrations.test.ts`).

**Implementation:** Added four new in-memory dependency-fake helper functions to `apps/api/tests/app.test.ts` (`createInMemoryPolicyDeps`, `createInMemoryKnowledgeDeps`, `createInMemoryAuditDeps`, `createInMemoryApprovalDeps`), each following the exact shape and style of the ~8 existing helpers already in the file (in-memory `Map`-backed repositories, composed from `projectDeps`/`workflowDeps`/`artifactDeps` where a use case's deps type requires a repository it never actually calls on the read path being tested — e.g. `ApprovalUseCaseDeps.transitionAfterApprovalDecision` is a no-op stub since no test here decides an approval). Added one new `describe` block with 4 tests, each: creates a real resource as the project owner (`alice`) — via the real POST route for policies/knowledge-sources, or by seeding the in-memory store directly for approvals/audit (matching how other describe blocks in this file already seed data that has no simple creation route) — then asserts a non-member (`mallory`) is rejected with a real 404 through the real HTTP route for every read and mutate endpoint in that family (policies: list/get/publish; knowledge sources: list/get; approvals: list/get/approve; audit: list).

**Files changed:**

- `apps/api/tests/app.test.ts` — 4 new helper functions, 1 new `describe` block (4 tests), import list extended (`Approval`, `ApprovalRepository`, `AuditRecord`, `AuditRecordRepository`, `KnowledgeSource`, `KnowledgeSourceRepository`, `Policy`, `PolicyRepository`, `ApprovalUseCaseDeps`, `AuditUseCaseDeps`, `KnowledgeUseCaseDeps`, `PolicyUseCaseDeps`).

**Live/full verification:** `@devos/api` typecheck and lint clean on first attempt (no fix-up needed). Test suite: 49/49 (4 new). Full forced `pnpm turbo run typecheck test lint --force`: 15/15 tasks green. `pnpm format:check`/`prettier --check` clean after one `--write` pass on the test file, plus both governance docs.

**Governance docs updated:** `DEVOS-BUILD-STATE.md` (current-position table, new DEVOS-084 task-audit row, new state-change-log entry, next-state-transition block) and `DEVOS-ROADMAP.md` (current-position table).

Marked COMPLETE. DEVOS-085 is next.

---

## DEVOS-085 — Agent/tool security controls

**Decision:** Close the pre-verified gap from the sprint README's own grounding: `AgentVersion.configuration.allowedCapabilities` was validated on input and stored (DEVOS-025) but never checked anywhere at runtime, because `invokeTool` had no awareness of which agent, if any, was behind a given invocation. Rather than inventing a new mechanism, this task threads the invoking agent's identity through the existing Tool Gateway chain and adds one more step to it — "Agent Capability Permission" — sitting alongside the chain's existing "Capability Permission" (project-level) step, not replacing it.

**Design:** `InvokeToolInput` gained an optional `agentVersionId?: AgentVersionId` field, and `ToolGatewayDeps` gained an optional `agentVersions?: AgentVersionRepository`. Both are optional so every existing caller that never carries an agent's proposal into a tool invocation — `run-validation-task.ts` (build/test), `run-release-task.ts` (deploy/health-check), and every existing test — is completely unaffected; the check only activates when a caller actually supplies `agentVersionId`. In `invoke-tool.ts`, right after input validation and before the (still-no-op) Credential Resolution step, if `agentVersionId` is present the gateway resolves it and rejects with `DEVOS_AGENT_CAPABILITY_DENIED` (recorded and audited exactly like every other REJECTED outcome in the chain) unless the capability key is in that version's `allowedCapabilities`.

**The one real call site:** grepped every `invokeTool` call site first. Only `run-development-agent-task.ts` runs an agent (`runAgentTask`) and then separately, deterministically, applies its proposal through `invokeTool` — the architecture Constitution Principle 6 requires ("the agent itself never writes to the repository... `runAgentTask` only ever produces a structured, schema-validated proposed change"). `agentVersionId` was already destructured out of `runAgentTask`'s return value there but discarded; it is now threaded into all three of that function's `invokeTool` calls (`repo-write`, `git-commit`, `pull-request-create`). `run-validation-task.ts`/`run-release-task.ts` never call `runAgentTask` at all — build/test/deploy are deterministic platform actions, not agent proposals — so they correctly supply no `agentVersionId` and are unaffected.

**Seed-data consequence:** the seeded development agent's `allowedCapabilities` was `[]` (like every other seeded agent, since nothing previously enforced it) — with real enforcement now wired in, this would have denied every real development-task tool invocation. Updated `SEED_DEVELOPMENT_AGENT_CONFIGURATION.allowedCapabilities` to the exact three keys `runDevelopmentAgentTask` actually invokes.

**Files changed:**

- `packages/tools/src/gateway/types.ts` — new `agentVersionId?: AgentVersionId` on `InvokeToolInput`.
- `packages/tools/src/gateway/deps.ts` — new `agentVersions?: AgentVersionRepository` on `ToolGatewayDeps`.
- `packages/tools/src/gateway/invoke-tool.ts` — new Agent Capability Permission check.
- `packages/application/src/tasks/run-development-agent-task.ts` — threads `agentVersionId` into its three `invokeTool` calls; new `AgentVersionId` cast on the value destructured from `runAgentTask` (previously typed `unknown` via `Record<string, unknown>` and only ever placed into a loosely-typed metadata object).
- `packages/database/src/seed-constants.ts` — `SEED_DEVELOPMENT_AGENT_CONFIGURATION.allowedCapabilities` now `['repo-write', 'git-commit', 'pull-request-create']`.
- `packages/tools/tests/invoke-tool.test.ts` — new `agentVersions` in-memory fake + `seedAgentVersion` helper, 3 new tests (denies excluded capability, allows included capability, denies an unresolvable agent version id).
- `packages/application/tests/run-development-agent-task.test.ts` — `buildScenario` gained an optional `configuration` override parameter; `CONFIGURATION` fixture updated to the real three capabilities; 1 new escalation test (an agent version missing `repo-write` is rejected before the git adapter ever runs — no branch created).
- `packages/integrations/tests/local-staging-deployment-provider.test.ts`, `packages/application/tests/run-release-task.test.ts` — incidental fixes for two more instances of the recurring pre-existing 5000ms-timeout-under-parallel-load flake (Sprints 5-6's established pattern), hit while running full forced validation for this task, unrelated to the agent-capability change itself.

**Live/full verification — including a real, self-caught regression:** `@devos/tools` and `@devos/application` typecheck/lint/test all passed in isolation. But the first full forced `pnpm turbo run typecheck test lint build --force` run failed the entire `tests/e2e` suite (development-path, build-test-review, full-workflow all ended their development stage `FAILED` instead of `COMPLETED`) — not a code defect, but a real data-staleness gap: the persisted Postgres volume's `agent_versions` row for the development agent still held the pre-change `allowedCapabilities: []`, because `seed.ts` inserts with `.onConflict((oc) => oc.column('id').doNothing())` — re-running the seed script never updates an already-existing fixed-UUID row. Diagnosed via a direct `psql` query confirming the stale value, fixed with a direct `UPDATE` matching the new seed constant, and reconfirmed clean with a second full run: `pnpm turbo run typecheck test lint build --force` → **79/79 tasks green**, including the complete real `tests/e2e` suite (6 files, 10 tests: vertical-slice, planning-path, development-path, build-test-review ×2, full-workflow ×2, hardening ×3 — all against real Postgres, real git, real local staging deployment, real spawned worker processes). The two hardening.test.ts failures seen in the first (pre-fix) run were downstream pollution from the earlier runs' failed workflow tasks left in the shared queue, not a separate bug — they passed cleanly once the root cause was fixed. `pnpm format:check` clean throughout.

**Governance docs updated:** `DEVOS-BUILD-STATE.md` (current-position table, new DEVOS-085 task-audit row, new state-change-log entry, next-state-transition block) and `DEVOS-ROADMAP.md` (current-position table, verification-debt cell noting the enforcement is real but scoped to the one wired call site, and flagging the `onConflict doNothing` seed-staleness pattern for future seed-constant changes).

Marked COMPLETE. DEVOS-086 is next.

---

## DEVOS-086 — Implement structured audit

**Decision:** Close the gap the sprint README already grounded before any code was touched: `writeAuditRecord` was confirmed (by grep) to be called only from workflow-run lifecycle, artifact publish, context manifest recording, approval decisions, and work-item closure. Membership add/remove/role-change, policy publish, integration creation, and agent-version publish wrote no audit record at all. Scoped this task to exactly those four operation families — the most security-significant state changes (who can act, what an agent/tool can reach) — rather than every CRUD operation in the codebase, an explicit, documented proportionality decision consistent with the sprint's own "avoid over-engineering" risk.

**Implementation:** Extended `ProjectUseCaseDeps`, `IntegrationUseCaseDeps`, `PolicyUseCaseDeps`, `AgentUseCaseDeps` with a required `auditRecords: AuditRecordRepository`. Each of the six affected use cases (`add-member.ts`, `remove-member.ts`, `change-member-role.ts`, `create-integration.ts`, `publish-policy.ts`, `publish-agent-version.ts`) now calls `deps.auditRecords.create(...)` immediately after its state change succeeds — the same lighter-weight, non-transactional pattern `invokeTool`'s own gateway-level audit call already established (as opposed to the DB-transactional `writeAuditRecord` pattern `close-work-item.ts` uses), chosen because none of these six operations need atomicity between the state change and its audit record any more than the Tool Gateway's own invocations do.

**A real, useful side-discovery, not scope creep:** extending `ProjectUseCaseDeps` broke typecheck in ~25 unrelated files, because `resolveMembership`/`assertNotLastOwner` (`membership-access.ts`) were typed to accept the _entire_ `ProjectUseCaseDeps` even though they only ever call `deps.memberships`. Every use case across the codebase that calls `resolveMembership` — work items, artifacts, knowledge sources, tool capabilities, workflows, releases, agent-execution/tool-invocation summaries — was structurally required to also carry `auditRecords` just to satisfy that overly-broad parameter type. Fixed at the root: extracted a new minimal `MembershipAccessDeps` interface (`{ memberships: MembershipRepository }`) and narrowed `resolveMembership`/`assertNotLastOwner` to it. Two other pre-existing interfaces had the identical issue for the identical reason — `GetWorkflowRunDeps` and `GetWorkflowRunsForWorkItemDeps` both `extends ProjectUseCaseDeps` purely out of convenience — narrowed both to `MembershipAccessDeps` plus only the fields they actually use, matching the precedent `GetWorkflowRunDeps`'s own doc comment already set for exactly this kind of narrowing.

**Files changed:**

- `packages/application/src/projects/deps.ts`, `integrations/deps.ts`, `policy/deps.ts`, `agents/deps.ts` — new required `auditRecords`.
- `packages/application/src/projects/membership-access.ts` — new `MembershipAccessDeps` interface; `resolveMembership`/`assertNotLastOwner` narrowed to it.
- `packages/application/src/workflows/get-workflow-run.ts`, `get-workflow-runs-for-work-item.ts` — `GetWorkflowRunDeps`/`GetWorkflowRunsForWorkItemDeps` narrowed off `ProjectUseCaseDeps` onto `MembershipAccessDeps`.
- `packages/application/src/projects/add-member.ts`, `remove-member.ts`, `change-member-role.ts`, `integrations/create-integration.ts`, `policy/publish-policy.ts`, `agents/publish-agent-version.ts` — each writes one new audit record.
- `apps/api/src/app.ts` — one shared `AuditRecordRepository` instance (`auditRecordRepository`) now threaded into `projectDeps`/`auditDeps`/`agentDeps`/`policyDeps`, replacing a duplicate `createAuditRecordRepository(database.db)` call.
- Test fixtures updated: `packages/application/tests/{projects,integrations,policies,agents}.test.ts` (new in-memory `auditRecords` fake in each), `apps/api/tests/app.test.ts` (new shared `createInMemoryAuditRecordRepository()` helper, wired into `createInMemoryProjectDeps`/`createInMemoryAgentDeps`/`createInMemoryPolicyDeps`).
- New unit tests: 1 per operation family in the four affected application test files (5 total, since the membership test covers add+role-change+remove in one case), each asserting the real audit trail (`deps.auditRecords.listForProject`) contains the expected `action`/`targetType`/`targetId`/`outcome` — plus one confirming the integration-creation audit record's metadata never contains the credential reference value (re-checking DEVOS-083's guarantee at this new call site).

**Live/full verification:** `@devos/application` typecheck initially surfaced ~25 errors from the `ProjectUseCaseDeps` widening (all traced to the single `resolveMembership` over-broad-type root cause above, fixed once, not patched 25 times); clean after the `MembershipAccessDeps` extraction. `@devos/application` test suite: 145/145 (5 new). `@devos/api`: 49/49 (fixed 2 fixture builders that needed the new field). `@devos/worker`: 25/25 unaffected. Full monorepo `pnpm turbo run typecheck test lint build --force`: **79/79 tasks green**, including the complete real `tests/e2e` suite (10/10 — vertical-slice, planning-path, development-path, build-test-review ×2, full-workflow ×2, hardening ×3 — real Postgres, real git, real local staging deployment). `pnpm format:check` clean.

**Governance docs updated:** `DEVOS-BUILD-STATE.md` (current-position table, new DEVOS-086 task-audit row, new state-change-log entry, next-state-transition block) and `DEVOS-ROADMAP.md` (current-position table, verification-debt cell recording DEVOS-086's deliberate four-family scope — not exhaustive CRUD-audit coverage).

Marked COMPLETE. DEVOS-087 is next.

---

## DEVOS-087 — Implement metrics

**Decision:** Activate `packages/observability` — an empty bootstrap scaffold since Sprint 1, with no alternate home the way `packages/artifacts`' functionality lives in agent schemas or `packages/events`' lives in the DB-layer outbox — for the first time, per the sprint README's own grounding. Build a real, in-process metrics registry rather than integrating a real metrics backend (Prometheus, StatsD, etc.), which is explicitly out of this sprint's scope.

**Design:** `createMetricsRegistry()` supports labeled counters and simple histograms (count/sum/min/max), keyed by metric name plus label values sorted by key (so label insertion order never creates a spurious second series). Its own `snapshot()`/`getCounter()`/`getHistogram()` methods are the complete query interface — there is no exporter, no HTTP endpoint, and no wire format, matching the sprint's explicit exclusion of a real metrics backend.

**Wiring:** Rather than instrumenting every workflow/agent/tool call site individually (which would touch a wide, unrelated swath of the codebase for a task scoped to "implement metrics," not "instrument everything"), the registry is wired into the one real, natural choke point where all four kinds of activity already flow through a single function: `apps/worker/src/task-dispatcher.ts`'s `processNext()`/`loop()`. Every real unit of work — a workflow's AGENT_TASK, a workflow's TOOL_TASK, or any other task type — passes through `queue.claimNext()` → handler → `queue.complete()`/`queue.fail()`, so counting and timing at that single point gives real, accurate signal for "workflow, agent, tool, and queue metrics" without a broad refactor. `TaskDispatcherOptions` gained an optional `metrics?: MetricsRegistry` (optional so every existing caller and test is completely unaffected); when supplied, `task_queue.claimed`/`completed`/`failed`/`retrying` counters (each labeled by `taskType`) and a `workflow_task.duration_ms` histogram are recorded per claimed task, and `task_queue.reclaimed_stale` is incremented by `reclaimStale()`'s own real return count. `apps/worker/src/main.ts` now constructs and passes a real, live registry instance.

**Files changed:**

- `packages/observability/src/metrics/registry.ts` — new `createMetricsRegistry()`.
- `packages/observability/src/index.ts` — now re-exports it (was `export {};`).
- `packages/observability/package.json` — added `main`/`types` fields (previously missing, since nothing consumed the package).
- `apps/worker/package.json` — new `@devos/observability` dependency.
- `apps/worker/src/task-dispatcher.ts` — new optional `metrics` option; records claim/completion/failure/retry counters and a duration histogram.
- `apps/worker/src/main.ts` — constructs and wires a real `metrics` registry instance into the dispatcher.
- `packages/observability/tests/registry.test.ts` — new, 9 tests (counter increments, label-order independence, explicit increment values, histograms, snapshot shape, cross-registry isolation).
- `apps/worker/tests/task-dispatcher.test.ts` — 6 new tests (successful claim+completion recorded with the right labels, retrying vs. failed classification by error type, no-handler failure, a real non-zero `reclaimStale()` count reflected in the counter, and confirming the dispatcher behaves identically with no `metrics` option at all).

**Live/full verification:** `@devos/observability` typecheck/lint/test clean (9/9). `@devos/worker` typecheck/lint/test clean (31/31, 6 new). Full monorepo `pnpm turbo run typecheck test lint build --force`: **79/79 tasks green**, including the complete real `tests/e2e` suite (10/10) — confirming the real worker process (which now constructs and threads a live metrics registry through its dispatcher on every run) still executes the full reference workflow correctly end-to-end. `pnpm format:check` clean.

**Governance docs updated:** `DEVOS-BUILD-STATE.md` (current-position table, new DEVOS-087 task-audit row, new state-change-log entry, next-state-transition block) and `DEVOS-ROADMAP.md` (current-position table, verification-debt cell noting metrics are scoped to the worker's task dispatcher only — the API layer itself is not instrumented, and there is no export path to an external backend).

Marked COMPLETE. DEVOS-088 is next.

---

## DEVOS-088 — Implement tracing

**Decision:** Confirmed by inspection first: `apps/api/src/app.ts` already resolves a correlation id per request (`resolveCorrelationId`, echoed back as the `x-correlation-id` response header and `meta.requestId`), but never passed it to any route handler — so it never reached a workflow run, let alone the agent/tool activity that run causes. This is exactly the gap the sprint README flagged. Close it with id propagation and structured-record correlation, not a real tracing backend (OpenTelemetry, Jaeger), which stays explicitly out of scope.

**Design — three small, connected threads, no new database columns:**

1. `RouteContext` (`apps/api/src/http/router.ts`) gained a required `correlationId: string`, populated by `handleRequest` from the id it already resolves.
2. `StartRunInput` (`packages/application/src/workflows/run-creation.ts`) gained an optional `correlationId?: string`. When present, `startRunForVersion` folds it into the run's own `input` (alongside the caller-supplied `inputs`, not in place of them) and into every task's own `input` — the exact same reserved-key extensibility point `node.agentRef` already established for AGENT_TASK nodes, not a new column on `workflow_runs`/`workflow_tasks`.
3. `InvokeToolInput` (`packages/tools`) gained an optional `correlationId?: string`. When present, `invoke-tool.ts` records it in `inputMetadata` (the same JSONB field the idempotency/branch-binding check already reads `target`/`parameters` from — confirmed the added key doesn't affect that comparison, which only ever destructures those two fields) and in the resulting audit record's own **pre-existing** `correlationId` field (added to `AuditRecord` back in an earlier sprint, previously never populated by any call site).

**Wiring:** `apps/api/src/routes/workflow-runs.ts`'s two run-starting handlers now pass `correlationId` through. The three real task handlers that call `invokeTool` on behalf of a workflow task — `run-development-agent-task.ts` (3 calls), `run-validation-task.ts` (2 calls), `run-release-task.ts` (2 calls) — each read `task.input.correlationId` (typed narrowed from `unknown`) once at the top of the function and pass it into every `invokeTool` call. `exactOptionalPropertyTypes` (a strict compiler setting this repo respects) meant `correlationId: string | undefined` couldn't be assigned directly to an optional `correlationId?: string` field — fixed by conditionally spreading (`...(correlationId !== undefined ? { correlationId } : {})`) at each call site rather than weakening the type.

**Files changed:**

- `apps/api/src/http/router.ts` — `RouteContext.correlationId`.
- `apps/api/src/app.ts` — passes it into every route handler call.
- `apps/api/src/routes/workflow-runs.ts` — both run-starting handlers forward it.
- `packages/application/src/workflows/run-creation.ts` — `StartRunInput.correlationId`, folded into run/task `input`.
- `packages/tools/src/gateway/types.ts` — `InvokeToolInput.correlationId`.
- `packages/tools/src/gateway/invoke-tool.ts` — records it in `inputMetadata` and the audit record.
- `packages/application/src/tasks/run-development-agent-task.ts`, `run-validation-task.ts`, `run-release-task.ts` — read `task.input.correlationId`, pass it through.
- New tests: `packages/application/tests/workflows.test.ts` (1 — a supplied correlationId lands in both the run's and its task's stored `input`), `packages/tools/tests/invoke-tool.test.ts` (2 — present and absent, each correctly reflected in `inputMetadata` and the audit record), `apps/api/tests/app.test.ts` (1 — a real HTTP request supplying `x-correlation-id` gets the exact same id back in the response headers/`meta` and finds it stored on the created run through the real route).

**Live/full verification:** `@devos/tools`, `@devos/application`, `@devos/api`, `@devos/worker` typecheck clean (after fixing the `exactOptionalPropertyTypes` issue above). Test suites: `@devos/tools` 19/19 (2 new), `@devos/application` 146/146 (1 new), `@devos/api` 50/50 (1 new). Full monorepo `pnpm turbo run typecheck test lint build --force`: **79/79 tasks green**, including the complete real `tests/e2e` suite (10/10) — confirming every real workflow run (which now always carries a correlation id, generated server-side even when the caller supplies none) still completes correctly end-to-end. `pnpm format:check` clean.

**Governance docs updated:** `DEVOS-BUILD-STATE.md` (current-position table, new DEVOS-088 task-audit row, new state-change-log entry, next-state-transition block) and `DEVOS-ROADMAP.md` (current-position table, verification-debt cell noting propagation only reaches task handlers that call `invokeTool` directly, and that no real tracing backend exists).

Marked COMPLETE. DEVOS-089 is next.

---

## DEVOS-089 — Implement usage/cost telemetry

**Decision:** Confirmed by inspection first (the sprint README's own pre-verified gap): the Gemini adapter's response parsing destructures `promptFeedback` and `candidates` but never reads the real API response's own `usageMetadata` object, discarding it entirely. Capture real usage and a derived, approximate cost estimate — explicitly not a budget/enforcement system, matching `specs/api/poc-api-contracts.md` §51's own deferral of "advanced cost/budget contracts."

**Design:**

- `AgentInvocationResult` (the provider-agnostic seam between the agent runtime and any model adapter) gained an optional `usage?: { promptTokens, candidatesTokens, totalTokens }`.
- The Gemini adapter now parses `body.usageMetadata` (`promptTokenCount`/`candidatesTokenCount`/`totalTokenCount` — Gemini's own stable, documented field names) into that shape when all three are present, omitting `usage` entirely otherwise (never fabricating zeros for a response that didn't report usage).
- New `packages/agents/src/pricing.ts` — `estimateCostUsd(usage)`, using an explicit, documented-as-approximate per-1K-token rate. No pricing table exists anywhere in the spec corpus; the comment says so plainly rather than presenting the number as authoritative.
- `AgentExecution` gained `usage?`/`estimatedCostUsd?`. Real migration `0026_agent_executions_add_usage.ts` adds nullable `usage_metadata jsonb`/`estimated_cost_usd numeric` to `agent_executions` — not in `specs/database/poc-database-schema.md` §9.3's documented column list, the same flagged-assumption reconciliation pattern DEVOS-025 (`error_message`) and DEVOS-059 (`idempotency_key`) already established for this exact table's other undocumented columns.
- `AgentExecutionRepository.complete()` gained two new **optional trailing** parameters (`usage`, `estimatedCostUsd`) — confirmed this is backward-compatible with every existing in-memory fake across ~10 test files before relying on it: a function implementation with fewer parameters than its interface type structurally satisfies that type in TypeScript, so no existing fake needed updating, only the one real caller (`run-agent-task.ts`).
- `run-agent-task.ts` computes `estimateCostUsd(invocation.usage)` when usage is present and passes both into `complete()`.
- `getAgentExecutionSummariesForRun` — the existing DEVOS-036 per-run agent-execution endpoint — now surfaces `usage`/`estimatedCostUsd` in each summary. No new API route: the route handler already returns whatever the summary object contains, so this was a pure data-shape extension, not new API surface.

**Files changed:**

- `packages/agents/src/model-adapter.ts` — `AgentInvocationUsage`, `AgentInvocationResult.usage`.
- `packages/agents/src/providers/gemini.ts` — parses `usageMetadata`.
- `packages/agents/src/pricing.ts` — new, `estimateCostUsd`.
- `packages/agents/src/index.ts` — exports it.
- `packages/domain/src/agents/agent-execution.ts` — `AgentExecutionUsage`, `AgentExecution.usage`/`estimatedCostUsd`, `AgentExecutionRepository.complete()`'s two new params.
- `packages/database/migrations/0026_agent_executions_add_usage.ts` — new.
- `packages/database/src/database.ts` — `AgentExecutionsTable.usage_metadata`/`estimated_cost_usd`.
- `packages/database/src/repositories/agent-executions.ts` — `toDomain`/`create`/`complete` updated; `NUMERIC` column mapped through `Number(...)` (pg returns it as a string, to avoid silent precision loss — confirmed this is genuinely necessary, not cargo-culted, via the live round-trip check below).
- `packages/application/src/tasks/run-agent-task.ts` — computes and threads usage/cost.
- `packages/application/src/workflows/get-agent-execution-summaries-for-run.ts` — surfaces both in the summary.
- New tests: `packages/agents/tests/pricing.test.ts` (3), `gemini.test.ts` (2 — usage present/absent), `packages/application/tests/run-agent-task.test.ts` (1 — usage/cost flow through a real `complete()` call on the in-memory fake, which required extending that one fake to actually store the two new params, unlike the other ~9 fakes across the codebase that don't need to).

**Live/full verification, including a genuine real-Postgres round trip:** `@devos/domain`, `@devos/agents`, `@devos/database`, `@devos/application`, `@devos/api`, `@devos/worker` all typecheck clean (one `exactOptionalPropertyTypes` fix needed in `agent-executions.ts`'s `toDomain`, same class of issue as DEVOS-088's). Applied migration 0026 to the real local `devos` Postgres database directly (`DATABASE_URL=... tsx src/migrate.ts`), confirmed the two new columns exist via `psql \d agent_executions`. Wrote and ran a real, throwaway verification script (executed from inside `packages/database` against its own compiled `dist/`, then deleted) that inserted a real `agent_executions` row, called the real `complete()` with non-trivial usage/cost values, read it back through the real repository, and confirmed both the JSONB `usage` object and the `NUMERIC`-to-string-to-`Number` cost conversion survive the round trip exactly (`0.0001234567` in, `0.0001234567` out). **Honestly flagged, not glossed over**: no real Gemini API call was made specifically for this task, because `GEMINI_API_KEY` is not set in this session — the `usageMetadata` field-name parsing is grounded in Gemini's own long-stable, publicly documented REST response contract (also already referenced by name in this task's own spec grounding) rather than a freshly re-confirmed live call, which is a real, disclosed limitation relative to Sprint 2/4's own fixture-recording precedent. Full monorepo `pnpm turbo run typecheck test lint build --force`: **79/79 tasks green**, including the complete real `tests/e2e` suite (10/10) — every real workflow run in that suite still completes correctly with the new nullable columns present (they're simply null for `FixtureModelAdapter`-driven runs, which never report `usage`). `pnpm format:check` clean.

**Governance docs updated:** `DEVOS-BUILD-STATE.md` (current-position table, new DEVOS-089 task-audit row, new state-change-log entry, next-state-transition block) and `DEVOS-ROADMAP.md` (current-position table, verification-debt cell recording the no-live-Gemini-call limitation and the pricing table's approximate nature).

Marked COMPLETE. DEVOS-090 is next.

---

## DEVOS-090 — Implement governance dashboard

**Decision:** No wireframe or layout exists anywhere in the spec corpus for a governance view — the same "build to the task's own acceptance criterion" precedent DEVOS-046/060/070/080 already established for every other un-wireframed piece of UI work in this codebase. Build exactly what the task's own acceptance criterion names: policy, approval, and risk views for a project.

**Design — reuse existing, already-tested endpoints; add no new API surface:** Before writing any UI, checked what already exists. `GET /projects/:id/policies` and `GET /projects/:id/audit` both already existed (Sprint 3/DEVOS-057-ish territory) and were already isolation-tested by DEVOS-084 earlier this same sprint — only the web client never called them. "Risk activity" specifically was scoped to a concrete, already-real signal rather than a fabricated score: `invoke-tool.ts`'s own audit call already writes a `FAILURE`-outcome record for every policy denial, capability denial (DEVOS-085), and failed tool invocation — filtering the existing project audit trail to `outcome === 'FAILURE'` **is** the risk view, with zero new backend work. "Approvals" reuses `listApprovalsForProject`, the exact same data source `ApprovalsPage.tsx` already uses, summarised rather than duplicating its full decide-approval workflow.

**Implementation:** Two new read-only client functions in `apps/web/src/api-client.ts` (`listPoliciesForProject`, `listAuditRecordsForProject`) plus their `Policy`/`AuditRecord` types, mirroring the existing `Approval` type's shape exactly. New `GovernancePage.tsx` (three sections: Policies, Approvals, Risk activity), wired into `App.tsx`'s nav/routing alongside the existing pages, following `ApprovalsPage.tsx`'s own established structure (project-scoped, `useProjectContext`, a load-error banner, empty-state list items) rather than inventing a new page pattern.

**Files changed:**

- `apps/web/src/api-client.ts` — `Policy`, `AuditRecord` types; `listPoliciesForProject`, `listAuditRecordsForProject`.
- `apps/web/src/pages/GovernancePage.tsx` — new.
- `apps/web/src/App.tsx` — new nav link and route.
- `apps/web/tests/api-client.test.ts` — 2 new tests (both new client functions hit the correct real route).

**Live/full verification, including a real end-to-end policy-denial demonstration (the sprint's own demo requirement: "Demonstrate policy denial, audit trail...")**: `@devos/web` typecheck/lint/build clean; test suite 7/7 (2 new). Started real API (`tsx watch`) and web (`vite`) dev servers against the real local Postgres. Wrote a real, throwaway script (run from `packages/database`, using relative imports to its own and `packages/tools`' compiled `dist/` — the established pattern for scripts needing two packages that don't share a common direct-dependent) that: published a real `Policy` with a `DENY` rule on the `repo-read` capability through the real repository, then called the real `invokeTool` gateway function against it, producing a real `REJECTED`/`DEVOS_TOOL_POLICY_DENY` tool invocation and a real `tool_invocation.rejected`/`FAILURE` audit record — confirmed independently via `curl` against the real running API before touching a browser. Then drove a real headless Chromium browser (Playwright, already installed in this environment) to `http://localhost:5173`, selected the seeded project, navigated to the new Governance page, and confirmed via the rendered page text: the real published policy, a long real history of real approvals (accumulated from this session's own many e2e runs against the same seeded project), and — critically — the exact `tool_invocation.rejected` entry in the Risk activity section, with zero browser console errors. A full-page screenshot was captured and sent to the user as evidence. Dev servers and the scratch script were both cleaned up afterward (processes killed, script files deleted); the two real test policies created during verification were deliberately left in the database as a harmless, already-precedented stray artifact (confirmed no real task handler anywhere invokes `repo-read`, so nothing can ever be denied by them). Full monorepo `pnpm turbo run typecheck test lint build --force`: **79/79 tasks green**, including the complete real `tests/e2e` suite (10/10). `pnpm format:check` clean.

**Governance docs updated:** `DEVOS-BUILD-STATE.md` (current-position table, new DEVOS-090 task-audit row, new state-change-log entry, next-state-transition block) and `DEVOS-ROADMAP.md` (current-position table, verification-debt cell recording the two harmless leftover test policies).

Marked COMPLETE. DEVOS-091 is next.

---

## DEVOS-091 — Security review

**Decision:** This is an audit/analysis task, not a feature-build task, per its own spec grounding: a structured walkthrough of this codebase's real trust boundaries — API→workflow, workflow→agent, agent→tool, tool→external provider — as they actually stand after DEVOS-082 through DEVOS-090, not a formal STRIDE-style exercise (no methodology is mandated anywhere in the spec corpus) and not a full external penetration test (explicitly out of scope). Findings are classified **FIXED** or **ACCEPTED RISK**, each with its reasoning — never silently dropped.

### Trust boundary walkthrough

**1. API → Workflow.** Authentication is `apps/api`'s local dev auth provider (DEVOS-020), which treats the bearer token as the principal id directly — a long-documented, explicit POC-scope decision (no real OIDC session exists to validate against), reconfirmed here as still appropriately scoped, not a fresh finding. RBAC: DEVOS-082 (this sprint) centralized five sensitive operations behind named `packages/domain` predicates. CORS reflects any `Origin` unconditionally, but the API uses bearer tokens, never cookies, so there is no CSRF vector this enables — an explicit, already-documented, low-risk design choice. Tenant isolation: DEVOS-084 (this sprint) closed the last gap (policies/approvals/knowledge-sources/audit); every other resource type already had coverage. **New finding, FIXED**: `specs/api/poc-api-contracts.md` §41 requires the API to "rate-limit expensive endpoints" — grepped the whole `apps/api` tree and found no rate-limiting mechanism anywhere. Fixed with a real, minimal, in-process sliding-window limiter (`apps/api/src/http/rate-limiter.ts`), applied to every mutating (POST/PATCH/DELETE) request, keyed per authenticated principal, returning a real `429 DEVOS_RATE_LIMITED`. Deliberately in-process rather than a distributed limiter (Redis, etc.) — that would be disproportionate infrastructure for this stage, matching the sprint's own "avoid over-engineering" risk.

**2. Workflow → Agent.** Constitution Principle 6 ("Security Is Outside the Model") holds structurally: an agent's own output is never directly authoritative anywhere in this codebase — `runDevelopmentAgentTask`'s own doc comment states it plainly, and confirmed by inspection: every `invokeTool` call site passes a hardcoded `SYSTEM_ACTOR_ID` constant as the principal, never anything derived from model output. Agent output is schema-validated (DEVOS-029) before being trusted as structured data at all. Capability restriction (DEVOS-085, this sprint) is real but scoped to the one real call site that carries an agent's proposal into a tool invocation — recorded as accepted risk already in that task's own entry, reconfirmed here as the correct, non-over-engineered scope (no other task handler currently attributes tool invocations to a specific agent version).

**3. Agent → Tool (the Tool Gateway).** The full chain (Typed Validation → Project Scope → Policy → Capability Permission → Agent Capability Permission → Credential Resolution → Provider Adapter) enforces at every step before a provider adapter is ever reached, confirmed by the extensive existing `invoke-tool.test.ts` suite (now 19 tests) and DEVOS-059's idempotency/branch-binding controls. Every invocation — success, rejection, or failure — writes a real audit record (confirmed live in DEVOS-090's own verification moments ago). Credential resolution (DEVOS-083, this sprint) remains an intentionally unwired mechanism — accepted risk, already reasoned through in that task's own entry (no real external provider exists yet to need it).

**4. Tool → External provider / shell execution.** Two real shell-execution primitives exist: `packages/integrations/src/github/github.client.ts`'s `runGit` uses `execFile('git', args, ...)` — an argv array, never a shell string, structurally immune to shell-metacharacter injection regardless of what `args` contains. `packages/integrations/src/exec/run-command.ts`'s `runCommand` (behind `build-run`/`test-run`/`health-check`) deliberately **does** use a real shell (`child_process.exec`), by design — free-form build/test tooling routinely needs shell features (`&&`, pipes) a plain argv array can't express, and its own doc comment names the trust invariant explicitly: `command` must only ever originate from a project's own admin-configured `Integration.configuration`, never from agent or model output. **A genuinely retrospective finding worth surfacing explicitly, not new work**: before DEVOS-082 (earlier this same sprint), `createIntegration` had **no RBAC check at all** — any project MEMBER could register an integration and set `buildCommand`/`testCommand`/`healthCheckCommand` to an arbitrary shell command that would later execute for real inside a workspace via `runCommand`'s `exec`. DEVOS-082's fix (adding `canRegisterIntegration`, OWNER-gated) closed this exact command-injection-adjacent privilege-escalation path, even though it wasn't originally framed in those terms at the time. Confirmed still correctly gated as of this review. The Gemini adapter (the only real external-provider call in this codebase) sends its API key only via an `x-goog-api-key` header, never logged anywhere — confirmed by inspection of every log/console call site in `packages/agents`.

### Findings summary

| #   | Finding                                                                                                                                     | Classification                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No rate limiting anywhere despite §41 requiring it                                                                                          | **FIXED** this task                                                                                                                                                                                                   |
| 2   | `createIntegration` had no RBAC check pre-DEVOS-082, allowing a MEMBER to set an arbitrary shell command later executed by `run-command.ts` | **FIXED** by DEVOS-082 (confirmed retrospectively by this review)                                                                                                                                                     |
| 3   | `CredentialResolver` remains unwired                                                                                                        | **ACCEPTED RISK** (DEVOS-083) — no real external provider exists yet to need it                                                                                                                                       |
| 4   | Agent capability enforcement (DEVOS-085) only covers one real call site                                                                     | **ACCEPTED RISK** — no other call site currently attributes invocations to an agent version                                                                                                                           |
| 5   | `createPolicy`/`requestApproval`/`registerCapability` allow any project MEMBER to create draft/pending records                              | **ACCEPTED RISK** — the actual privilege-sensitive action (publish/decide) is correctly OWNER-gated in every case; `registerCapability` additionally has no API route today, so it is not externally reachable at all |
| 6   | Audit coverage (DEVOS-086) is scoped to 4 operation families, not exhaustive                                                                | **ACCEPTED RISK** — an explicit, documented proportionality decision                                                                                                                                                  |
| 7   | Local dev auth provider trusts the bearer token as the principal id directly                                                                | **ACCEPTED RISK** — long-documented POC-scope decision (DEVOS-020), not real OIDC                                                                                                                                     |
| 8   | CORS reflects any Origin unconditionally                                                                                                    | **ACCEPTED RISK** — no cookie/credential use, so no CSRF vector this enables                                                                                                                                          |
| 9   | No real metrics/tracing backend, no real distributed tracing                                                                                | **ACCEPTED RISK** — explicitly out of this sprint's scope (DEVOS-087/088)                                                                                                                                             |

**Files changed for the one fix this review made:** `apps/api/src/http/errors.ts` (`RateLimitError`), `apps/api/src/http/rate-limiter.ts` (new), `apps/api/src/app.ts` (wired in, overridable via `CreateAppOptions.mutationRateLimiter` for testability). New tests: `apps/api/tests/rate-limiter.test.ts` (3 — limit enforcement, per-key independence, window expiry via fake timers) and 1 new case in `apps/api/tests/app.test.ts` (a real HTTP 429 after the real per-principal budget is exhausted, a different principal unaffected, reads never rate-limited).

**Live/full verification:** `@devos/api` typecheck/lint clean; test suite 54/54 (4 new). Full monorepo `pnpm turbo run typecheck test lint build --force`: **79/79 tasks green**, including the complete real `tests/e2e` suite (10/10) — confirming the new rate limiter's generous budget (60 mutating requests per 10s per principal) does not interfere with real workflow execution. `pnpm format:check` clean.

**Governance docs updated:** `DEVOS-BUILD-STATE.md` (current-position table, new DEVOS-091 task-audit row, new state-change-log entry, next-state-transition block) and `DEVOS-ROADMAP.md` (current-position table, verification-debt cell recording the accepted-risk findings above).

Marked COMPLETE. DEVOS-092 is next — the last task in Sprint 7.

---

## DEVOS-092 — Operational recovery tests

**Decision:** Extend, not duplicate, DEVOS-024's own existing hardening coverage (duplicate-claim safety via `SELECT ... FOR UPDATE SKIP LOCKED`; stale-task reclaim; max-attempts exhaustion) — that suite already proves the `TaskQueue` primitive itself is correct in isolation. This task's own gap, named in its spec file up front, is that nothing exercises the real `TaskDispatcher` (the thing that actually runs in a real worker process) under multi-worker crash conditions, and nothing tests the dispatch loop's own resilience to a transient failure at the queue level.

**A real, previously-missing capability needed first:** `apps/worker` had no importable entry point — every existing e2e test only ever spawned it as a real OS subprocess (`tsx src/main.ts`), never imported its internals across a package boundary. Testing "two independent dispatcher instances sharing one real queue" needs the real `createTaskDispatcher` function, not a re-implementation of its logic inside a test file (which would test a copy, not the real thing). Added `apps/worker/src/index.ts` (re-exporting `task-dispatcher.js`) and `main`/`types` fields to `apps/worker/package.json` — `main.ts`, the actual process entrypoint invoked via `tsx watch`, does not import from the new `index.ts` and is completely unaffected.

**Scenario 1 — a worker crashing mid-task, recovered by a second worker:** Two fully independent `TaskDispatcher` instances, both pointed at the same real Postgres-backed `TaskQueue`. "Worker A" registers a handler that returns a promise which never resolves — from the queue's own perspective, indistinguishable from a process that died mid-task: the task stays `RUNNING`, `complete()`/`fail()` are never called, and workerA is simply abandoned afterward (a real crash never calls `stop()` either, so the test doesn't either). "Worker B" is a second, independent dispatcher with a short `reclaimIntervalMs`, registered with a normal handler. The task is recovered and completed entirely through each dispatcher's own real, timer-driven reclaim loop — not a manually-invoked `reclaimStale()` call, which is what DEVOS-024's own restart-safety test already exercises in isolation. This is a materially different, more realistic proof: it's the actual production mechanism (the dispatcher's own polling/reclaim timers) doing the recovery, with no test-side intervention beyond time passing.

**Scenario 2 — a real bug found and fixed by writing this test:** While designing a "transient DB failure doesn't wedge the queue" test, inspected `apps/worker/src/task-dispatcher.ts`'s `loop()` closely and found it had **no error handling at all** around its own `queue.claimNext()`/`queue.reclaimStale()` calls — only a task handler's own errors were ever caught (inside `processNext()`). `loop()` runs via an unawaited `loopPromise` (`start()` just calls `loopPromise = loop()` and returns immediately). **Confirmed this was a real, exploitable bug, not a hypothetical one**, by temporarily reverting the fix and re-running the two new tests: both failed exactly as predicted, with Vitest reporting genuine **unhandled promise rejections** — a single transient queue-level error (e.g. a dropped DB connection during `claimNext()`) would silently and permanently kill the dispatch loop forever, with absolutely nothing watching to notice or recover, leaving the queue looking "stuck" with no crash reported anywhere. Fixed with a try/catch wrapping each full loop iteration: on any error not already handled inside `processNext()`, increment a new `task_queue.dispatch_error` metric and retry after the normal poll interval — the same minimal treatment the loop already gives "nothing to claim." Re-ran both tests against the restored fix: both passed.

**Files changed:**

- `apps/worker/src/index.ts` — new, re-exports `task-dispatcher.js`.
- `apps/worker/package.json` — new `main`/`types` fields.
- `apps/worker/src/task-dispatcher.ts` — `loop()` now wraps each iteration in try/catch; new `task_queue.dispatch_error` metric.
- `apps/worker/tests/task-dispatcher.test.ts` — 2 new tests (a transient `claimNext()` failure, a transient `reclaimStale()` failure), each proven to fail before the fix and pass after via a real, deliberate revert-and-rerun cycle.
- `tests/e2e/hardening.test.ts` — 2 new real, live-Postgres e2e tests (the crash-and-recover scenario using two real `TaskDispatcher` instances; a transient-queue-failure scenario wrapping the real Postgres-backed queue to inject exactly one failure).

**Live/full verification:** `@devos/worker` typecheck/lint clean; test suite 33/33 (2 new, both confirmed via an actual red→green cycle against the real bug, not just written and assumed correct). `@devos/e2e-tests` typecheck clean. The real `tests/e2e/hardening.test.ts` suite: 5/5 (2 new) run standalone, then reconfirmed as part of the full suite. Full monorepo `pnpm turbo run typecheck test lint build --force`: **79/79 tasks green**, including the complete real `tests/e2e` suite (12/12 total across all 6 e2e files). `pnpm format:check` clean.

**Governance docs updated:** `DEVOS-BUILD-STATE.md` (current-position table now shows Sprint 7 **COMPLETE**, new DEVOS-092 task-audit row, new state-change-log entry marking Sprint 7 complete, next-state-transition block now awaiting Sprint 8, new verification-debt bullet 9 summarizing Sprint 7's own carried-forward gaps) and `DEVOS-ROADMAP.md` (current-position table, delivery-roadmap Sprint 7 row → COMPLETE).

Marked COMPLETE. **Sprint 7 (DEVOS-082–092) is COMPLETE** — pausing per the same governance Sprints 1–6's completion followed, awaiting the user's explicit direction before Sprint 8 (DEVOS-093–103 — Pilot, acceptance review, and post-POC roadmap).
