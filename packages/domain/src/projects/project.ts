import type { OrganisationId, ProjectId } from '@devos/contracts';

export interface Project {
  id: ProjectId;
  organisationId: OrganisationId;
  name: string;
  slug: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  organisationId: OrganisationId;
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: string;
}

export interface ProjectRepository {
  getById: (id: ProjectId) => Promise<Project | null>;
  listForOrganisation: (organisationId: OrganisationId) => Promise<Project[]>;
  create: (project: Project) => Promise<void>;
  update: (id: ProjectId, changes: UpdateProjectInput, updatedAt: string) => Promise<void>;
}
