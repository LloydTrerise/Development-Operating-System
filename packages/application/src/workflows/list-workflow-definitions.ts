import type { ProjectId, WorkflowVersionStatus } from '@devos/contracts';
import type { WorkflowDefinition, WorkflowVersion } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkflowUseCaseDeps } from './deps.js';

/**
 * DEVOS-135: the library page's own list shape — the plain definition plus
 * its own real latest-version status and version count, both already
 * derivable from `deps.workflowVersions` (already part of
 * `WorkflowUseCaseDeps`), so no deps widening was needed here.
 */
export interface WorkflowDefinitionSummary extends WorkflowDefinition {
  latestVersionStatus: WorkflowVersionStatus | null;
  versionCount: number;
}

export async function listWorkflowDefinitionsForProject(
  deps: WorkflowUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<WorkflowDefinitionSummary[]> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  const definitions = await deps.workflowDefinitions.listForProject(projectId);

  const summaries: WorkflowDefinitionSummary[] = [];
  for (const definition of definitions) {
    const versions = await deps.workflowVersions.listForDefinition(definition.id);
    let latest: WorkflowVersion | undefined;
    for (const version of versions) {
      if (latest === undefined || version.version > latest.version) latest = version;
    }

    summaries.push({
      ...definition,
      latestVersionStatus: latest?.status ?? null,
      versionCount: versions.length,
    });
  }

  return summaries;
}
