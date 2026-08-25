import type { WorkItemId } from '@devos/contracts';
import type {
  ProjectRepository,
  WorkflowRun,
  WorkflowRunRepository,
  WorkItemRepository,
} from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership, type MembershipAccessDeps } from '../projects/membership-access.js';

/**
 * Narrower than any of the existing workflow-use-case deps shapes (mirrors
 * `GetWorkflowRunDeps`'s own precedent), so this can be composed wherever
 * needed without pulling in unrelated fields. DEVOS-086: no longer extends
 * `ProjectUseCaseDeps` — that would also require `auditRecords`, which
 * nothing here needs.
 */
export interface GetWorkflowRunsForWorkItemDeps extends MembershipAccessDeps {
  projects: ProjectRepository;
  workItems: WorkItemRepository;
  workflowRuns: WorkflowRunRepository;
}

/**
 * DEVOS-080: closes the gap DEVOS-071 flagged — "no API exposes a work
 * item's runs" — needed now that one work item's change genuinely spans
 * multiple runs (planning, development, release, DEVOS-079), so a single
 * run's own timeline (DEVOS-036/060/070's per-run `RunCard`) is no longer
 * the complete picture. Returns every run for the work item, oldest first
 * (`listForWorkItem`'s own ordering), after the same `resolveMembership`
 * authorization check every other project-scoped use case already performs.
 */
export async function getWorkflowRunsForWorkItem(
  deps: GetWorkflowRunsForWorkItemDeps,
  principalId: string,
  workItemId: WorkItemId,
): Promise<WorkflowRun[]> {
  const workItem = await deps.workItems.getById(workItemId);
  if (!workItem) throw new NotFoundError('WorkItem');

  const project = await deps.projects.getById(workItem.projectId);
  if (!project) throw new NotFoundError('WorkItem');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('WorkItem');

  return deps.workflowRuns.listForWorkItem(workItemId);
}
