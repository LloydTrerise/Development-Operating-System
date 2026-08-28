import { membershipRoles, type Membership, type MembershipRole, type Project } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

export function toProjectDto(project: Project) {
  return {
    id: project.id,
    organisationId: project.organisationId,
    projectTypeId: project.projectTypeId,
    name: project.name,
    slug: project.slug,
    description: project.description,
    status: project.status,
    budgetUsd: project.budgetUsd,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function toMembershipDto(membership: Membership) {
  return {
    id: membership.id,
    projectId: membership.projectId,
    userId: membership.principalId,
    role: membership.role,
    status: membership.status,
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

function isMembershipRole(value: unknown): value is MembershipRole {
  return typeof value === 'string' && (membershipRoles as readonly string[]).includes(value);
}

export interface CreateProjectBody {
  name: string;
  slug: string;
  description?: string;
  /** Optional — defaults to the seeded organisation server-side (see
   * routes/projects.ts) for backward compatibility with every existing
   * caller that predates Organisation management. */
  organisationId?: string;
  /** Optional — defaults to the seeded 'software-development' Project Type
   * server-side (see routes/projects.ts) for backward compatibility with
   * every existing caller that predates Project Types. */
  projectTypeId?: string;
}

export function parseCreateProjectBody(body: unknown): CreateProjectBody {
  const { name, slug, description, organisationId, projectTypeId } = asRecord(body);

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestError('name is required.');
  }
  if (typeof slug !== 'string' || slug.trim().length === 0) {
    throw new BadRequestError('slug is required.');
  }
  if (description !== undefined && typeof description !== 'string') {
    throw new BadRequestError('description must be a string.');
  }
  if (organisationId !== undefined && typeof organisationId !== 'string') {
    throw new BadRequestError('organisationId must be a string.');
  }
  if (projectTypeId !== undefined && typeof projectTypeId !== 'string') {
    throw new BadRequestError('projectTypeId must be a string.');
  }

  return {
    name,
    slug,
    ...(description !== undefined ? { description } : {}),
    ...(organisationId !== undefined ? { organisationId } : {}),
    ...(projectTypeId !== undefined ? { projectTypeId } : {}),
  };
}

export interface UpdateProjectBody {
  name?: string;
  description?: string;
  status?: string;
  budgetUsd?: number;
}

export function parseUpdateProjectBody(body: unknown): UpdateProjectBody {
  const { name, description, status, budgetUsd } = asRecord(body);

  if (name !== undefined && typeof name !== 'string') {
    throw new BadRequestError('name must be a string.');
  }
  if (description !== undefined && typeof description !== 'string') {
    throw new BadRequestError('description must be a string.');
  }
  if (status !== undefined && typeof status !== 'string') {
    throw new BadRequestError('status must be a string.');
  }
  if (budgetUsd !== undefined && (typeof budgetUsd !== 'number' || budgetUsd < 0)) {
    throw new BadRequestError('budgetUsd must be a non-negative number.');
  }

  return {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(budgetUsd !== undefined ? { budgetUsd } : {}),
  };
}

export interface AddMemberBody {
  userId: string;
  role: MembershipRole;
}

export function parseAddMemberBody(body: unknown): AddMemberBody {
  const { userId, role } = asRecord(body);

  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw new BadRequestError('userId is required.');
  }
  if (!isMembershipRole(role)) {
    throw new BadRequestError(`role must be one of: ${membershipRoles.join(', ')}.`);
  }

  return { userId, role };
}

export function parseRoleBody(body: unknown): MembershipRole {
  const { role } = asRecord(body);

  if (!isMembershipRole(role)) {
    throw new BadRequestError(`role must be one of: ${membershipRoles.join(', ')}.`);
  }

  return role;
}
