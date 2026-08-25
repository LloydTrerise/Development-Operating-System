# Sprint 7 — Security, Observability, and Recovery Hardening

**Historical source:** `Analysis/DevOS_POC_Sprint_7_Implementation_Tasks_v1.0.docx`
**Conversion date:** 2026-08-24

## Goal

Add meaningful security, governance, telemetry, and usage/cost controls around the working platform Sprints 1–6 already built (source §1–§2).

## Architecture

This sprint is a **hardening pass across the existing vertical slice**, not a new stage of the Software Change Workflow — Sprint 6 already completed the reference workflow's own twelve stages end-to-end (DEVOS-081). Every task here strengthens something that already exists: RBAC checks already scattered across use cases, credential handling already reference-only, project scoping already enforced ad hoc per use case, the audit mechanism already writing some but not all state changes, and the recovery machinery already covering some but not all failure modes. Two genuinely new capabilities are introduced for the first time: metrics/tracing (`packages/observability`, an empty bootstrap-era scaffold since Sprint 1, activated here for the first time) and usage/cost telemetry (no prior task ever captured token usage).

## Task authority

The task files in this directory are concise, version-controlled conversions of the historical developer-ready specification (`Analysis/DevOS_POC_Sprint_7_Implementation_Tasks_v1.0.docx`), following the exact conversion pattern used for Sprints 2–6. The source document's own per-task detail is generic boilerplate repeated verbatim across all eleven tasks — the substantive scope per task is a single one-line description; each task file below grounds that one line against the actual specs and flags what the specs leave open. Per-task dependencies are inferred from the natural build order implied by the backlog sequence, not stated individually in the source.

**Spec-grounding gaps and real, existing-code gaps, flagged up front:**

