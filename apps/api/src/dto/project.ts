import { membershipRoles, type Membership, type MembershipRole, type Project } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

export function toProjectDto(project: Project) {
  return {
    id: project.id,
    organisationId: project.organisationId,
    name: project.name,
    slug: project.slug,
    description: project.description,
    status: project.status,
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
}

export function parseCreateProjectBody(body: unknown): CreateProjectBody {
  const { name, slug, description } = asRecord(body);

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestError('name is required.');
  }
  if (typeof slug !== 'string' || slug.trim().length === 0) {
    throw new BadRequestError('slug is required.');
  }
  if (description !== undefined && typeof description !== 'string') {
    throw new BadRequestError('description must be a string.');
  }

  return { name, slug, ...(description !== undefined ? { description } : {}) };
}

export interface UpdateProjectBody {
  name?: string;
  description?: string;
  status?: string;
}

export function parseUpdateProjectBody(body: unknown): UpdateProjectBody {
  const { name, description, status } = asRecord(body);

  if (name !== undefined && typeof name !== 'string') {
    throw new BadRequestError('name must be a string.');
  }
  if (description !== undefined && typeof description !== 'string') {
    throw new BadRequestError('description must be a string.');
  }
  if (status !== undefined && typeof status !== 'string') {
    throw new BadRequestError('status must be a string.');
  }

  return {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(status !== undefined ? { status } : {}),
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
