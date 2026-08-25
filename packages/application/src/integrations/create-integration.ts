import { randomUUID } from 'node:crypto';
import type { AuditId, ProjectId } from '@devos/contracts';
import { canRegisterIntegration, type Integration } from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { IntegrationUseCaseDeps } from './deps.js';

export interface CreateIntegrationInput {
  type: string;
  provider: string;
  name: string;
  credentialReference: string;
  configuration?: Record<string, unknown>;
}

/**
 * DEVOS-083: `configuration` is a free-form JSONB bag with no schema of its
 * own, so nothing previously stopped a caller from pasting an actual secret
 * value into it (e.g. `configuration.token`) instead of going through
 * `credentialReference` — defeating the "credentials are references only"
 * guarantee (specs/api/poc-api-contracts.md §33) for that field alone.
 * Rejecting secret-shaped keys, recursively, closes that gap at the one
 * boundary where caller-supplied data enters the system.
 */
const SECRET_LIKE_CONFIGURATION_KEY = /(password|secret|token|api[-_]?key|credential)/i;

function assertNoSecretShapedConfiguration(value: unknown, path: string): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretShapedConfiguration(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const keyPath = path ? `${path}.${key}` : key;
    if (SECRET_LIKE_CONFIGURATION_KEY.test(key)) {
      throw new ValidationError(
        `configuration.${keyPath} looks like it may hold a secret value; store it via credentialReference (a reference name resolved through the credential resolver), not configuration.`,
      );
    }
    assertNoSecretShapedConfiguration(nested, keyPath);
  }
}

/**
 * Stores only the connection/configuration boundary
 * (specs/architecture/domain-model.md §11.1) plus a credential *reference*
 * — never a secret value (specs/api/poc-api-contracts.md §33: "Credentials
 * are references only"). Resolving `credentialReference` to actual secret
 * material happens later, through `@devos/integrations`'s
 * `CredentialResolver`, never here.
 */
export async function createIntegration(
  deps: IntegrationUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
  input: CreateIntegrationInput,
): Promise<Integration> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');
  if (!canRegisterIntegration(membership.role)) {
    throw new ForbiddenError('Only a project owner may register an integration.');
  }

  if (input.type.trim().length === 0) throw new ValidationError('type is required.');
  if (input.provider.trim().length === 0) throw new ValidationError('provider is required.');
  if (input.name.trim().length === 0) throw new ValidationError('name is required.');
  if (input.credentialReference.trim().length === 0) {
    throw new ValidationError('credentialReference is required.');
  }
  if (input.configuration) {
    assertNoSecretShapedConfiguration(input.configuration, '');
  }

  const now = new Date().toISOString();
  const integration: Integration = {
    id: randomUUID() as Integration['id'],
    projectId,
    type: input.type,
    provider: input.provider,
    name: input.name,
    status: 'ACTIVE',
    credentialReference: input.credentialReference,
    configuration: input.configuration ?? {},
    createdAt: now,
    updatedAt: now,
  };

  await deps.integrations.create(integration);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: membership.organisationId,
    projectId,
    actorType: 'USER',
    actorId: principalId,
    action: 'integration.created',
    targetType: 'Integration',
    targetId: integration.id,
    outcome: 'SUCCESS',
    // credentialReference is a reference *name*, never the secret value it
    // points to (DEVOS-083) — safe to record.
    metadata: { type: integration.type, provider: integration.provider },
    createdAt: now,
  });

  return integration;
}
