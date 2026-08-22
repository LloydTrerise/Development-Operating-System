import type { WorkItem } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

export function toWorkItemDto(workItem: WorkItem) {
  return {
    id: workItem.id,
    projectId: workItem.projectId,
    externalRef: workItem.externalRef,
    title: workItem.title,
    description: workItem.description,
    type: workItem.type,
    status: workItem.status,
    priority: workItem.priority,
    source: workItem.source,
    metadata: workItem.metadata,
    createdAt: workItem.createdAt,
    updatedAt: workItem.updatedAt,
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new BadRequestError(`${field} must be a string.`);
  return value;
}

function optionalMetadata(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestError('metadata must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

export interface CreateWorkItemBody {
  title: string;
  description?: string;
  externalRef?: string;
  type?: string;
  priority?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export function parseCreateWorkItemBody(body: unknown): CreateWorkItemBody {
  const record = asRecord(body);

  const title = record.title;
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new BadRequestError('title is required.');
  }

  const description = optionalString(record.description, 'description');
  const externalRef = optionalString(record.externalRef, 'externalRef');
  const type = optionalString(record.type, 'type');
  const priority = optionalString(record.priority, 'priority');
  const source = optionalString(record.source, 'source');
  const metadata = optionalMetadata(record.metadata);

  return {
    title,
    ...(description !== undefined ? { description } : {}),
    ...(externalRef !== undefined ? { externalRef } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

export interface UpdateWorkItemBody {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  metadata?: Record<string, unknown>;
}

export function parseUpdateWorkItemBody(body: unknown): UpdateWorkItemBody {
  const record = asRecord(body);

  const title = optionalString(record.title, 'title');
  const description = optionalString(record.description, 'description');
  const status = optionalString(record.status, 'status');
  const priority = optionalString(record.priority, 'priority');
  const metadata = optionalMetadata(record.metadata);

  return {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}
