import type { JobRole, ProjectMemberJobRole } from '@devos/domain';
import type { ProjectJobRolesOverview } from '@devos/application';
import { BadRequestError } from '../http/errors.js';

export function toJobRoleDto(jobRole: JobRole) {
  return {
    id: jobRole.id,
    organisationId: jobRole.organisationId,
    key: jobRole.key,
    name: jobRole.name,
    createdAt: jobRole.createdAt,
  };
}

export function toProjectMemberJobRoleDto(row: ProjectMemberJobRole) {
  return {
    projectId: row.projectId,
    principalId: row.principalId,
    jobRoleId: row.jobRoleId,
    createdAt: row.createdAt,
  };
}

export function toProjectJobRolesOverviewDto(overview: ProjectJobRolesOverview) {
  return {
    catalogue: overview.catalogue.map(toJobRoleDto),
    members: overview.members,
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export interface JobRoleIdBody {
  jobRoleId: string;
}

export function parseJobRoleIdBody(body: unknown): JobRoleIdBody {
  const { jobRoleId } = asRecord(body);

  if (typeof jobRoleId !== 'string' || jobRoleId.trim().length === 0) {
    throw new BadRequestError('jobRoleId is required.');
  }

  return { jobRoleId };
}
