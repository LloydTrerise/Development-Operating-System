import type { OrganisationId, PolicyId, PolicyStatus, ProjectId } from '@devos/contracts';

/**
 * A configurable rule governing platform behaviour (specs/architecture/domain-model.md
 * §12.1): model/provider restrictions, tool restrictions, approval
 * requirements, data handling rules, autonomy limits. Unlike Agent/Workflow,
 * there is no separate "definition" parent table — `specs/database/poc-database-schema.md`
 * §12.1 defines a single `policies` table where each row is itself one
 * version (`key`+`version` identify it), matching the schema's exact shape
 * rather than introducing an unwarranted second table.
 */
export interface Policy {
  id: PolicyId;
  organisationId: OrganisationId;
  /**
   * Nullable per the schema — an organisation-wide policy has no
   * `projectId`. This task's CRUD API only creates project-scoped policies
   * (see DEVOS-043's decision log entry); the field stays optional so an
   * organisation-wide policy remains representable later.
   */
  projectId?: ProjectId;
  key: string;
  version: number;
  status: PolicyStatus;
  definition: Record<string, unknown>;
  createdBy: string;
  publishedAt?: string;
  createdAt: string;
}

export interface PolicyRepository {
  getById: (id: PolicyId) => Promise<Policy | null>;
  getByProjectAndKeyAndVersion: (
    projectId: ProjectId,
    key: string,
    version: number,
  ) => Promise<Policy | null>;
  getLatestForProjectAndKey: (projectId: ProjectId, key: string) => Promise<Policy | null>;
  listForProject: (projectId: ProjectId) => Promise<Policy[]>;
  create: (policy: Policy) => Promise<void>;
  publish: (id: PolicyId, publishedAt: string) => Promise<void>;
}
