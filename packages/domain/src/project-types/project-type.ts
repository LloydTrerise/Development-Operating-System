import type { ProjectTypeId } from '@devos/contracts';

/**
 * The one Project Type seeded by `packages/database`'s seed script — shared
 * from here (not `@devos/database`, which `@devos/application` must not
 * depend on) so `create-project.ts` can default a project's type to it when
 * a caller doesn't specify one, the same backward-compatible defaulting
 * `SEED_ORGANISATION_ID` already provides for `organisationId`.
 */
export const SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID =
  '00000000-0000-4000-8000-000000000023' as ProjectTypeId;

export interface ProjectType {
  id: ProjectTypeId;
  key: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectTypeInput {
  key: string;
  name: string;
  description?: string;
}

export interface UpdateProjectTypeInput {
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'DISABLED';
}

export interface ProjectTypeRepository {
  getById: (id: ProjectTypeId) => Promise<ProjectType | null>;
  getByKey: (key: string) => Promise<ProjectType | null>;
  list: () => Promise<ProjectType[]>;
  create: (projectType: ProjectType) => Promise<void>;
  update: (id: ProjectTypeId, changes: UpdateProjectTypeInput, updatedAt: string) => Promise<void>;
}
