import { randomUUID } from 'node:crypto';
import type { ProjectTypeId } from '@devos/contracts';
import type { CreateProjectTypeAgentInput, ProjectTypeAgent } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import type { ProjectTypeUseCaseDeps } from './deps.js';

export async function createProjectTypeAgent(
  deps: ProjectTypeUseCaseDeps,
  projectTypeId: ProjectTypeId,
  input: CreateProjectTypeAgentInput,
): Promise<ProjectTypeAgent> {
  const projectType = await deps.projectTypes.getById(projectTypeId);
  if (!projectType) throw new NotFoundError('ProjectType');

  if (input.key.trim().length === 0) throw new ValidationError('key is required.');
  if (input.name.trim().length === 0) throw new ValidationError('name is required.');

  const existing = await deps.projectTypeAgents.getByProjectTypeAndKey(projectTypeId, input.key);
  if (existing) {
    throw new ValidationError(`An agent template with key "${input.key}" already exists.`);
  }

  const now = new Date().toISOString();
  const agent: ProjectTypeAgent = {
    id: randomUUID() as ProjectTypeAgent['id'],
    projectTypeId,
    key: input.key,
    name: input.name,
    configuration: input.configuration,
    ...(input.promptReference !== undefined ? { promptReference: input.promptReference } : {}),
    createdAt: now,
    updatedAt: now,
  };

  await deps.projectTypeAgents.create(agent);

  return agent;
}
