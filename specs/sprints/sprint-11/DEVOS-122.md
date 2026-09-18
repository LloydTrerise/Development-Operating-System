# DEVOS-122 — Promote Approval to a first-class graph node

**Priority:** P0 | **Estimate:** 3d
**Depends on:** DEVOS-119 (handler-registration groundwork).

## Scope

An `APPROVAL` node in a workflow graph creates a real, policy-gated approval request (reusing DEVOS-110/111's existing atomic, policy-evaluated decision path unchanged) at the point in the graph it's actually placed, not only at the two hardcoded points the current 4-workflow Software Change chain uses — proven by a workflow whose approval gate sits somewhere that chain never puts one (e.g., mid-branch, after a `PARALLEL` join, DEVOS-120).

## Grounding (confirmed by direct code inspection)

Today's "approval" is not a graph node at all. `maybeCompleteRun` (`packages/database/src/repositories/task-queue.ts`) checks, only once every task in the run has reached `SUCCEEDED`, whether the run's `WorkflowDefinition.policies` array contains one of exactly two hardcoded marker keys (`APPROVAL_GATE_POLICIES`: `planning-approval` → `PLANNING`, `release-approval` → `RELEASE`) and only then calls `requestApproval`. There is no code path that creates an approval mid-run, tied to a specific node's completion.

## Real design decision to confirm before implementation (flagged by the source backlog, `specs/DEVOS-WORKFLOW-EXPANSION-AND-DESIGNER-BACKLOG.md` §8)

Whether the existing `policies`-array-marker mechanism is generalized to be addressable by node id (e.g., a marker keyed `approval:<nodeId>` consulted at that specific task's completion instead of only at whole-run completion), or an `APPROVAL` node becomes a thin new task handler that calls `requestApproval`-equivalent logic directly at its own completion point, pausing only its own downstream dependents (via the same `dependsOn` barrier) rather than the whole run. The second option is more consistent with this sprint's other primitives (a real task handler, not a special-cased run-completion check) and is the working assumption going into implementation — but must be confirmed against `transitionAfterApprovalDecision`'s (`approval-run-transition.ts`) existing run-level `AWAITING_APPROVAL` status contract before committing, since that status is currently modeled at the run level, not the task level.

## Out of scope

A UI for placing an `APPROVAL` node (E21). Changing what `decideApproval`/`transitionAfterApprovalDecision` already do once a decision is made — this task only changes _when and how the request is created_, not the decision path itself.

## Acceptance

A real workflow graph places an `APPROVAL` node somewhere other than immediately before the run's own final completion (e.g., mid-branch), and a real approval request is created at that point, gates only the dependents that actually need it, and — once decided via the existing unchanged API — the run resumes and completes for real against Postgres.
