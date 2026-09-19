import type { ToolInvocation } from '@devos/domain';

/** Mirrors `packages/tools/src/gateway/invoke-tool.ts`'s own constant string literal. */
const REQUIRE_APPROVAL_PENDING_ERROR_CODE = 'DEVOS_TOOL_POLICY_REQUIRE_APPROVAL_PENDING';

/**
 * Gap revisit (post-Sprint-16): a `REJECTED` invocation carrying this
 * specific errorCode is not a permanent failure the way every other
 * `REJECTED`/`FAILED` outcome is — it means a real `Approval` now exists
 * and is still `PENDING` a human decision. Without this check, a task
 * handler's own existing `if (status !== 'SUCCEEDED') throw ...` would
 * exhaust `MAX_TASK_ATTEMPTS` and permanently fail the task while the
 * approval itself is still open — the exact same real gap DEVOS-121's
 * `WAIT`/DEVOS-122's `APPROVAL` node primitives already solved for a
 * graph-level gate, now reused here for a tool-invocation-level one: report
 * the reserved `waitUntil` output key instead of throwing, so the
 * dispatcher parks the task and re-invokes this same handler later (its
 * own idempotencyKey-keyed `invokeTool` calls replay any already-succeeded
 * step instantly and only re-check the one still-pending approval).
 */
export function pendingApprovalWaitUntil(
  invocation: ToolInvocation,
  pollIntervalSeconds = 5,
): string | undefined {
  if (
    invocation.status === 'REJECTED' &&
    invocation.errorCode === REQUIRE_APPROVAL_PENDING_ERROR_CODE
  ) {
    return new Date(Date.now() + pollIntervalSeconds * 1000).toISOString();
  }
  return undefined;
}
