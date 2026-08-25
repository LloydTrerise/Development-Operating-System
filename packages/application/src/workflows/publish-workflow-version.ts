import type { WorkflowId } from '@devos/contracts';
import { canPublishWorkflow, validateWorkflowGraph, type WorkflowVersion } from '@devos/domain';
import { ForbiddenError, ValidationError } from '../errors.js';
import { requireDraftVersion } from './draft-access.js';
import type { WorkflowUseCaseDeps } from './deps.js';

export async function publishWorkflowVersion(
  deps: WorkflowUseCaseDeps,
  principalId: string,
  workflowId: WorkflowId,
): Promise<WorkflowVersion> {
  const { draft, membership } = await requireDraftVersion(deps, principalId, workflowId);
  if (!canPublishWorkflow(membership.role)) {
    throw new ForbiddenError('Only a project owner may publish a workflow version.');
  }

  const issues = validateWorkflowGraph(draft.definition);
  if (issues.length > 0) {
    throw new ValidationError(
      `Cannot publish an invalid workflow: ${issues.map((issue) => `${issue.field}: ${issue.message}`).join('; ')}`,
    );
  }

  const publishedAt = new Date().toISOString();
  await deps.workflowVersions.publish(draft.id, publishedAt);

  return { ...draft, status: 'PUBLISHED', publishedAt };
}
