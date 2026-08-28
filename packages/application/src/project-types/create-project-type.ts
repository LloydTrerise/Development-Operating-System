import { randomUUID } from 'node:crypto';
import type { CreateProjectTypeInput, ProjectType } from '@devos/domain';
import { ValidationError } from '../errors.js';
import type { ProjectTypeUseCaseDeps } from './deps.js';

export async function createProjectType(
  deps: ProjectTypeUseCaseDeps,
  input: CreateProjectTypeInput,
): Promise<ProjectType> {
  if (input.key.trim().length === 0) throw new ValidationError('key is required.');
  if (input.name.trim().length === 0) throw new ValidationError('name is required.');

  const existing = await deps.projectTypes.getByKey(input.key);
  if (existing) throw new ValidationError(`A project type with key "${input.key}" already exists.`);

  const now = new Date().toISOString();
  const projectType: ProjectType = {
    id: randomUUID() as ProjectType['id'],
    key: input.key,
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  await deps.projectTypes.create(projectType);

  return projectType;
}
