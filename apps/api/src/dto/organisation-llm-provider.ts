import {
  organisationLlmProviderStatuses,
  type OrganisationLlmProviderStatus,
} from '@devos/contracts';
import type { OrganisationLlmProvider } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

/**
 * `credentialReference` is a reference *name*, never the secret value it
 * points to (per `specs/sprints/sprint-54/README.md`'s own disclosed
 * grounding, mirroring `Integration.credentialReference`'s identical,
 * already-public precedent) — safe to return as-is, exactly like
 * `toIntegrationDto` already does for that sibling field.
 */
export function toOrganisationLlmProviderDto(provider: OrganisationLlmProvider) {
  return {
    id: provider.id,
    organisationId: provider.organisationId,
    provider: provider.provider,
    credentialReference: provider.credentialReference,
    priority: provider.priority,
    status: provider.status,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export interface CreateOrganisationLlmProviderBody {
  provider: string;
  credentialReference: string;
}

export function parseCreateOrganisationLlmProviderBody(
  body: unknown,
): CreateOrganisationLlmProviderBody {
  const { provider, credentialReference } = asRecord(body);

  if (typeof provider !== 'string' || provider.trim().length === 0) {
    throw new BadRequestError('provider is required.');
  }
  if (typeof credentialReference !== 'string' || credentialReference.trim().length === 0) {
    throw new BadRequestError('credentialReference is required.');
  }

  return { provider, credentialReference };
}

export interface UpdateOrganisationLlmProviderBody {
  credentialReference?: string;
  status?: OrganisationLlmProviderStatus;
}

export function parseUpdateOrganisationLlmProviderBody(
  body: unknown,
): UpdateOrganisationLlmProviderBody {
  const { credentialReference, status } = asRecord(body);

  if (credentialReference !== undefined && typeof credentialReference !== 'string') {
    throw new BadRequestError('credentialReference must be a string.');
  }
  if (
    status !== undefined &&
    (typeof status !== 'string' ||
      !organisationLlmProviderStatuses.includes(status as OrganisationLlmProviderStatus))
  ) {
    throw new BadRequestError(
      `status must be one of: ${organisationLlmProviderStatuses.join(', ')}.`,
    );
  }

  return {
    ...(credentialReference !== undefined ? { credentialReference } : {}),
    ...(status !== undefined ? { status: status as OrganisationLlmProviderStatus } : {}),
  };
}

export interface ReorderOrganisationLlmProvidersBody {
  orderedIds: string[];
}

export function parseReorderOrganisationLlmProvidersBody(
  body: unknown,
): ReorderOrganisationLlmProvidersBody {
  const { orderedIds } = asRecord(body);

  if (
    !Array.isArray(orderedIds) ||
    orderedIds.length === 0 ||
    orderedIds.some((id) => typeof id !== 'string')
  ) {
    throw new BadRequestError('orderedIds must be a non-empty array of strings.');
  }

  return { orderedIds: orderedIds as string[] };
}
