import type { ProjectTypeId } from '@devos/contracts';
import type { ProjectType, UpdateProjectTypeInput } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import type { ProjectTypeUseCaseDeps } from './deps.js';

export async function updateProjectType(
  deps: ProjectTypeUseCaseDeps,
  id: ProjectTypeId,
  changes: UpdateProjectTypeInput,
): Promise<ProjectType> {
  const existing = await deps.projectTypes.getById(id);
  if (!existing) throw new NotFoundError('ProjectType');

  const updatedAt = new Date().toISOString();
  await deps.projectTypes.update(id, changes, updatedAt);

  return { ...existing, ...changes, updatedAt };
}
