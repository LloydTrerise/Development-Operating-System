# Sprint 16 — Richer Approval Models & Compliance Reporting (E22 Governance & Policy-as-Code, part 2)

**Source:** `specs/DEVOS-GOVERNANCE-AND-POLICY-AS-CODE-BACKLOG.md` §6 "Sprint 16 — Richer Approval Models & Compliance Reporting", grounded against direct inspection of the real, current implementation (`packages/domain/src/approval/approval.ts`, `packages/application/src/approval/*.ts`, `packages/database/src/repositories/approvals.ts`, `packages/database/src/repositories/decide-approval-and-transition.ts`, `packages/application/src/tasks/run-approval-task.ts`, `apps/worker/src/task-dispatcher.ts`, `packages/domain/src/audit/audit-record.ts`, `apps/web/src/pages/GovernancePage.tsx`).
**Conversion date:** 2026-09-19
**Status:** Approved to begin (standing authorization for DEVOS-138 → DEVOS-148, this run — Sprint 15 is COMPLETE).

## Goal

Sprint 15 made the policy engine itself real ABAC with organisation scope. This sprint closes the other two words of the source backlog's own three-word E22 scope — "approvals" and "compliance" — turning the single fixed OWNER-only approval gate into a real, risk-aware, policy-configurable control, and turning the per-project audit viewer into a real cross-project reporting surface.

## Grounding (confirmed by direct code inspection before scoping)

- `Approval` (`packages/domain/src/approval/approval.ts`) has exactly one `decidedBy`/`decisionReason`/`decidedAt` triple — one decision terminates it. `ApprovalRepository.decide()` (`packages/database/src/repositories/approvals.ts`) is a direct `UPDATE approvals SET status=..., decided_by=..., ...` — there is no concept of "a second decision" anywhere in the schema or code today. `decideApprovalAndTransition` (`packages/database/src/repositories/decide-approval-and-transition.ts`) already wraps `decide()` + the run-transition in one real atomic transaction (DEVOS-111) — this sprint extends around it, not through it, so that transaction stays untouched for the one call that actually finalizes an approval.
- **Real, load-bearing finding: a policy's own `REQUIRE_APPROVAL` decision on a tool invocation does not create an `Approval` row anywhere.** Direct inspection of `invoke-tool.ts` confirms: `if (decision.decision !== 'ALLOW') return reject(...)` — `REQUIRE_APPROVAL` is treated identically to `DENY` (a straight rejection, `DEVOS_TOOL_POLICY_REQUIRE_APPROVAL`), not routed into any approval-creation path. The only two places an `Approval` is ever actually created are the hardcoded `PLANNING`/`RELEASE` whole-run gates (`specs/workflows/software-change-workflow.md`) and DEVOS-122's node-scoped `APPROVAL` graph node (`runApprovalTask`). This is pre-existing behaviour, out of this sprint's own scope to fix (a real Tool-Gateway-to-Approval wiring gap, flagged here rather than silently assumed away) — DEVOS-146's "risk-tiered routing" is therefore scoped to the real approval-creation paths that exist today (the `APPROVAL` graph node), not a currently-nonexistent tool-invocation approval flow.
- `runApprovalTask`'s `ApprovalNodeConfig` has exactly `approvalType?`/`pollIntervalSeconds?` — no risk-tier concept at all. `Approval` itself carries no `riskClass` (there is no capability/tool context on a graph-level `APPROVAL` node the way there is on a `TOOL_TASK`).
- `apps/worker/src/task-dispatcher.ts`'s `loop()` already establishes the real periodic-tick pattern DEVOS-121's `WAIT` polling and DEVOS-145's own expiry both reuse: `reclaimStale()` + `resumeReadyWaits()` run on the same `nextReclaimAt`-gated tick, no separate timer subsystem.
- `AuditRecordRepository.listForOrganisation` (DEVOS-141, Sprint 15) already exists — DEVOS-147's compliance reporting reuses it directly rather than inventing a second organisation-scoped audit query.
- `approvalStatuses` (`packages/contracts/src/status.ts`) is exactly `['PENDING', 'APPROVED', 'REJECTED']` — DEVOS-145 adds `'EXPIRED'`.

## Real design decisions this sprint's own grounding surfaced (recorded here, not silently assumed)

