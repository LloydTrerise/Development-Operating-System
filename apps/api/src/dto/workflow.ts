import type { WorkflowDefinition as WorkflowGraph } from '@devos/contracts';
import type { WorkflowDefinition, WorkflowVersion } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

export function toWorkflowDefinitionDto(definition: WorkflowDefinition) {
  return {
    id: definition.id,
    projectId: definition.projectId,
    key: definition.key,
    name: definition.name,
    description: definition.description,
    createdAt: definition.createdAt,
    updatedAt: definition.updatedAt,
  };
}

export function toWorkflowVersionDto(version: WorkflowVersion) {
  return {
    id: version.id,
    workflowId: version.workflowDefinitionId,
    version: version.version,
    status: version.status,
    definition: version.definition,
    publishedAt: version.publishedAt,
    createdBy: version.createdBy,
    createdAt: version.createdAt,
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export interface CreateWorkflowBody {
  key: string;
  name: string;
  description?: string;
  definition: WorkflowGraph;
}

export function parseCreateWorkflowBody(body: unknown): CreateWorkflowBody {
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

  const definition = record.definition;
  if (typeof definition !== 'object' || definition === null) {
    throw new BadRequestError('definition is required and must be an object.');
  }

  return {
    key,
    name,
    ...(description !== undefined ? { description } : {}),
    definition: definition as WorkflowGraph,
  };
}

export function parseWorkflowGraphBody(body: unknown): WorkflowGraph {
  const record = asRecord(body);
  const definition = record.definition ?? body;

  if (typeof definition !== 'object' || definition === null) {
    throw new BadRequestError('definition is required and must be an object.');
  }

  return definition as WorkflowGraph;
}

export function parseVersionNumber(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new BadRequestError('version must be a positive integer.');
  }
  return value;
}
