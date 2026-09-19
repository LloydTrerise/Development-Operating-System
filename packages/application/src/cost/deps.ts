import type {
  AgentExecutionRepository,
  MembershipRepository,
  OrganisationRepository,
  ProjectRepository,
} from '@devos/domain';

/**
 * DEVOS-151: mirrors `AuditUseCaseDeps`'s exact shape (project/organisation
 * membership resolution) plus the one repository this use case actually
 * reads from — `agentExecutions`, for DEVOS-150's new cost queries.
 */
export interface CostUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  organisations: OrganisationRepository;
  agentExecutions: AgentExecutionRepository;
}