1. **Multi-approver data model (DEVOS-143):** a new child table `approval_decisions` (one row per individual decision — who, which way, when, why) is added alongside the existing `approvals` row, which gains `required_approvers` (default `1`, so every existing single-approver approval is byte-for-byte unchanged). The existing `decide()`/`decideApprovalAndTransition` path is reused *only* for the decision that actually finalizes the approval (a `REJECTED` decision, fail-fast, or the `Nth` distinct `APPROVED` decision reaching `required_approvers`); every other decision only ever calls a new `recordDecision`, leaving the approval `PENDING` and the run untouched. A `REJECTED` decision from any single decider fails the approval immediately (an explicit, flagged assumption — no spec states whether rejection also needs an N-of-M threshold; fail-fast rejection matches ordinary real-world approval-gate semantics and is the simpler, safer default).
2. **Separation-of-duties (DEVOS-144):** a new `enforce_separation_of_duties` boolean column on `approvals` (default `false`). This task's own real scope is the enforcement mechanism and the flag itself; *setting* the flag from policy configuration is DEVOS-146's job (the flag is inert, off, and untested-as-configured-by-policy until then — DEVOS-144 proves it works once set).
3. **Expiry (DEVOS-145):** a new nullable `expires_at` column on `approvals` and a new terminal `EXPIRED` status. Reuses `apps/worker/src/task-dispatcher.ts`'s existing periodic tick (the same one `resumeReadyWaits()` already runs on) to call a new `ApprovalRepository.expirePending(now)` — no new timer. `runApprovalTask` treats `EXPIRED` exactly like `REJECTED` (throws `NonRetryableTaskError`, so the task/run fails or is tolerated exactly like any other permanent failure).
4. **Risk-tiered routing (DEVOS-146):** since no risk-bearing context reaches an `APPROVAL` graph node today (per the grounding above), this task adds an optional `riskClass` field directly to `ApprovalNodeConfig` (an author-specified, real graph-authoring input — the same kind of author-supplied config `WAIT`'s `waitType`/`CONDITION`'s `rule` already are), and extends `PolicyRule` with two new optional fields, `requiredApprovers?: number` and `enforceSeparationOfDuties?: boolean`, alongside its existing `effect` — a real, additive, disclosed extension of policy configuration (not the evaluator's core decision logic, per the backlog's own §7 constraint). `runApprovalTask` resolves the organisation's own published policy for `action: approvalType` matching `condition.riskClass`, and — if a rule matches with either field set — creates the `Approval` with that `requiredApprovers`/`enforceSeparationOfDuties` instead of the `1`/`false` defaults.
5. **Cross-project compliance reporting (DEVOS-147):** per this sprint's own dependencies review, `listForOrganisation` (already real, DEVOS-141) is reused directly — a real query already scoped correctly by `AuditRecord.organisationId`, not a client-side loop over every project's own `listForProject`. `GovernancePage.tsx` gains a real reporting view (search/filter by project/actor/action category/date range) plus a real CSV export of the matching records, generated client-side from the same already-fetched data (no new export-file-generation endpoint needed — the data is already real and already scoped correctly server-side).

## In scope (DEVOS-143–148, executed in ID order)

- **DEVOS-143** — multi-approver (N-of-M) approval support.
- **DEVOS-144** — separation-of-duties enforcement.
- **DEVOS-145** — approval expiry.
- **DEVOS-146** — risk-tiered approval routing.
- **DEVOS-147** — cross-project compliance reporting.
- **DEVOS-148** — real end-to-end pilot: org policy, multi-approver decision, compliance export.

## Out of scope / deferred

Wiring a tool-invocation `REQUIRE_APPROVAL` policy decision into real `Approval` creation (the real, disclosed pre-existing gap the grounding above found — orthogonal to this sprint's own scope, which is "make the approval gate that already exists richer," not "make policy-driven approval-on-tool-invocation exist for the first time"). Anything E23+. Any change to the Tool Gateway's provider-adapter chain, credential broker, or identity provider.

## Sprint-wide acceptance criteria (from the backlog's own exit criteria)

The source backlog's own three-word E22 scope — "policy-as-code, compliance, approvals" — is closed with real evidence for all three: a real organisation-scoped, risk-tiered policy requires two distinct approvers for a real high-risk decision; two real, distinct users decide it; the resulting audit trail is confirmed present in a real compliance export.

## Governance

Per `AGENTS.md` §4 and this run's standing authorization: proceeding through DEVOS-143 → DEVOS-148 without per-task pauses. Decisions recorded directly in `DEVOS-BUILD-STATE.md`'s state-change-log as each task completes (no separate `DEVOS-SPRINT16-DECISIONS.md`, continuing the convention Sprint 11–15 already established).

## Task index

| ID        | Story                                                                | File           |
| --------- | --------------------------------------------------------------------- | -------------- |
| DEVOS-143 | Multi-approver (N-of-M) approval support                              | `DEVOS-143.md` |
| DEVOS-144 | Separation-of-duties enforcement                                      | `DEVOS-144.md` |
| DEVOS-145 | Approval expiry                                                       | `DEVOS-145.md` |
| DEVOS-146 | Risk-tiered approval routing                                          | `DEVOS-146.md` |
| DEVOS-147 | Cross-project compliance reporting                                    | `DEVOS-147.md` |
| DEVOS-148 | Real end-to-end pilot: org policy, multi-approver decision, compliance export | `DEVOS-148.md` |
