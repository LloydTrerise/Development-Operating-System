import { randomUUID } from 'node:crypto';
import type { AgentConfiguration, ProjectId } from '@devos/contracts';
import type { Agent, AgentVersion } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { AgentUseCaseDeps } from './deps.js';

export interface CreateAgentInput {
  key: string;
  name: string;
  description?: string;
  configuration: AgentConfiguration;
  promptReference?: string;
}

export async function createAgent(
  deps: AgentUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
  input: CreateAgentInput,
): Promise<{ agent: Agent; version: AgentVersion }> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  if (input.key.trim().length === 0) throw new ValidationError('key is required.');
  if (input.name.trim().length === 0) throw new ValidationError('name is required.');
  if (input.configuration.role.trim().length === 0) {
    throw new ValidationError('configuration.role is required.');
  }
  if (input.configuration.provider.trim().length === 0) {
    throw new ValidationError('configuration.provider is required.');
  }
  if (input.configuration.modelRef.trim().length === 0) {
    throw new ValidationError('configuration.modelRef is required.');
  }

  const existing = await deps.agents.getByProjectAndKey(projectId, input.key);
  if (existing) throw new ValidationError(`An agent with key "${input.key}" already exists.`);

  const now = new Date().toISOString();
  const agent: Agent = {
    id: randomUUID() as Agent['id'],
    projectId,
    key: input.key,
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const version: AgentVersion = {
    id: randomUUID() as AgentVersion['id'],
    agentId: agent.id,
    version: 1,
    status: 'DRAFT',
    configuration: input.configuration,
    ...(input.promptReference !== undefined ? { promptReference: input.promptReference } : {}),
    createdBy: principalId,
    createdAt: now,
  };

  await deps.createDraft(agent, version);

  return { agent, version };
}
