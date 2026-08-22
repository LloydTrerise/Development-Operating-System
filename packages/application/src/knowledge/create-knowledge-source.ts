import { randomUUID } from 'node:crypto';
import type { ProjectId } from '@devos/contracts';
import type { KnowledgeSource } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { KnowledgeUseCaseDeps } from './deps.js';

export interface CreateKnowledgeSourceInput {
  key: string;
  name: string;
  sourceType: string;
  content: string;
}

export async function createKnowledgeSource(
  deps: KnowledgeUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
  input: CreateKnowledgeSourceInput,
): Promise<KnowledgeSource> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  if (input.key.trim().length === 0) throw new ValidationError('key is required.');
  if (input.name.trim().length === 0) throw new ValidationError('name is required.');
  if (input.sourceType.trim().length === 0) throw new ValidationError('sourceType is required.');
  if (input.content.trim().length === 0) throw new ValidationError('content is required.');

  const existing = await deps.knowledgeSources.getByProjectAndKey(projectId, input.key);
  if (existing) {
    throw new ValidationError(`A knowledge source with key "${input.key}" already exists.`);
  }

  const now = new Date().toISOString();
  const source: KnowledgeSource = {
    id: randomUUID() as KnowledgeSource['id'],
    projectId,
    key: input.key,
    name: input.name,
    sourceType: input.sourceType,
    content: input.content,
    status: 'ACTIVE',
    createdBy: principalId,
    createdAt: now,
    updatedAt: now,
  };

  await deps.knowledgeSources.create(source);

  return source;
}
