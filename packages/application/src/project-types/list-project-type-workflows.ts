import type { ProjectTypeId } from '@devos/contracts';
import type { ProjectTypeWorkflow } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import type { ProjectTypeUseCaseDeps } from './deps.js';

export async function listProjectTypeWorkflows(
  deps: ProjectTypeUseCaseDeps,
  projectTypeId: ProjectTypeId,
): Promise<ProjectTypeWorkflow[]> {
  const projectType = await deps.projectTypes.getById(projectTypeId);
  if (!projectType) throw new NotFoundError('ProjectType');

  return deps.projectTypeWorkflows.listForProjectType(projectTypeId);
}
