import type { WorkItem, WorkItemAssignment, WorkItemAssignmentRole } from '@devos/domain';
import { workItemAssignmentRoles } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

/** Mirrors `apps/api/src/dto/project.ts`'s own `isMembershipRole` — the
 * same "validate a string against a fixed, readonly tuple" shape. */
function isWorkItemAssignmentRole(value: unknown): value is WorkItemAssignmentRole {
  return (
    typeof value === 'string' && (workItemAssignmentRoles as readonly string[]).includes(value)
  );
}

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
    parentId: workItem.parentId,
  };
}

/** DEVOS-306: `packages/domain/src/work-items/work-item-assignment.ts`'s
 * `WorkItemAssignment`. */
export function toWorkItemAssignmentDto(assignment: WorkItemAssignment) {
  return {
    workItemId: assignment.workItemId,
    principalId: assignment.principalId,
    role: assignment.role,
    createdAt: assignment.createdAt,
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

/** DEVOS-303 follow-up: `parentId` on an update may be explicitly cleared
 * with a literal JSON `null`, distinct from omitting the field entirely
 * (no change) — see `UpdateWorkItemInput.parentId`'s own doc comment. */
function optionalNullableString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new BadRequestError(`${field} must be a string or null.`);
  return value;
}

export interface CreateWorkItemBody {
  title: string;
  description?: string;
  externalRef?: string;
  type?: string;
  priority?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  parentId?: string;
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
  const parentId = optionalString(record.parentId, 'parentId');

  return {
    title,
    ...(description !== undefined ? { description } : {}),
    ...(externalRef !== undefined ? { externalRef } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
  };
}

export interface UpdateWorkItemBody {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  metadata?: Record<string, unknown>;
  /** `undefined` (omitted) = no change; `null` = explicitly clear the
   * parent; a string = set/replace it. */
  parentId?: string | null;
}

export function parseUpdateWorkItemBody(body: unknown): UpdateWorkItemBody {
  const record = asRecord(body);

  const title = optionalString(record.title, 'title');
  const description = optionalString(record.description, 'description');
  const status = optionalString(record.status, 'status');
  const priority = optionalString(record.priority, 'priority');
  const metadata = optionalMetadata(record.metadata);
  const parentId = optionalNullableString(record.parentId, 'parentId');

  return {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
  };
}

export interface AssignWorkItemBody {
  principalId: string;
  role: string;
}

export function parseAssignWorkItemBody(body: unknown): AssignWorkItemBody {
  const record = asRecord(body);

  const principalId = record.principalId;
  if (typeof principalId !== 'string' || principalId.trim().length === 0) {
    throw new BadRequestError('principalId is required.');
  }

  const role = record.role;
  if (!isWorkItemAssignmentRole(role)) {
    throw new BadRequestError(`role must be one of: ${workItemAssignmentRoles.join(', ')}.`);
  }

  return { principalId, role };
}
