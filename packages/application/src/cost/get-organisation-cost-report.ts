import type { OrganisationId } from '@devos/contracts';
import type { AgentExecutionRepository, CostBreakdownRow } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveOrganisationMembership } from '../organisations/membership-access.js';
import type { CostUseCaseDeps } from './deps.js';

export interface OrganisationCostReport {
  organisationId: OrganisationId;
  totalUsd: number;
  budgetUsd?: number;
  projectCount: number;
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
 * DEVOS-151/DEVOS-155/DEVOS-156: the organisation-scoped mirror of
 * `getProjectCostSummary` — reuses DEVOS-150's `sumEstimatedCostUsdForOrganisation`/
 * `costBreakdownByRoleForOrganisation`, DEVOS-155's now-real
 * `Organisation.budgetUsd`, and DEVOS-156's workflow/work-item breakdown
 * queries, all returned together. Gated by the same
 * `resolveOrganisationMembership` check `listAuditRecordsForOrganisation`
 * (DEVOS-147) already establishes. Tenant isolation (ADR-SEC-005): this
 * never reaches across organisations.
 */
export async function getOrganisationCostReport(
  deps: CostUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<OrganisationCostReport> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');

  const agentExecutions: AgentExecutionRepository = deps.agentExecutions;
  const totalUsd = agentExecutions.sumEstimatedCostUsdForOrganisation
    ? await agentExecutions.sumEstimatedCostUsdForOrganisation(organisationId)
    : 0;
  const [breakdownByRole, breakdownByWorkflow, breakdownByWorkItem] = await Promise.all([
    optional(
      agentExecutions.costBreakdownByRoleForOrganisation?.bind(agentExecutions, organisationId),
    ),
    optional(
      agentExecutions.costBreakdownByWorkflowForOrganisation?.bind(agentExecutions, organisationId),
    ),
    optional(
      agentExecutions.costBreakdownByWorkItemForOrganisation?.bind(agentExecutions, organisationId),
    ),
  ]);
  const projects = await deps.projects.listForOrganisation(organisationId);

  return {
    organisationId,
    totalUsd,
    ...(organisation.budgetUsd !== undefined ? { budgetUsd: organisation.budgetUsd } : {}),
    projectCount: projects.length,
    breakdownByRole,
    breakdownByWorkflow,
    breakdownByWorkItem,
  };
}
