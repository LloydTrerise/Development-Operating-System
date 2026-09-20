import { randomUUID } from 'node:crypto';
import type { AuditId, KnowledgeSourceId } from '@devos/contracts';
import type { KnowledgeSource } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { KnowledgeUseCaseDeps } from './deps.js';

/**
 * DEVOS-182: the real, honest two-state lifecycle this table's own `status`
 * column has supported but never used since Sprint 3 — `ACTIVE` ->
 * `ARCHIVED` only, no draft/review/publish gate (see
 * `specs/sprints/sprint-24/README.md`'s own recorded design decision).
 * `retrieveActiveKnowledgeSources`'s existing `status === 'ACTIVE'` filter
 * already excludes an archived source with zero change to `@devos/knowledge`.
 */
export async function archiveKnowledgeSource(
  deps: KnowledgeUseCaseDeps,
  principalId: string,
  knowledgeSourceId: KnowledgeSourceId,
): Promise<KnowledgeSource> {
  const source = await deps.knowledgeSources.getById(knowledgeSourceId);
  if (!source) throw new NotFoundError('KnowledgeSource');

  const project = await deps.projects.getById(source.projectId);
  if (!project) throw new NotFoundError('KnowledgeSource');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('KnowledgeSource');

  if (source.status === 'ARCHIVED') {
    throw new ValidationError(`Knowledge source "${source.key}" is already archived.`);
  }

  const now = new Date().toISOString();
  await deps.knowledgeSources.update(knowledgeSourceId, { status: 'ARCHIVED' }, now);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId: project.id,
    actorType: 'USER',
    actorId: principalId,
    action: 'knowledge-source.archived',
    targetType: 'KnowledgeSource',
    targetId: source.id,
    outcome: 'SUCCESS',
    metadata: { key: source.key },
    createdAt: now,
  });

  return { ...source, status: 'ARCHIVED', updatedAt: now };
}
