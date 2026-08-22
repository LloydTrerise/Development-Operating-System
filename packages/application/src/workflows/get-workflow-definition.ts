import type { WorkflowId } from '@devos/contracts';
import type { WorkflowDefinition } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkflowUseCaseDeps } from './deps.js';

export async function getWorkflowDefinitionForPrincipal(
  deps: WorkflowUseCaseDeps,
  principalId: string,
  workflowId: WorkflowId,
): Promise<WorkflowDefinition> {
  const definition = await deps.workflowDefinitions.getById(workflowId);
  if (!definition) throw new NotFoundError('Workflow');

  const project = await deps.projects.getById(definition.projectId);
  if (!project) throw new NotFoundError('Workflow');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Workflow');

  return definition;
}
