import type {
  Agent,
  AgentVersion,
  AuditRecordRepository,
  ListEffectiveProjectIdsForPrincipal,
  Membership,
  MembershipRepository,
  Project,
  ProjectRepository,
  ProjectTypeAgentRepository,
  ProjectTypeRepository,
  ProjectTypeWorkflowRepository,
  WorkflowDefinition,
  WorkflowVersion,
} from '@devos/domain';

export type CreateProjectWithClones = (
  project: Project,
  membership: Membership,
  workflows: { definition: WorkflowDefinition; version: WorkflowVersion }[],
  agents: { agent: Agent; version: AgentVersion }[],
) => Promise<void>;

export interface ProjectUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  /** DEVOS-086: membership add/remove/role-change are audited. */
  auditRecords: AuditRecordRepository;
  /**
   * specs/architecture/organisations-and-project-types.md §8: createProject
   * validates the target ProjectType is ACTIVE and clones its workflow/agent
   * templates into the new project.
   */
  projectTypes: ProjectTypeRepository;
  projectTypeWorkflows: ProjectTypeWorkflowRepository;
  projectTypeAgents: ProjectTypeAgentRepository;
  createProjectWithClones: CreateProjectWithClones;
  /** DEVOS-292: real, single-query effective access (direct membership +
   * organisation-wide `ORGANISATION_ADMIN`/owner reach) via the
   * `effective_project_access` view — optional, matching this codebase's
   * established "additive dependency, real implementation only where
   * wired" convention (e.g. `listRunsForDefinition`); every existing
   * `ProjectUseCaseDeps` test fake that omits it keeps exercising
   * `listProjectsForPrincipal`'s own pre-existing heuristic unchanged. */
  listEffectiveProjectIdsForPrincipal?: ListEffectiveProjectIdsForPrincipal;
}
