import type { ProjectTypeId } from '@devos/contracts';
import type { ProjectType } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import type { ProjectTypeUseCaseDeps } from './deps.js';

export async function getProjectType(
  deps: ProjectTypeUseCaseDeps,
  id: ProjectTypeId,
): Promise<ProjectType> {
  const projectType = await deps.projectTypes.getById(id);
  if (!projectType) throw new NotFoundError('ProjectType');
  return projectType;
}
