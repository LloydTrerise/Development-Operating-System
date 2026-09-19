# DEVOS-146 — Risk-tiered approval routing

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-143 (`requiredApprovers`), DEVOS-144 (`enforceSeparationOfDuties`), Sprint 15's DEVOS-138 (`riskClass` evaluable in a policy condition) and DEVOS-139 (organisation-scoped policy).
**Depended on by:** DEVOS-148 (the pilot's own risk-tiered scenario).

## Scope

The number of distinct approvers DEVOS-143 requires (and whether DEVOS-144's separation-of-duties rule applies) scales with the requested action's risk (via policy configuration, not a hardcoded risk table).

## Real design decision (see `README.md`'s grounding — a real gap found before implementing)

No risk-bearing context reaches an `APPROVAL` graph node today (confirmed: `ApprovalNodeConfig` has no capability/riskClass field, and a policy `REQUIRE_APPROVAL` decision on a real tool invocation does not create an `Approval` row anywhere in this codebase — a real, disclosed pre-existing gap, out of this sprint's scope to fix). This task therefore:

- Adds an optional `riskClass` field to `ApprovalNodeConfig` (`packages/application/src/tasks/run-approval-task.ts`) — an author-specified graph-authoring input, the same kind of real config `WAIT`'s `waitType` or `CONDITION`'s `rule` already are.
- Extends `PolicyRule` (`packages/policy/src/evaluator/policy-evaluation.ts`) with two new optional fields alongside `effect`: `requiredApprovers?: number` and `enforceSeparationOfDuties?: boolean` — additive policy *configuration*, not a change to `evaluatePolicies`'s own decision logic (confirmed: these two fields are read directly off the matched rule by `runApprovalTask`, never touched by the evaluator itself).
- `runApprovalTask` resolves the requesting project's organisation's own published policies (`deps.policies.listForOrganisation`) for a rule matching `action: approvalType` and `condition.riskClass` equal to the node's own configured `riskClass`; if found, the created `Approval` uses that rule's `requiredApprovers`/`enforceSeparationOfDuties` instead of the `1`/`false` defaults.

## Implementation

- `packages/policy/src/evaluator/policy-evaluation.ts`: `PolicyRule` gains `requiredApprovers?: number`, `enforceSeparationOfDuties?: boolean`.
- `run-approval-task.ts`: `ApprovalNodeConfig` gains `riskClass?: ToolCapabilityRiskClass`; a new `resolveApprovalRequirements(deps, project, approvalType, riskClass)` helper looks up the org's own published policies, finds the first matching rule (same key-sorted, highest-published-version-per-key precedence `evaluatePolicies` already uses internally — reusing `evaluatePolicies` itself with a synthetic request would work, but since this needs the *rule's own extra fields*, not just its `effect`, a direct rule-scan mirroring `evaluatePolicies`'s own `latestPublishedPerKey`/match logic is used instead — disclosed here as a real, small duplication rather than exporting evaluator internals across the package boundary).
- `runApprovalTask` passes the resolved `requiredApprovers`/`enforceSeparationOfDuties` into the `Approval` it creates.

## Out of scope

Any change to `PolicyEvaluationResult`'s existing `ALLOW | DENY | REQUIRE_APPROVAL | CONFLICT` shape (confirmed unaffected — `requiredApprovers`/`enforceSeparationOfDuties` are read directly off a matched `PolicyRule`, never surfaced through `evaluatePolicies`'s own return value). Tool-invocation-triggered approval routing (the pre-existing gap named above).

## Acceptance

A real organisation policy rule (`action: 'remediation-approval'`, `condition: { riskClass: 'R3' }`, `requiredApprovers: 2`, `enforceSeparationOfDuties: true`) is published; a real `APPROVAL` graph node configured with `config.riskClass: 'R3'` and that same `approvalType` creates a real `Approval` with `requiredApprovers: 2`/`enforceSeparationOfDuties: true` — confirmed against real Postgres. A node with no `riskClass` configured, or one that matches no policy rule, creates an approval with the unchanged `1`/`false` defaults — every existing `APPROVAL` node test continues to pass unmodified.
