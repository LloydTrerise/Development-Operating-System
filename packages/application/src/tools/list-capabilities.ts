import type { ProjectId } from '@devos/contracts';
import type { ToolCapability } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ToolUseCaseDeps } from './deps.js';

export async function listCapabilitiesForProject(
  deps: ToolUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<ToolCapability[]> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  return deps.toolCapabilities.listForProject(projectId);
}
