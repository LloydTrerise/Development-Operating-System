import type { OrganisationId, ProjectId, ProjectTypeId } from '@devos/contracts';

export interface Project {
  id: ProjectId;
  organisationId: OrganisationId;
  projectTypeId: ProjectTypeId;
  name: string;
  slug: string;
  description?: string;
  status: string;
  /**
   * DEVOS-098: a configured spend threshold (not a spec-defined concept —
   * specs/api/poc-api-contracts.md §51 explicitly defers "advanced
   * cost/budget contracts"). No budget configured means no threshold to
   * check against, not a zero budget — always optional.
   */
  budgetUsd?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  organisationId: OrganisationId;
  /** Optional — defaults to the seeded 'software-development' Project Type
   * (see `SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID`) for backward compatibility
   * with every caller that predates Project Types. */
  projectTypeId?: ProjectTypeId;
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: string;
  budgetUsd?: number;
}

export interface ProjectRepository {
  getById: (id: ProjectId) => Promise<Project | null>;
  listForOrganisation: (organisationId: OrganisationId) => Promise<Project[]>;
  create: (project: Project) => Promise<void>;
  update: (id: ProjectId, changes: UpdateProjectInput, updatedAt: string) => Promise<void>;
}
