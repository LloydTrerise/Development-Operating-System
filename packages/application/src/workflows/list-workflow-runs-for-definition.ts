import type { WorkflowId } from '@devos/contracts';
import type { WorkflowRun } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ListWorkflowRunsForDefinitionDeps } from './deps.js';

/**
 * DEVOS-135: a workflow definition's own real run-health summary — every
 * run across every one of its versions, powering the library page's
 * real "N succeeded / M failed" count (reusing `RunsPage.tsx`'s own
 * established `RUN_TERMINAL_STATUSES` categorization client-side, not a
 * new server-side metric).
 */
export async function listWorkflowRunsForDefinition(
  deps: ListWorkflowRunsForDefinitionDeps,
  principalId: string,
  workflowId: WorkflowId,
): Promise<WorkflowRun[]> {
  const definition = await deps.workflowDefinitions.getById(workflowId);
  if (!definition) throw new NotFoundError('Workflow');

  const project = await deps.projects.getById(definition.projectId);
  if (!project) throw new NotFoundError('Workflow');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Workflow');

  return deps.listRunsForDefinition(workflowId);
}