- **RBAC today is `MembershipRole = 'OWNER' | 'MEMBER'`, checked ad hoc.** `packages/domain/src/projects/authorization.ts` already has `canManageMembers`/`canUpdateProject`, but most sensitive operations (deciding an approval, publishing a policy, registering an integration) instead compare `membership.role !== 'OWNER'` inline at each use case, not through a shared authorization helper. No richer role model (e.g. a reviewer role, a security-admin role) is specified anywhere in the spec corpus.
- **Secret handling is already reference-only** (DEVOS-053's `CredentialResolver`, env-var-by-reference-name) — there is no local/plaintext secret storage to "replace." DEVOS-083's real scope is auditing and hardening the existing reference mechanism's guarantees (never logged, never returned in an ordinary API response, never placed in agent context), not building a new secret store.
- **`AgentVersion.configuration.allowedCapabilities` is validated as an array of strings on input and stored, but never actually checked against anything at runtime** — confirmed by inspecting `invokeTool` (`packages/tools/src/gateway/invoke-tool.ts`), which has no awareness of which agent (if any) is behind a given tool invocation. This is a genuine, pre-existing security gap, not a hypothetical one DEVOS-085 must guess at.
- **Most non-workflow-execution state changes write no audit record today.** `writeAuditRecord` is only called from workflow-run lifecycle, artifact publish, context manifest, approval decisions, and work-item closure — project/work-item creation, membership add/remove/role-change, policy create/publish, integration creation, and agent create/publish currently produce no audit trail at all. DEVOS-086's real scope is closing this gap for the most security-significant of these, not literally every CRUD operation in the codebase (an explicit scope decision to be made concretely at that task).
- **No metrics or tracing mechanism exists anywhere in this codebase.** `packages/observability` (`specs/architecture/repository-code-structure.md` §24: logging/metrics/tracing/correlation) has remained an empty bootstrap scaffold since Sprint 1, alongside `packages/artifacts`/`packages/events`' own long-flagged equivalent gaps — unlike those two, no equivalent functionality already lives elsewhere for metrics/tracing, so this sprint activates the package for the first time rather than continuing to defer it.
- **No token usage or cost telemetry is captured anywhere** — the Gemini adapter (`packages/agents/src/model-adapters/gemini-adapter.ts`) discards the real API response's own `usageMetadata` (`promptTokenCount`/`candidatesTokenCount`/`totalTokenCount`) today. `specs/api/poc-api-contracts.md` §51 explicitly defers "advanced cost/budget contracts" — DEVOS-089 is scoped to recording real usage/estimated cost, not a budget/enforcement system.
- **No numeric cost/budget threshold, alerting mechanism, or dashboard wireframe is specified anywhere** — DEVOS-090's governance dashboard is built to its own task's acceptance criterion ("policy, approval and risk views"), the same "no wireframe exists, build to the stated acceptance criterion" precedent DEVOS-046/060/070/080 already established repeatedly.
- **DEVOS-091 (Security Review) is an audit/analysis task, not a feature-build task** — its deliverable is a written, spec-grounded threat-model review of the system as it stands after Sprints 1–6 plus this sprint's own earlier tasks, with any genuine, in-scope issues found actually fixed; it is not a full external penetration test, which is explicitly out of this POC's scope (`specs/product/devos-product-overview.md`'s and this sprint's own "Enterprise-scale governance"/"Complete compliance automation" exclusions).
- **DEVOS-092 extends, not duplicates, existing recovery coverage.** `tests/e2e/hardening.test.ts` (DEVOS-024) already covers concurrent-claim safety, stale-task reclaim, and max-attempts exhaustion. DEVOS-092's own new scenarios are decided concretely at that task.
- **User-authorized scoping decisions, carried forward from Sprints 4–6 unchanged:** no real GitHub API calls, no real external deployment/hosting provider calls. This sprint introduces no new external-provider surface.

## In scope

Centralized, consistently-applied RBAC checks for sensitive operations; an audited, hardened secret-reference mechanism; a systematic cross-project/organisation isolation test suite; real enforcement of agent tool-capability restrictions with escalation-attempt tests; a materially more complete audit trail; real in-process metrics for workflow/agent/tool/queue operations; end-to-end correlation-id tracing from API request through workflow, agent, and tool execution; real captured token-usage and estimated-cost telemetry; a governance dashboard surfacing policy/approval/risk information; a documented security review with any real findings remediated; and new operational recovery test scenarios.

## Out of scope / deferred

Enterprise-scale governance, a full FinOps platform, complete compliance automation (source §4, verbatim). Also out of scope: any new external secret-management provider (Vault, AWS Secrets Manager, etc. — the reference-only mechanism is hardened, not replaced with a new backend); a real metrics/tracing backend (Prometheus, OpenTelemetry collector, etc. — real in-process telemetry is captured and exposed, not shipped to an external system); budget enforcement or spend alerting; a full external penetration test.

## Sprint-wide acceptance criteria

- Sensitive operations (approval decisions, policy publication, integration/credential registration, membership changes) are authorized through a consistent, shared mechanism, not scattered inline literals.
- A secret's underlying value is never observable through logs, audit records, API responses, or agent context — only its reference name is.
- Cross-project and cross-organisation access is systematically denied across every resource type this codebase exposes, not just the handful already covered by DEVOS-049.
- An agent cannot invoke a tool capability outside what its own `allowedCapabilities` configuration permits.
- Every security-significant state change (who did what, to what, when) is recorded in the audit trail and retrievable.
- Real, in-process metrics exist for workflow runs, agent executions, tool invocations, and queue behaviour.
- A single correlation id traces a request from the API through the workflow engine into whatever agent/tool executions it caused.
- Real token usage and an estimated cost are recorded for every real model call.
- A governance view surfaces policies, approvals, and risk-classified tool activity for a project.
- A documented security review exists, and any real findings it surfaces are either fixed or explicitly and honestly recorded as known, accepted risk.
- At least one new operational recovery scenario beyond DEVOS-024's existing coverage is demonstrated against real infrastructure.

(Source §8, Sprint-Level Definition of Done, concretized against the specs above.)

## Quality gates

RBAC-check consistency (no sensitive operation bypasses the shared authorization mechanism), secret-reference leak-freedom (verified by real tests asserting no logged/returned/context-placed secret value), tenant-isolation completeness (systematic, not spot-checked), capability-restriction enforcement (a real escalation attempt is actually rejected, not merely untested), audit-trail completeness for the operations this sprint scopes in, metrics/tracing correctness against real executions, usage/cost accuracy against a real model response, and recovery-scenario correctness against real infrastructure (real Postgres, a real spawned worker process).

## Key risks (source §11, carried forward verbatim)

- **Scope creep** — protect the vertical slice; defer non-essential platform features.
- **Architecture drift** — enforce package boundaries and contract tests.
- **Agent quality** — require structured outputs, evidence, and regression fixtures.
- **Security** — never let model output become authority (this sprint's own central theme: RBAC, secrets, tenant isolation, and capability restriction are all enforced by software outside the model, never by asking the model to behave).
- **Provider lock-in** — use adapters from the first implementation.
- **Reliability** — test restart, duplicate delivery, and idempotency before adding autonomy — directly relevant to DEVOS-092's own recovery scenarios.
- **Over-engineering** — prefer modular monolith patterns until scale proves extraction necessary; this is the explicit reason a full metrics/tracing backend, external secret manager, and FinOps platform are all out of scope this sprint.

## Exit criteria

Sprint 7 is complete when its sprint-level Definition of Done is met, the demo (policy denial, audit trail, telemetry, and usage/cost information) can be performed in the target environment, and no critical defect or security issue remains open against the sprint goal. (Source §10, §12.)
