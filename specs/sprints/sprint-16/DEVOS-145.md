# DEVOS-145 — Approval expiry

**Priority:** P1 | **Estimate:** 2d
**Depends on:** None (independent column/status addition).
**Depended on by:** None within this sprint.

## Scope

`Approval` gains a real `expiresAt`; a `PENDING` approval past its expiry transitions to a new terminal `EXPIRED` status (not left pending forever) via the same dispatcher-polling model `WAIT` node execution already established (DEVOS-121) — no new scheduler subsystem. A workflow task blocked on an `EXPIRED` approval reaches a terminal failed/skipped state rather than hanging.

## Implementation

- `packages/contracts/src/status.ts`: `approvalStatuses` gains `'EXPIRED'`.
- `packages/database/migrations/0035_approvals_expiry.ts`: `approvals.expires_at timestamptz` (nullable — an approval with no expiry never auto-expires, preserving every existing approval's behaviour).
- `packages/domain/src/approval/approval.ts`: `Approval.expiresAt?: string`; `ApprovalRepository` gains `expirePending(now: string): Promise<number>` — a direct `UPDATE approvals SET status='EXPIRED' WHERE status='PENDING' AND expires_at IS NOT NULL AND expires_at < :now`, mirroring `TaskQueue.resumeReadyWaits()`'s own shape.
- `apps/worker/src/task-dispatcher.ts`: `createTaskDispatcher` gains an optional `options.approvals`/`options.approvalExpiryIntervalMs`; when supplied, the existing `loop()`'s reclaim tick (the same one `resumeReadyWaits()` already runs on — no new timer) also calls `approvals.expirePending(now)`.
- `runApprovalTask` (`packages/application/src/tasks/run-approval-task.ts`): treats `approval.status === 'EXPIRED'` exactly like `'REJECTED'` — throws `NonRetryableTaskError`, so the existing `queue.fail()`/`resolveTaskFailure()` path (including DEVOS-120's tolerant-`JOIN` semantics) decides whether that fails just this branch or the whole run, identical to a rejection.
- `decideApproval` rejects a decision attempt against an already-`EXPIRED` approval with the existing "Approval is already X" `ValidationError`, unchanged code path (the check is already generic over `approval.status !== 'PENDING'`).

## Out of scope

Expiring the two hardcoded whole-run `PLANNING`/`RELEASE` approvals by default (no `expiresAt` is set for them unless a future task decides they should have one — this task only adds the mechanism, not a policy mandating its use everywhere).

## Acceptance

A real approval created with a real, already-past `expiresAt` is confirmed `PENDING` immediately after creation, then confirmed `EXPIRED` after one real dispatcher tick (via the real `expirePending` call, not a mocked clock) — proven with a real Postgres e2e test mirroring DEVOS-121's own `wait-node.test.ts` convention. A real `APPROVAL` graph node blocked on an approval that then expires reaches a terminal `FAILED` task, and the run fails (or is tolerated by a tolerant `JOIN`) exactly like a rejection. Every existing approval test with no `expiresAt` is unaffected (never auto-expires).
