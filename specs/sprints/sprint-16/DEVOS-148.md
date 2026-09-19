# DEVOS-148 — Real end-to-end pilot: org policy, multi-approver decision, compliance export

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-143–147 (needs the full richer-approval + compliance-reporting stack).

## Scope

A real organisation-scoped, risk-tiered policy (DEVOS-138/139/146) requires two distinct approvers for a real high-risk tool invocation's own approval gate; two real, distinct users decide it (proving DEVOS-143/144 together); the resulting audit trail is confirmed present in a real DEVOS-147 compliance export — live-verified against real Postgres, mirroring this codebase's own established pilot-verification convention (DEVOS-100/108/126/137).

## Real scoping decision (grounded, not arbitrary)

Per DEVOS-146's own grounding, a policy-driven `REQUIRE_APPROVAL` decision on a real tool invocation does not create an `Approval` row anywhere in this codebase (a real, pre-existing, disclosed gap, out of this sprint's scope to fix). This pilot therefore exercises the real, existing approval-creation path that *does* carry risk-tier routing: a real `APPROVAL` graph node (`config.riskClass` set), inside a real workflow, whose own organisation has a real published policy naming `requiredApprovers: 2`/`enforceSeparationOfDuties: true` for that risk class — the same real mechanism DEVOS-146 built and proved in isolation, now proven end to end inside a real running run.

## Implementation / verification steps

1. A real organisation and a real project under it are created through the real API.
2. A real organisation-scoped policy is authored and published (`action` matching a real `APPROVAL` node's own `approvalType`, `condition: { riskClass: 'R3' }`, `requiredApprovers: 2`, `enforceSeparationOfDuties: true`).
3. A brand-new workflow is authored through the real designer API contract (mirroring DEVOS-137's own precedent): a graph with one `APPROVAL` node configured with that same `approvalType` and `config.riskClass: 'R3'`.
4. A real run is started against a real running `apps/worker` process; the run reaches the `APPROVAL` node and a real `Approval` is created — confirmed via Postgres to have `requiredApprovers: 2`/`enforceSeparationOfDuties: true` (DEVOS-146 proven inside a real run, not just in isolation).
5. Two real, distinct principals decide it: the first `APPROVED` decision leaves the run still waiting (DEVOS-143's own non-terminal path); the second `APPROVED` decision from a genuinely different principal (proving DEVOS-144's separation-of-duties check does not itself block two different real approvers) finalizes it, and the run proceeds and reaches `COMPLETED`.
6. The real audit trail this produces (`approval.requested`/policy-published/etc.) is confirmed present in a real DEVOS-147 compliance export for that organisation, filtered to the real project, covering the real date range — a real downloaded CSV (or its equivalent server-side data check) containing the expected rows.
7. All test data (organisation, project, policy, workflow, run, tasks, approval, decisions, audit records) is fully cleaned up afterward, confirmed 0 remaining rows.

## Out of scope

Any new engine capability — this task proves the existing, real Sprint 15–16 work together end to end; it introduces nothing new to either the policy engine or the workflow runtime.

## Acceptance

Steps 1–7 above all succeed for real against real Postgres and a real running worker process — closing this sprint's own, and the whole Governance & Policy-as-Code epic's Sprint 15–16 scope's, exit criterion: the source backlog's three-word scope ("policy-as-code, compliance, approvals") is closed with real evidence for all three.
