import type { ToolCapabilityId } from '@devos/contracts';
import type { ToolCapability } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ToolUseCaseDeps } from './deps.js';

export async function getCapabilityForPrincipal(
  deps: ToolUseCaseDeps,
  principalId: string,
  capabilityId: ToolCapabilityId,
): Promise<ToolCapability> {
  const capability = await deps.toolCapabilities.getById(capabilityId);
  if (!capability) throw new NotFoundError('ToolCapability');

  const project = await deps.projects.getById(capability.projectId);
  if (!project) throw new NotFoundError('ToolCapability');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('ToolCapability');

  return capability;
}
