import type { KnowledgeReference, KnowledgeSource, SharedKnowledgeSource } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

export function toKnowledgeSourceDto(source: KnowledgeSource) {
  return {
    id: source.id,
    projectId: source.projectId,
    key: source.key,
    name: source.name,
    sourceType: source.sourceType,
    content: source.content,
    status: source.status,
    createdBy: source.createdBy,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    sharedAcrossOrganisation: source.sharedAcrossOrganisation ?? false,
  };
}

export function toSharedKnowledgeSourceDto(source: SharedKnowledgeSource) {
  return {
    ...toKnowledgeSourceDto(source),
    sourceProjectId: source.sourceProjectId,
    sourceProjectName: source.sourceProjectName,
  };
}

export function toKnowledgeReferenceDto(reference: KnowledgeReference) {
  return {
    id: reference.id,
    projectId: reference.projectId,
    knowledgeSourceId: reference.knowledgeSourceId,
    workflowTaskId: reference.workflowTaskId,
    agentExecutionId: reference.agentExecutionId,
    createdAt: reference.createdAt,
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export interface CreateKnowledgeSourceBody {
  key: string;
  name: string;
  sourceType: string;
  content: string;
}

export function parseCreateKnowledgeSourceBody(body: unknown): CreateKnowledgeSourceBody {
  const record = asRecord(body);

  const key = record.key;
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new BadRequestError('key is required.');
  }

  const name = record.name;
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestError('name is required.');
  }

  const sourceType = record.sourceType;
  if (typeof sourceType !== 'string' || sourceType.trim().length === 0) {
    throw new BadRequestError('sourceType is required.');
  }

  const content = record.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new BadRequestError('content is required.');
  }

  return { key, name, sourceType, content };
}

export interface UpdateKnowledgeSourceBody {
  name?: string;
  content?: string;
  sourceType?: string;
}

export function parseUpdateKnowledgeSourceBody(body: unknown): UpdateKnowledgeSourceBody {
  const record = asRecord(body);
  const result: UpdateKnowledgeSourceBody = {};

  if (record.name !== undefined) {
    if (typeof record.name !== 'string') throw new BadRequestError('name must be a string.');
    result.name = record.name;
  }
  if (record.content !== undefined) {
    if (typeof record.content !== 'string') throw new BadRequestError('content must be a string.');
    result.content = record.content;
  }
  if (record.sourceType !== undefined) {
    if (typeof record.sourceType !== 'string') {
      throw new BadRequestError('sourceType must be a string.');
    }
    result.sourceType = record.sourceType;
  }

  return result;
}

export function parseShareKnowledgeSourceBody(body: unknown): { shared: boolean } {
  const record = asRecord(body);
  const shared = record.shared;
  if (typeof shared !== 'boolean') {
    throw new BadRequestError('shared must be a boolean.');
  }
  return { shared };
}

export function parseInstallKnowledgeSourceBody(body: unknown): { targetProjectId: string } {
  const record = asRecord(body);
  const targetProjectId = record.targetProjectId;
  if (typeof targetProjectId !== 'string' || targetProjectId.trim().length === 0) {
    throw new BadRequestError('targetProjectId is required.');
  }
  return { targetProjectId };
}
