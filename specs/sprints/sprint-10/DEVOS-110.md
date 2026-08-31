# DEVOS-110 — Wire the policy evaluator into the approval-decision path

**Priority:** P1 | **Estimate:** 2d
**Depends on:** None (Sprint 8 complete).

## Scope

`evaluatePolicies()` (`packages/policy/src/evaluator/evaluate-policies.ts`, DEVOS-044) is real, tested, and already consulted by the Tool Gateway for tool invocations — but nothing calls it from `decideApproval` (`packages/application/src/approval/decide-approval.ts`). Wire it in so a published policy can actually block or condition an approval decision.

## Grounding

`DEVOS-PRODUCTION-READINESS-ROADMAP.md` D2, Sprint 3 item 6.

## Flagged gap

No spec defines what a policy scoped to an _approval_ (as opposed to a tool invocation) should actually evaluate against — decide this task's own concrete rule (e.g. a policy naming the approval's `approvalType`) and record it as a flagged assumption, same as every other "no spec-mandated design" decision in this codebase's history.

## Acceptance

A published policy that denies a specific approval type causes `decideApproval` to reject the decision with a clear, policy-attributed error, verified against a real Postgres-backed policy row — not a mock.
