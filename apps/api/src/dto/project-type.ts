import type { AgentConfiguration, WorkflowDefinition as WorkflowGraph } from '@devos/contracts';
import type { ProjectType, ProjectTypeAgent, ProjectTypeWorkflow } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

export function toProjectTypeDto(projectType: ProjectType) {
  return {
    id: projectType.id,
    key: projectType.key,
    name: projectType.name,
    description: projectType.description,
    status: projectType.status,
    createdAt: projectType.createdAt,
    updatedAt: projectType.updatedAt,
  };
}

export function toProjectTypeWorkflowDto(workflow: ProjectTypeWorkflow) {
  return {
    id: workflow.id,
    projectTypeId: workflow.projectTypeId,
    key: workflow.key,
    name: workflow.name,
    definition: workflow.definition,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
  };
}

export function toProjectTypeAgentDto(agent: ProjectTypeAgent) {
  return {
    id: agent.id,
    projectTypeId: agent.projectTypeId,
    key: agent.key,
    name: agent.name,
    configuration: agent.configuration,
    promptReference: agent.promptReference,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export interface CreateProjectTypeBody {
  key: string;
  name: string;
  description?: string;
}

export function parseCreateProjectTypeBody(body: unknown): CreateProjectTypeBody {
  const { key, name, description } = asRecord(body);

  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new BadRequestError('key is required.');
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestError('name is required.');
  }
  if (description !== undefined && typeof description !== 'string') {
    throw new BadRequestError('description must be a string.');
  }

  return { key, name, ...(description !== undefined ? { description } : {}) };
}

export interface UpdateProjectTypeBody {
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'DISABLED';
}

export function parseUpdateProjectTypeBody(body: unknown): UpdateProjectTypeBody {
  const { name, description, status } = asRecord(body);

  if (name !== undefined && typeof name !== 'string') {
    throw new BadRequestError('name must be a string.');
  }
  if (description !== undefined && typeof description !== 'string') {
    throw new BadRequestError('description must be a string.');
  }
  if (status !== undefined && status !== 'ACTIVE' && status !== 'DISABLED') {
    throw new BadRequestError('status must be one of: ACTIVE, DISABLED.');
  }

  return {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

export interface CreateProjectTypeWorkflowBody {
  key: string;
  name: string;
  definition: WorkflowGraph;
}

export function parseCreateProjectTypeWorkflowBody(body: unknown): CreateProjectTypeWorkflowBody {
  const { key, name, definition } = asRecord(body);

  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new BadRequestError('key is required.');
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestError('name is required.');
  }
  if (typeof definition !== 'object' || definition === null) {
    throw new BadRequestError('definition is required and must be an object.');
  }

  return { key, name, definition: definition as WorkflowGraph };
}

export interface UpdateProjectTypeWorkflowBody {
  name?: string;
  definition?: WorkflowGraph;
}

export function parseUpdateProjectTypeWorkflowBody(body: unknown): UpdateProjectTypeWorkflowBody {
  const { name, definition } = asRecord(body);

  if (name !== undefined && typeof name !== 'string') {
    throw new BadRequestError('name must be a string.');
  }
  if (definition !== undefined && (typeof definition !== 'object' || definition === null)) {
    throw new BadRequestError('definition must be an object.');
  }

  return {
    ...(name !== undefined ? { name } : {}),
    ...(definition !== undefined ? { definition: definition as WorkflowGraph } : {}),
  };
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

export interface CreateProjectTypeAgentBody {
  key: string;
  name: string;
  configuration: AgentConfiguration;
  promptReference?: string;
}

export function parseCreateProjectTypeAgentBody(body: unknown): CreateProjectTypeAgentBody {
  const record = asRecord(body);

  const key = record.key;
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new BadRequestError('key is required.');
  }

  const name = record.name;
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestError('name is required.');
  }

  const promptReference = record.promptReference;
  if (promptReference !== undefined && typeof promptReference !== 'string') {
    throw new BadRequestError('promptReference must be a string.');
  }

  const configuration = parseAgentConfiguration(record.configuration);

  return {
    key,
    name,
    configuration,
    ...(promptReference !== undefined ? { promptReference } : {}),
  };
}

export interface UpdateProjectTypeAgentBody {
  name?: string;
  configuration?: AgentConfiguration;
  promptReference?: string;
}

export function parseUpdateProjectTypeAgentBody(body: unknown): UpdateProjectTypeAgentBody {
  const record = asRecord(body);

  const name = record.name;
  if (name !== undefined && typeof name !== 'string') {
    throw new BadRequestError('name must be a string.');
  }

  const promptReference = record.promptReference;
  if (promptReference !== undefined && typeof promptReference !== 'string') {
    throw new BadRequestError('promptReference must be a string.');
  }

  const configuration =
    record.configuration !== undefined ? parseAgentConfiguration(record.configuration) : undefined;

  return {
    ...(name !== undefined ? { name } : {}),
    ...(configuration !== undefined ? { configuration } : {}),
    ...(promptReference !== undefined ? { promptReference } : {}),
  };
}
