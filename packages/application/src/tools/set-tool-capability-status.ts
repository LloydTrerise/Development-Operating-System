import { randomUUID } from 'node:crypto';
import type { AuditId, ProjectId, ToolCapabilityId } from '@devos/contracts';
import { toolCapabilityStatuses, type ToolCapabilityStatus } from '@devos/contracts';
import { canManageToolCapabilities, type ToolCapability } from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ToolUseCaseDeps } from './deps.js';

/**
 * DEVOS-256: the missing toggle path — `invoke-tool.ts` already rejects a
 * non-`ACTIVE` capability; this is the first place anything can transition
 * one into (or back out of) `DISABLED`. Accepts either status, not just
 * `DISABLED` — a one-way-only toggle would be an avoidable usability gap
 * the backlog's own "enable/disable" framing already implies should not
 * exist.
 */
export async function setToolCapabilityStatus(
  deps: ToolUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
  capabilityId: ToolCapabilityId,
  status: ToolCapabilityStatus,
): Promise<ToolCapability> {
  if (!toolCapabilityStatuses.includes(status)) {
    throw new ValidationError(`status must be one of: ${toolCapabilityStatuses.join(', ')}.`);
  }

  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');
  if (!canManageToolCapabilities(membership.role)) throw new ForbiddenError();

  const capability = await deps.toolCapabilities.getById(capabilityId);
  if (!capability || capability.projectId !== projectId) throw new NotFoundError('ToolCapability');

  const previousStatus = capability.status;
  if (previousStatus !== status) {
    await deps.toolCapabilities.updateStatus?.(capabilityId, status);

    await deps.auditRecords?.create({
      id: randomUUID() as AuditId,
      organisationId: project.organisationId,
      projectId,
      actorType: 'USER',
      actorId: principalId,
      action: 'tool_capability.status_changed',
      targetType: 'ToolCapability',
      targetId: capability.id,
      outcome: 'SUCCESS',
      metadata: { key: capability.key, previousStatus, status },
      createdAt: new Date().toISOString(),
    });
  }

  return { ...capability, status };
}
