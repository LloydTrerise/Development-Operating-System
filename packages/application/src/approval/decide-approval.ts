import type { ApprovalId } from '@devos/contracts';
import { canDecideApproval, type Approval } from '@devos/domain';
import { evaluatePolicies } from '@devos/policy';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import { startRunForVersion } from '../workflows/run-creation.js';
import type { ApprovalUseCaseDeps } from './deps.js';

const TERMINAL_RUN_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

/**
 * DEVOS-112: no numeric bound is specified anywhere in the spec corpus for
 * the re-planning loop either — the same flagged-assumption discipline
 * `MAX_AUTOMATIC_REWORK_CYCLES` (`run-review-agent-task.ts`, DEVOS-068)
 * already established for the development rework loop, reused verbatim
 * here rather than inventing an unrelated number for a structurally
 * identical "an automatic loop needs a bound" situation.
 */
const MAX_AUTOMATIC_REPLANNING_CYCLES = 2;

export interface DecideApprovalInput {
  scopeHash: string;
  comment?: string;
}

/**
 * Shared verification for both approve and reject (specs/api/poc-api-contracts.md
 * §30: "The server verifies: approval scope hash; reviewer role; current
 * workflow state; applicable policy."):
 *
 * - scope hash: the caller must supply the exact hash computed over the
 *   evidence at request time — "the client cannot grant itself authority
 *   through the request payload" (§30) is enforced by requiring the caller
 *   to already know/reproduce server-computed evidence, not merely assert a
 *   decision.
 * - reviewer role: no dedicated "reviewer" role exists in this codebase
 *   (only `OWNER`/`MEMBER`, specs/database/poc-database-schema.md has no
 *   documented reviewer concept either) — `OWNER` is used as the reviewer
 *   role, an explicit assumption, consistent with every other consequential
 *   project action (e.g. removing the last owner) already requiring it.
 * - current workflow state: a decision cannot be recorded against a run
 *   that has already reached a terminal state.
 * - applicable policy (DEVOS-110): a published policy can name an
 *   approval's own `approvalType` as its `action` (no spec defines what a
 *   policy scoped to an *approval*, as opposed to a tool invocation, should
 *   evaluate against — this is this task's own flagged, recorded
 *   assumption, the same "no spec-mandated design" pattern the Tool
 *   Gateway's own capability-key-as-action check already established). A
 *   non-`ALLOW` decision (`DENY`, `REQUIRE_APPROVAL`, or an unresolved
 *   `CONFLICT` between policies) rejects the decision itself with a clear,
 *   policy-attributed error, mirroring `invoke-tool.ts`'s own
 *   `DEVOS_TOOL_POLICY_${decision}` naming.
 */
async function decideApproval(
  deps: ApprovalUseCaseDeps,
  principalId: string,
  approvalId: ApprovalId,
  status: 'APPROVED' | 'REJECTED',
  input: DecideApprovalInput,
): Promise<Approval> {
  const approval = await deps.approvals.getById(approvalId);
  if (!approval) throw new NotFoundError('Approval');

  const project = await deps.projects.getById(approval.projectId);
  if (!project) throw new NotFoundError('Approval');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Approval');
  if (!canDecideApproval(membership.role)) {
    throw new ForbiddenError('Only a project owner may decide an approval.');
  }

  if (approval.status !== 'PENDING') {
    throw new ValidationError(`Approval is already ${approval.status}.`);
  }

  const run = await deps.workflowRuns.getById(approval.workflowRunId);
  if (!run) throw new NotFoundError('Approval');
  if (TERMINAL_RUN_STATUSES.has(run.status)) {
    throw new ValidationError(`Workflow run has already reached a terminal state (${run.status}).`);
  }

  if (input.scopeHash !== approval.evidenceReference.scopeHash) {
    throw new ValidationError(
      'scopeHash does not match the evidence this approval was requested against.',
    );
  }

  const policies = await deps.policies.listForProject(project.id);
  const policyDecision = evaluatePolicies(policies, {
    action: approval.approvalType,
    actorRole: membership.role,
    resourceType: 'APPROVAL',
  });
  if (policyDecision.decision !== 'ALLOW') {
    throw new ForbiddenError(
      `Policy ${policyDecision.decision === 'CONFLICT' ? 'conflict' : 'denial'} for approval type "${approval.approvalType}": ${policyDecision.reason}`,
    );
  }

  const decidedAt = new Date().toISOString();
  // DEVOS-111: one atomic transaction — a crash between the decision write
  // and the run transition can no longer leave one applied without the
  // other.
  await deps.decideApprovalAndTransition(
    approval.id,
    approval.workflowRunId,
    approval.approvalType,
    status,
    principalId,
    input.comment,
    decidedAt,
  );

  // DEVOS-112: "Changes Requested -> appropriate planning stage -> new
  // artifact version -> re-approval" (specs/workflows/software-change-workflow.md
  // §16) — a rejected planning approval previously just failed the run
  // outright. Mirrors `runReviewAgentTask`'s own already-working
  // CHANGES_REQUIRED rework-run pattern exactly: a new run of the same
  // workflow version, for the same work item, bounded by
  // `MAX_AUTOMATIC_REPLANNING_CYCLES`, with the count tracked in the work
  // item's own `metadata` (the same mechanism, a different counter key, so
  // a development rework cycle and a planning re-plan cycle never share —
  // or clobber — each other's bound). Attributed to the real deciding
  // principal (not a system actor) since a human's own rejection is what
  // triggers it, unlike the review agent's fully automatic loop.
  if (status === 'REJECTED' && approval.approvalType === 'PLANNING') {
    const workItem = await deps.workItems.getById(run.workItemId);
    if (workItem) {
      const replanCount =
        typeof workItem.metadata.planningReworkCount === 'number'
          ? workItem.metadata.planningReworkCount
          : 0;
      const replanNow = new Date().toISOString();

      if (replanCount < MAX_AUTOMATIC_REPLANNING_CYCLES) {
        await deps.workItems.update(
          workItem.id,
          { metadata: { ...workItem.metadata, planningReworkCount: replanCount + 1 } },
          replanNow,
        );

        const workflowVersion = await deps.workflowVersions.getById(run.workflowVersionId);
        if (!workflowVersion) {
          throw new Error(`Workflow version ${run.workflowVersionId} not found.`);
        }

        await startRunForVersion(deps, principalId, workflowVersion, {
          workItemId: workItem.id,
          inputs: run.input,
          idempotencyKey: `${approval.id}:replan-${replanCount + 1}`,
        });
      } else {
        await deps.workItems.update(workItem.id, { status: 'REWORK_LIMIT_REACHED' }, replanNow);
      }
    }
  }

  return {
    ...approval,
    status,
    decidedBy: principalId,
    ...(input.comment !== undefined ? { decisionReason: input.comment } : {}),
    decidedAt,
  };
}

export async function approveApproval(
  deps: ApprovalUseCaseDeps,
  principalId: string,
  approvalId: ApprovalId,
  input: DecideApprovalInput,
): Promise<Approval> {
  return decideApproval(deps, principalId, approvalId, 'APPROVED', input);
}

export async function rejectApproval(
  deps: ApprovalUseCaseDeps,
  principalId: string,
  approvalId: ApprovalId,
  input: DecideApprovalInput,
): Promise<Approval> {
  return decideApproval(deps, principalId, approvalId, 'REJECTED', input);
}
