import type { ProjectId } from '@devos/contracts';
import type { Integration } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { IntegrationUseCaseDeps } from './deps.js';

export async function listIntegrationsForProject(
  deps: IntegrationUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<Integration[]> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  return deps.integrations.listForProject(projectId);
}
