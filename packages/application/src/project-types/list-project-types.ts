import type { ProjectType } from '@devos/domain';
import type { ProjectTypeUseCaseDeps } from './deps.js';

export function listProjectTypes(deps: ProjectTypeUseCaseDeps): Promise<ProjectType[]> {
  return deps.projectTypes.list();
}
