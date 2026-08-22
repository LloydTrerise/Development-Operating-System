import { createHash, randomUUID } from 'node:crypto';
import type { ArtifactVersionId, ProjectId, WorkflowRunId } from '@devos/contracts';
import type { Approval } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ApprovalUseCaseDeps } from './deps.js';

export interface RequestApprovalInput {
  workflowRunId: WorkflowRunId;
  approvalType: string;
  artifactVersionIds: string[];
}

/**
 * A scope hash over the exact evidence being approved (specs/api/poc-api-contracts.md
 * §29–§30). Sorted before hashing so evidence order never affects the hash.
 * Also computed independently in `packages/database/src/repositories/task-queue.ts`'s
 * planning-approval auto-request (DEVOS-047) — kept as two small, identical
 * copies rather than a shared helper in `packages/domain`, since `packages/domain`
 * is deliberately platform-agnostic and has no Node.js `crypto` types
 * configured (unlike `packages/application`/`packages/database`, which
 * already do).
 */
function computeScopeHash(artifactVersionIds: string[]): string {
  const sorted = [...artifactVersionIds].sort();
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

export async function requestApproval(
  deps: ApprovalUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
  input: RequestApprovalInput,
): Promise<Approval> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  if (input.approvalType.trim().length === 0) {
    throw new ValidationError('approvalType is required.');
  }
  if (input.artifactVersionIds.length === 0) {
    throw new ValidationError('artifactVersionIds must not be empty.');
  }

  const run = await deps.workflowRuns.getById(input.workflowRunId);
  if (!run || run.projectId !== projectId) throw new NotFoundError('WorkflowRun');

  for (const artifactVersionId of input.artifactVersionIds) {
    const version = await deps.artifactVersions.getById(artifactVersionId as ArtifactVersionId);
    if (!version) {
      throw new ValidationError(`Artifact version "${artifactVersionId}" does not exist.`);
    }
  }

  const existing = await deps.approvals.getPendingForRunAndType(
    input.workflowRunId,
    input.approvalType,
  );
  if (existing) {
    throw new ValidationError(
      `An approval of type "${input.approvalType}" is already pending for this run.`,
    );
  }

  const now = new Date().toISOString();
  const approval: Approval = {
    id: randomUUID() as Approval['id'],
    projectId,
    workflowRunId: input.workflowRunId,
    approvalType: input.approvalType,
    status: 'PENDING',
    requestedBy: principalId,
    evidenceReference: {
      artifactVersionIds: input.artifactVersionIds,
      scopeHash: computeScopeHash(input.artifactVersionIds),
    },
    requestedAt: now,
  };

  await deps.approvals.create(approval);

  return approval;
}
