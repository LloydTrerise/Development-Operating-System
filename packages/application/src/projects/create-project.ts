import { randomUUID } from 'node:crypto';
import type { CreateProjectInput, Membership, Project } from '@devos/domain';
import { ValidationError } from '../errors.js';
import type { ProjectUseCaseDeps } from './deps.js';

export async function createProject(
  deps: ProjectUseCaseDeps,
  principalId: string,
  input: CreateProjectInput,
): Promise<Project> {
  if (input.name.trim().length === 0) throw new ValidationError('name is required.');
  if (input.slug.trim().length === 0) throw new ValidationError('slug is required.');

  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId: input.organisationId,
    name: input.name,
    slug: input.slug,
    ...(input.description !== undefined ? { description: input.description } : {}),
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  await deps.projects.create(project);

  const membership: Membership = {
    id: randomUUID() as Membership['id'],
    organisationId: input.organisationId,
    projectId: project.id,
    principalId,
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  await deps.memberships.create(membership);

  return project;
}
