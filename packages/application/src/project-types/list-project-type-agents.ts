import type { ProjectTypeId } from '@devos/contracts';
import type { ProjectTypeAgent } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import type { ProjectTypeUseCaseDeps } from './deps.js';

export async function listProjectTypeAgents(
  deps: ProjectTypeUseCaseDeps,
  projectTypeId: ProjectTypeId,
): Promise<ProjectTypeAgent[]> {
  const projectType = await deps.projectTypes.getById(projectTypeId);
  if (!projectType) throw new NotFoundError('ProjectType');

  return deps.projectTypeAgents.listForProjectType(projectTypeId);
}
