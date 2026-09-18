import type {
  ProjectTypeAgentRepository,
  ProjectTypeRepository,
  ProjectTypeWorkflowRepository,
} from '@devos/domain';

/**
 * No `memberships`/RBAC dependency — per
 * specs/architecture/organisations-and-project-types.md §11, Project Types
 * (and their workflow/agent templates) are global, not organisation- or
 * project-scoped, and any authenticated principal may create or update one
 * (flagged there as an accepted risk consistent with this POC's existing
 * posture, not a new gap).
 */
export interface ProjectTypeUseCaseDeps {
  projectTypes: ProjectTypeRepository;
  projectTypeWorkflows: ProjectTypeWorkflowRepository;
  projectTypeAgents: ProjectTypeAgentRepository;
}
