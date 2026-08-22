import type { WorkflowId } from '@devos/contracts';
import type { WorkflowVersion } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkflowUseCaseDeps } from './deps.js';

export async function getWorkflowVersionByNumber(
  deps: WorkflowUseCaseDeps,
  principalId: string,
  workflowId: WorkflowId,
  versionNumber: number,
): Promise<WorkflowVersion> {
  const definition = await deps.workflowDefinitions.getById(workflowId);
  if (!definition) throw new NotFoundError('Workflow version');

  const project = await deps.projects.getById(definition.projectId);
  if (!project) throw new NotFoundError('Workflow version');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Workflow version');

  const version = await deps.workflowVersions.getByDefinitionAndVersion(workflowId, versionNumber);
  if (!version) throw new NotFoundError('Workflow version');

  return version;
}
