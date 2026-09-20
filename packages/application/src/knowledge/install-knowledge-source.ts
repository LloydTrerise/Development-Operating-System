import { randomUUID } from 'node:crypto';
import type { AuditId, KnowledgeSourceId, ProjectId } from '@devos/contracts';
import type { KnowledgeSource } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { KnowledgeUseCaseDeps } from './deps.js';

/**
 * DEVOS-189 (Sprint 25): a real, organisation-scoped "install" — clones a
 * real, shared `KnowledgeSource`'s content into a brand-new `KnowledgeSource`
 * (`ACTIVE` immediately) under a different project in the **same
 * organisation only** (ADR-SEC-005), mirroring `installAgentVersion`'s
 * (DEVOS-178) real tenant-isolation check exactly — a real, independent
 * copy, never a live/linked reference. Unlike agents, `KnowledgeSource` has
 * a real `(project_id, key)` uniqueness constraint (migration `0018`) with
 * no existing precedent to collide against for agents, so a real key
 * collision in the target project is disambiguated with a short suffix
 * rather than failing the install outright.
 */
export async function installKnowledgeSource(
  deps: KnowledgeUseCaseDeps,
  principalId: string,
  sourceKnowledgeSourceId: KnowledgeSourceId,
  targetProjectId: ProjectId,
): Promise<KnowledgeSource> {
  const source = await deps.knowledgeSources.getById(sourceKnowledgeSourceId);
  if (!source) throw new NotFoundError('KnowledgeSource');
  if (source.sharedAcrossOrganisation !== true) {
    throw new ValidationError('This knowledge source has not been shared with its organisation.');
  }

  const sourceProject = await deps.projects.getById(source.projectId);
  if (!sourceProject) throw new NotFoundError('KnowledgeSource');

  const targetProject = await deps.projects.getById(targetProjectId);
  if (!targetProject) throw new NotFoundError('Project');

  // Real tenant isolation (ADR-SEC-005): a mismatch reports the same
  // `NotFoundError` every other org-scoped route already uses for a
  // cross-tenant attempt — never a distinguishable "forbidden, but it
  // exists" response.
  if (targetProject.organisationId !== sourceProject.organisationId) {
    throw new NotFoundError('KnowledgeSource');
  }

  const membership = await resolveMembership(deps, principalId, targetProject);
  if (!membership) throw new NotFoundError('Project');

  let key = source.key;
  if (await deps.knowledgeSources.getByProjectAndKey(targetProjectId, key)) {
    key = `${source.key}-${randomUUID().slice(0, 8)}`;
  }

  const now = new Date().toISOString();
  const installed: KnowledgeSource = {
    id: randomUUID() as KnowledgeSourceId,
    projectId: targetProjectId,
    key,
    name: source.name,
    sourceType: source.sourceType,
    content: source.content,
    status: 'ACTIVE',
    createdBy: principalId,
    createdAt: now,
    updatedAt: now,
  };
  await deps.knowledgeSources.create(installed);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: targetProject.organisationId,
    projectId: targetProjectId,
    actorType: 'USER',
    actorId: principalId,
    action: 'knowledge-source.installed',
    targetType: 'KnowledgeSource',
    targetId: installed.id,
    outcome: 'SUCCESS',
    metadata: { sourceKnowledgeSourceId: source.id, sourceProjectId: sourceProject.id },
    createdAt: now,
  });

  return installed;
}
