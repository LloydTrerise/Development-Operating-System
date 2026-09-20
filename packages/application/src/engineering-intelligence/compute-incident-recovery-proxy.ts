import type { ProjectId } from '@devos/contracts';
import type { RecoveryProxySummary } from '@devos/domain';
import type { EngineeringIntelligenceUseCaseDeps } from './deps.js';

/** DEVOS-169: the seeded Incident Response `ProjectType.key` (`packages/database/src/seed.ts`) — checked by value, not a seed-constant import (`@devos/application` cannot depend on `@devos/database`). */
const INCIDENT_RESPONSE_PROJECT_TYPE_KEY = 'incident-response';

/**
 * DEVOS-169: the second, distinct time-to-restore proxy — real
 * `WorkItem.createdAt` → `metadata.closedAt` for closed incident work
 * items, scoped to projects whose `ProjectType.key` is the seeded Incident
 * Response type. Returns `undefined` (not a `0`-sample summary) when the
 * project is not an Incident Response project — genuinely absent, not an
 * empty result, so a caller/UI can distinguish "not applicable" from "no
 * incidents yet."
 */
export async function computeIncidentRecoveryProxyForProject(
  deps: EngineeringIntelligenceUseCaseDeps,
  projectId: ProjectId,
): Promise<RecoveryProxySummary | undefined> {
  const project = await deps.projects.getById(projectId);
  if (!project) return undefined;

  const projectType = await deps.projectTypes.getById(project.projectTypeId);
  if (!projectType || projectType.key !== INCIDENT_RESPONSE_PROJECT_TYPE_KEY) return undefined;

  const workItems = await deps.workItems.listForProject(projectId);
  const samplesMs = workItems
    .filter((workItem) => workItem.status === 'CLOSED')
    .map((workItem) => {
      const closedAt = workItem.metadata.closedAt;
      if (typeof closedAt !== 'string') return undefined;
      return Date.parse(closedAt) - Date.parse(workItem.createdAt);
    })
    .filter((sample): sample is number => sample !== undefined);

  const meanMs =
    samplesMs.length === 0
      ? 0
      : samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;

  return {
    sampleCount: samplesMs.length,
    meanMs,
    label: 'incident-work-item-created-to-closed',
  };
}
