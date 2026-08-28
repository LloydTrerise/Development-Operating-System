import type { ProjectTypeId } from '@devos/contracts';
import type { ProjectTypeAgent, UpdateProjectTypeAgentInput } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import type { ProjectTypeUseCaseDeps } from './deps.js';

export async function updateProjectTypeAgent(
  deps: ProjectTypeUseCaseDeps,
  projectTypeId: ProjectTypeId,
  key: string,
  changes: UpdateProjectTypeAgentInput,
): Promise<ProjectTypeAgent> {
  const existing = await deps.projectTypeAgents.getByProjectTypeAndKey(projectTypeId, key);
  if (!existing) throw new NotFoundError('ProjectTypeAgent');

  const updatedAt = new Date().toISOString();
  await deps.projectTypeAgents.update(existing.id, changes, updatedAt);

  return { ...existing, ...changes, updatedAt };
}
