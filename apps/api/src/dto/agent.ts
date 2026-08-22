import type { AgentConfiguration } from '@devos/contracts';
import type { Agent, AgentVersion } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

export function toAgentDto(agent: Agent) {
  return {
    id: agent.id,
    projectId: agent.projectId,
    key: agent.key,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
}

export function toAgentVersionDto(version: AgentVersion) {
  return {
    id: version.id,
    agentId: version.agentId,
    version: version.version,
    status: version.status,
    configuration: version.configuration,
    promptReference: version.promptReference,
    createdBy: version.createdBy,
    publishedAt: version.publishedAt,
    createdAt: version.createdAt,
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

function parseAgentConfiguration(value: unknown): AgentConfiguration {
  const record = asRecord(value);

  const role = record.role;
  if (typeof role !== 'string' || role.trim().length === 0) {
    throw new BadRequestError('configuration.role is required.');
  }

  const provider = record.provider;
  if (typeof provider !== 'string' || provider.trim().length === 0) {
    throw new BadRequestError('configuration.provider is required.');
  }

  const modelRef = record.modelRef;
  if (typeof modelRef !== 'string' || modelRef.trim().length === 0) {
    throw new BadRequestError('configuration.modelRef is required.');
  }

  const inputSchemaRef = record.inputSchemaRef;
  if (inputSchemaRef !== undefined && typeof inputSchemaRef !== 'string') {
    throw new BadRequestError('configuration.inputSchemaRef must be a string.');
  }

  const outputSchemaRef = record.outputSchemaRef;
  if (outputSchemaRef !== undefined && typeof outputSchemaRef !== 'string') {
    throw new BadRequestError('configuration.outputSchemaRef must be a string.');
  }

  const allowedCapabilities = record.allowedCapabilities ?? [];
  if (
    !Array.isArray(allowedCapabilities) ||
    !allowedCapabilities.every((item) => typeof item === 'string')
  ) {
    throw new BadRequestError('configuration.allowedCapabilities must be an array of strings.');
  }

  return {
    role,
    provider,
    modelRef,
    ...(inputSchemaRef !== undefined ? { inputSchemaRef } : {}),
    ...(outputSchemaRef !== undefined ? { outputSchemaRef } : {}),
    allowedCapabilities,
  };
}

export interface CreateAgentBody {
  key: string;
  name: string;
  description?: string;
  configuration: AgentConfiguration;
  promptReference?: string;
}

export function parseCreateAgentBody(body: unknown): CreateAgentBody {
  const record = asRecord(body);

  const key = record.key;
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new BadRequestError('key is required.');
  }

  const name = record.name;
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestError('name is required.');
  }

  const description = record.description;
  if (description !== undefined && typeof description !== 'string') {
    throw new BadRequestError('description must be a string.');
  }

  const promptReference = record.promptReference;
  if (promptReference !== undefined && typeof promptReference !== 'string') {
    throw new BadRequestError('promptReference must be a string.');
  }

  const configuration = parseAgentConfiguration(record.configuration);

  return {
    key,
    name,
    ...(description !== undefined ? { description } : {}),
    configuration,
    ...(promptReference !== undefined ? { promptReference } : {}),
  };
}
