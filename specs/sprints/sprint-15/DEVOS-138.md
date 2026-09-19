# DEVOS-138 — Extend policy conditions with real ABAC attributes

**Priority:** P0 | **Estimate:** 3d
**Depends on:** None (Sprint 14 complete).
**Depended on by:** DEVOS-146 (Sprint 16, risk-tiered routing needs `riskClass` evaluable in a condition).

## Scope

`PolicyRule.condition`/`PolicyEvaluationRequest` (`packages/policy/src/evaluator/policy-evaluation.ts`) gain the highest-value ABAC attributes Security spec §10 names that the engine can evaluate from data it already has: agent identity/version, workflow identity/version, and risk level.

## Implementation

- New optional fields on both `PolicyRule.condition` and `PolicyEvaluationRequest`: `agentId`, `agentVersion` (number), `workflowId`, `workflowVersion` (number), `riskClass`. Additive only — no existing field changes shape.
- `matchesCondition` (`evaluate-policies.ts`) gains one `if (rule.condition.X !== undefined && rule.condition.X !== request.X) return false;` clause per new field, the exact existing pattern for `actorRole`/`resourceType`/`environment` — no new matching algorithm.
- Wire the one real call site, `invoke-tool.ts`:
  - `riskClass: capability.riskClass` is always supplied (already resolved, unconditional).
  - When `input.agentVersionId` is present, resolve the real `AgentVersion` once (moved earlier than today's post-policy DEVOS-085 check, reused by both instead of fetched twice) and supply `agentId: agentVersion.agentId`, `agentVersion: agentVersion.version` — omitted entirely when no agent version is resolvable (a `DEVOS_AGENT_CAPABILITY_DENIED` rejection then happens exactly as it does today, unaffected by this task).
  - New optional `InvokeToolInput.workflowVersionId` (mirroring the existing optional `agentVersionId` field exactly) and new optional `ToolGatewayDeps.workflowVersions` (mirroring the existing optional `agentVersions` dep exactly). When both are present, resolve the real `WorkflowVersion` and supply `workflowId: workflowVersion.workflowDefinitionId`, `workflowVersion: workflowVersion.version`.
  - All seven existing `invokeTool` call sites (`run-development-agent-task.ts` ×3, `run-release-task.ts` ×2, `run-security-scan-task.ts`, `run-validation-task.ts`) pass `workflowVersionId: run.workflowVersionId` — each already holds `run` (a real `WorkflowRun`) in scope, confirmed by inspection.

## Out of scope

Any change to `PolicyEvaluationResult`'s existing `ALLOW | DENY | REQUIRE_APPROVAL | CONFLICT` shape. Wiring the new attributes into `decide-approval.ts`'s own `evaluatePolicies` call (that call has no capability/agent-version/workflow-version context available today — left unchanged, a real, disclosed narrowing, not a silent gap: an approval's own policy check still evaluates on `action`/`actorRole`/`resourceType` only).

## Acceptance

Existing policies with only `actorRole`/`resourceType`/`environment`/`action` conditions continue to evaluate identically — proven by re-running every existing `evaluate-policies.test.ts` test unmodified. New unit tests prove a rule keyed on `agentId`+`agentVersion`, one keyed on `workflowId`+`workflowVersion`, and one keyed on `riskClass` each correctly match/fail-to-match. A new `invoke-tool` test (or extension of an existing one) proves a real policy keyed on `riskClass` actually governs a real tool invocation end to end.
