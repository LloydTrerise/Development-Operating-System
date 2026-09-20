import { randomUUID } from 'node:crypto';
import type { AuditId, KnowledgeSourceId } from '@devos/contracts';
import type { KnowledgeSource } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { KnowledgeUseCaseDeps } from './deps.js';

export interface UpdateKnowledgeSourceInput {
  name?: string;
  content?: string;
  sourceType?: string;
}

/**
 * DEVOS-182: closes the create-only gap `KnowledgeSourceRepository` has had
 * since Sprint 3 — mirrors `createKnowledgeSource`'s own validation shape
 * exactly, applied to an edit instead of a creation.
 */
export async function updateKnowledgeSource(
  deps: KnowledgeUseCaseDeps,
  principalId: string,
  knowledgeSourceId: KnowledgeSourceId,
  input: UpdateKnowledgeSourceInput,
): Promise<KnowledgeSource> {
  const source = await deps.knowledgeSources.getById(knowledgeSourceId);
  if (!source) throw new NotFoundError('KnowledgeSource');

  const project = await deps.projects.getById(source.projectId);
  if (!project) throw new NotFoundError('KnowledgeSource');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('KnowledgeSource');

  if (input.name !== undefined && input.name.trim().length === 0) {
    throw new ValidationError('name cannot be empty.');
  }
  if (input.content !== undefined && input.content.trim().length === 0) {
    throw new ValidationError('content cannot be empty.');
  }
  if (input.sourceType !== undefined && input.sourceType.trim().length === 0) {
    throw new ValidationError('sourceType cannot be empty.');
  }

  const now = new Date().toISOString();
  await deps.knowledgeSources.update(
    knowledgeSourceId,
    {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
    },
    now,
  );

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId: project.id,
    actorType: 'USER',
    actorId: principalId,
    action: 'knowledge-source.updated',
    targetType: 'KnowledgeSource',
    targetId: source.id,
    outcome: 'SUCCESS',
    metadata: { key: source.key, fields: Object.keys(input) },
    createdAt: now,
  });

  return {
    ...source,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
    updatedAt: now,
  };
}
