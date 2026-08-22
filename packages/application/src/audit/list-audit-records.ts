import type { ProjectId } from '@devos/contracts';
import type { AuditRecord } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { AuditUseCaseDeps } from './deps.js';

export async function listAuditRecordsForProject(
  deps: AuditUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
  limit?: number,
): Promise<AuditRecord[]> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  return deps.auditRecords.listForProject(projectId, limit);
}
