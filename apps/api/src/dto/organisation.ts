import type { Organisation } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

export function toOrganisationDto(organisation: Organisation) {
  return {
    id: organisation.id,
    name: organisation.name,
    slug: organisation.slug,
    status: organisation.status,
    budgetUsd: organisation.budgetUsd,
    createdAt: organisation.createdAt,
    updatedAt: organisation.updatedAt,
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export interface CreateOrganisationBody {
  name: string;
  slug: string;
}

export function parseCreateOrganisationBody(body: unknown): CreateOrganisationBody {
  const { name, slug } = asRecord(body);

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestError('name is required.');
  }
  if (typeof slug !== 'string' || slug.trim().length === 0) {
    throw new BadRequestError('slug is required.');
  }

  return { name, slug };
}

export interface UpdateOrganisationBody {
  name?: string;
  status?: string;
  budgetUsd?: number;
}

export function parseUpdateOrganisationBody(body: unknown): UpdateOrganisationBody {
  const { name, status, budgetUsd } = asRecord(body);

  if (name !== undefined && typeof name !== 'string') {
    throw new BadRequestError('name must be a string.');
  }
  if (status !== undefined && typeof status !== 'string') {
    throw new BadRequestError('status must be a string.');
  }
  if (budgetUsd !== undefined && (typeof budgetUsd !== 'number' || budgetUsd < 0)) {
    throw new BadRequestError('budgetUsd must be a non-negative number.');
  }

  return {
    ...(name !== undefined ? { name } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(budgetUsd !== undefined ? { budgetUsd } : {}),
  };
}
