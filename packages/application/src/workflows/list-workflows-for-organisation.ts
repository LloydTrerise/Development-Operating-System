import type { OrganisationId, WorkflowId, WorkflowVersionStatus } from '@devos/contracts';
import type { WorkflowDefinition } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveOrganisationMembership } from '../organisations/membership-access.js';
import type { WorkflowLibraryUseCaseDeps } from './deps.js';

export interface WorkflowLibraryEntry {
  definition: WorkflowDefinition;
  latestVersionStatus: WorkflowVersionStatus | null;
  versionCount: number;
  runStatusCounts: Record<string, number>;
}

/**
 * Sprint 41 gap closure: `WorkflowLibraryPage.tsx`'s real data source, one
 * query per concern instead of the page's own `Promise.all(projects.map(...))`
 * fan-out (which never resolves against the real seeded organisation's
 * thousands of accumulated projects — see `specs/sprints/sprint-41/README.md`'s
 * gap-closure addendum). Gated by `resolveOrganisationMembership`, mirroring
 * `getOrganisationCostReport`'s own established organisation-scoped gate.
 */
export async function listWorkflowsForOrganisation(
  deps: WorkflowLibraryUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<WorkflowLibraryEntry[]> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');

  const definitions = (await deps.workflowDefinitions.listForOrganisation?.(organisationId)) ?? [];
  if (definitions.length === 0) return [];

  const definitionIds = definitions.map((definition) => definition.id);
  const [versionSummaries, runStatusCounts] = await Promise.all([
    deps.summarizeVersionsForDefinitions(definitionIds),
    deps.summarizeRunStatusCountsForOrganisation(organisationId),
  ]);

  const versionByDefinitionId = new Map(
    versionSummaries.map((summary) => [summary.workflowDefinitionId, summary]),
  );
  const runCountsByDefinitionId = new Map<WorkflowId, Record<string, number>>();
  for (const row of runStatusCounts) {
    const existing = runCountsByDefinitionId.get(row.workflowDefinitionId) ?? {};
    existing[row.status] = row.count;
    runCountsByDefinitionId.set(row.workflowDefinitionId, existing);
  }

  return definitions.map((definition) => {
    const versionSummary = versionByDefinitionId.get(definition.id);
    return {
      definition,
      latestVersionStatus: versionSummary?.latestStatus ?? null,
      versionCount: versionSummary?.versionCount ?? 0,
      runStatusCounts: runCountsByDefinitionId.get(definition.id) ?? {},
    };
  });
}
