# DEVOS-199 — Additive, floor-protected approval-requirement reduction on the `APPROVAL` node

**Priority:** P0 | **Estimate:** 2.5d
**Depends on:** DEVOS-198.
**Depended on by:** DEVOS-200, DEVOS-201.

## Scope

`ApprovalNodeConfig` gains an optional, additive reliability-conditioned reduction of `requiredApprovers`, consumed inside `resolveApprovalRequirements` — hard-floored at 1, zero effect when absent or unmet.

## Implementation

- `packages/application/src/tasks/run-approval-task.ts`:
  - `ApprovalNodeConfig` (line 34-46) gains an optional field: `reliabilityReduction?: { agentVersionId: string; minPassRate: number; minSampleSize: number; reducedRequiredApprovers: number }`.
  - `ApprovalTaskHandlerDeps` gains an optional `artifacts?: ArtifactEvidenceReader` (whatever minimal shape `resolveApprovalReliability`, DEVOS-198, actually needs — reuse its existing dependency type rather than widening `AgentUseCaseDeps` in) — optional, mirroring the existing `projects?`/`policies?` optional-dependency pattern this same file already establishes for DEVOS-146's risk-tiered routing (lines 30-31).
  - `resolveApprovalRequirements` (lines 57-99) gains one more step, applied **after** its existing static/policy-tiered resolution, never replacing it: when `config.reliabilityReduction` is present and `deps.artifacts` is supplied, call `resolveApprovalReliability` (DEVOS-198) with the run's own `projectId`; if the result is `'MET'`, set `requiredApprovers = Math.max(1, Math.min(requiredApprovers, config.reliabilityReduction.reducedRequiredApprovers))` — **the `Math.max(1, ...)` floor is unconditional and not itself configurable**, so no combination of inputs can ever reduce below 1. `'UNMET'`/`'INSUFFICIENT_SAMPLE'`, or a missing `reliabilityReduction`/`deps.artifacts`, leaves `requiredApprovers` completely unchanged from today's existing resolution.
  - `runApprovalTask`'s existing `created: Approval` construction (lines 205-226) gains one additive field recording whether a reduction was applied: extend `Approval`'s domain type (`packages/domain/src/approval/approval.ts`) with an optional `reliabilityEvidence?: { agentVersionId: string; signal: 'MET' | 'UNMET' | 'INSUFFICIENT_SAMPLE'; appliedReducedRequiredApprovers?: number }`, populated whenever `config.reliabilityReduction` was configured (regardless of outcome — recording "checked, not met" is as auditable as "checked, met"), `undefined` when the node has no `reliabilityReduction` configured at all (today's exact prior shape, zero new column value for every existing workflow).
  - Migration: add `reliability_evidence` (nullable JSONB) to the `approvals` table, mirroring `evidence_reference`'s own existing JSONB column shape.
  - Extend the existing audit coverage (DEVOS-115/146's own established approval-adjacent audit pattern) so `approval.created`'s audit record includes `reliabilityEvidence` when present — never a new audit action, an additive field on the existing one.

## Out of scope

Any change to `decideApproval`, `transitionAfterApprovalDecisionInTrx`, `enforceSeparationOfDuties`, or `requiredRejections` — the reduction touches `requiredApprovers` only. Any change to the tool-invocation `REQUIRE_APPROVAL` policy path. Any UI for authoring `reliabilityReduction` on a workflow node — DEVOS-199 is the resolution mechanism; a canvas-editor field for it (mirroring `riskClass`'s own existing properties-inspector treatment, Sprint 13) is real future value but not committed here.

## Acceptance

Every existing `run-approval-task.test.ts` case passes unmodified (proving zero behaviour change for any node without `reliabilityReduction` configured). New test cases: a configured node whose agent version has `'MET'` reliability creates an `Approval` with the reduced `requiredApprovers` and a populated `reliabilityEvidence`; a configured node whose agent version is `'UNMET'`/`'INSUFFICIENT_SAMPLE'` creates an `Approval` with the **original** `requiredApprovers` and a `reliabilityEvidence` recording the unmet/insufficient outcome (not silently dropped); a configured node with `reducedRequiredApprovers: 0` (a deliberately hostile config value) still produces `requiredApprovers: 1`, proving the floor cannot be configured away. `pnpm --filter @devos/domain --filter @devos/application --filter @devos/database typecheck test` green.
