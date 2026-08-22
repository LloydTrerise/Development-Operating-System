import type { WorkflowId } from '@devos/contracts';
import { validateWorkflowGraph, type WorkflowVersion } from '@devos/domain';
import { ValidationError } from '../errors.js';
import { requireDraftVersion } from './draft-access.js';
import type { WorkflowUseCaseDeps } from './deps.js';

export async function publishWorkflowVersion(
  deps: WorkflowUseCaseDeps,
  principalId: string,
  workflowId: WorkflowId,
): Promise<WorkflowVersion> {
  const { draft } = await requireDraftVersion(deps, principalId, workflowId);

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
