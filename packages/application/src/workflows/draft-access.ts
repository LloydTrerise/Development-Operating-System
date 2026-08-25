import type { WorkflowId } from '@devos/contracts';
import type { Membership, WorkflowDefinition, WorkflowVersion } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkflowUseCaseDeps } from './deps.js';

export async function requireDraftVersion(
  deps: WorkflowUseCaseDeps,
  principalId: string,
  workflowId: WorkflowId,
): Promise<{ definition: WorkflowDefinition; draft: WorkflowVersion; membership: Membership }> {
  const definition = await deps.workflowDefinitions.getById(workflowId);
  if (!definition) throw new NotFoundError('Workflow');

  const project = await deps.projects.getById(definition.projectId);
  if (!project) throw new NotFoundError('Workflow');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Workflow');

  const latest = await deps.workflowVersions.getLatestForDefinition(workflowId);
  if (!latest) throw new NotFoundError('Workflow version');

  if (latest.status !== 'DRAFT') {
    throw new ValidationError(
      'The current workflow version is published and immutable; no draft is available.',
    );
  }

  return { definition, draft: latest, membership };
}
