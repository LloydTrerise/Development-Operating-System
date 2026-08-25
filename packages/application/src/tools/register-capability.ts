import { randomUUID } from 'node:crypto';
import type { ProjectId, ToolCapabilityRiskClass } from '@devos/contracts';
import { toolCapabilityRiskClasses } from '@devos/contracts';
import type { ToolCapability } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ToolUseCaseDeps } from './deps.js';

export interface RegisterCapabilityInput {
  key: string;
  name: string;
  riskClass: ToolCapabilityRiskClass;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

/**
 * Get-or-create rather than create-or-fail: this is how
 * `packages/tools`'s capability registry registers its static definitions
 * against a project, and that registration must be safely re-runnable
 * (mirroring `packages/database/src/seed.ts`'s idempotent seeding) rather
 * than erroring on the second run.
 */
export async function registerCapability(
  deps: ToolUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
  input: RegisterCapabilityInput,
): Promise<ToolCapability> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  if (input.key.trim().length === 0) throw new ValidationError('key is required.');
  if (input.name.trim().length === 0) throw new ValidationError('name is required.');
  if (!toolCapabilityRiskClasses.includes(input.riskClass)) {
    throw new ValidationError(`riskClass must be one of: ${toolCapabilityRiskClasses.join(', ')}.`);
  }

  const existing = await deps.toolCapabilities.getByProjectAndKey(projectId, input.key);
  if (existing) return existing;

  const capability: ToolCapability = {
    id: randomUUID() as ToolCapability['id'],
    projectId,
    key: input.key,
    name: input.name,
    riskClass: input.riskClass,
    inputSchema: input.inputSchema,
    outputSchema: input.outputSchema,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  await deps.toolCapabilities.create(capability);

  return capability;
}
