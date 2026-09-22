import type { ProjectId } from '@devos/contracts';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { SystemHealthUseCaseDeps } from './deps.js';

export interface SystemHealthCounts {
  total: number;
  active: number;
}

export interface ProjectSystemHealth {
  projectId: ProjectId;
  integrations: SystemHealthCounts;
  capabilities: SystemHealthCounts;
}

/**
 * DEVOS-258: aggregates real, already-available signals — per-integration
 * `status`, per-capability `status` — into one richer read. Deliberately
 * does not fabricate an "ok/degraded" verdict from these counts: a
 * `DISABLED` capability (DEVOS-256) is a real admin action, not a fault.
 * The one signal with genuine ok/error semantics today — database
 * connectivity — is composed in at the route layer instead, keeping this
 * use case free of any `DatabaseClient` dependency.
 */
export async function getProjectSystemHealth(
  deps: SystemHealthUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<ProjectSystemHealth> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  const [integrations, capabilities] = await Promise.all([
    deps.integrations.listForProject(projectId),
    deps.toolCapabilities.listForProject(projectId),
  ]);

  return {
    projectId,
    integrations: {
      total: integrations.length,
      active: integrations.filter((integration) => integration.status === 'ACTIVE').length,
    },
    capabilities: {
      total: capabilities.length,
      active: capabilities.filter((capability) => capability.status === 'ACTIVE').length,
    },
  };
}
