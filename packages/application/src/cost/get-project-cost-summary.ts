import type { ProjectId } from '@devos/contracts';
import type { AgentExecutionRepository, CostBreakdownRow } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { CostUseCaseDeps } from './deps.js';

export interface ProjectCostSummary {
  projectId: ProjectId;
  totalUsd: number;
  budgetUsd?: number;
  breakdownByRole: CostBreakdownRow[];
  /** DEVOS-156: attribution by which workflow definition caused the spend. */
  breakdownByWorkflow: CostBreakdownRow[];
  /** DEVOS-156: attribution by which work item caused the spend. */
  breakdownByWorkItem: CostBreakdownRow[];
}

async function optional(
  query: (() => Promise<CostBreakdownRow[]>) | undefined,
): Promise<CostBreakdownRow[]> {
  return query ? query() : [];
}

/**
 * DEVOS-151/DEVOS-156: the real cost API surface's project-scoped read —
 * reuses DEVOS-098's pre-existing `sumEstimatedCostUsdForProject` plus
 * DEVOS-150's `costBreakdownByRoleForProject` and DEVOS-156's new
 * workflow/work-item breakdown queries, all returned together (every
 * query here is a cheap, already-project-scoped aggregate — no query
 * parameter or router change needed to select one). Gated by the same
 * membership check `listAuditRecordsForProject` already establishes.
 * Every repository method is optional (only the real Postgres repository
 * implements them); a fake lacking one simply reports an empty breakdown
 * rather than throwing, matching `maybeAlertOnBudgetExceeded`'s own
 * established no-op-when-absent convention.
 */
export async function getProjectCostSummary(
  deps: CostUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<ProjectCostSummary> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  const agentExecutions: AgentExecutionRepository = deps.agentExecutions;
  const totalUsd = agentExecutions.sumEstimatedCostUsdForProject
    ? await agentExecutions.sumEstimatedCostUsdForProject(projectId)
    : 0;
  const [breakdownByRole, breakdownByWorkflow, breakdownByWorkItem] = await Promise.all([
    optional(agentExecutions.costBreakdownByRoleForProject?.bind(agentExecutions, projectId)),
    optional(agentExecutions.costBreakdownByWorkflowForProject?.bind(agentExecutions, projectId)),
    optional(agentExecutions.costBreakdownByWorkItemForProject?.bind(agentExecutions, projectId)),
  ]);

  return {
    projectId,
    totalUsd,
    ...(project.budgetUsd !== undefined ? { budgetUsd: project.budgetUsd } : {}),
    breakdownByRole,
    breakdownByWorkflow,
    breakdownByWorkItem,
  };
}
