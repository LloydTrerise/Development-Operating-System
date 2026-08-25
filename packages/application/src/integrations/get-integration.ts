import type { IntegrationId } from '@devos/contracts';
import type { Integration } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { IntegrationUseCaseDeps } from './deps.js';

export async function getIntegrationForPrincipal(
  deps: IntegrationUseCaseDeps,
  principalId: string,
  integrationId: IntegrationId,
): Promise<Integration> {
  const integration = await deps.integrations.getById(integrationId);
  if (!integration) throw new NotFoundError('Integration');

  const project = await deps.projects.getById(integration.projectId);
  if (!project) throw new NotFoundError('Integration');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Integration');

  return integration;
}
