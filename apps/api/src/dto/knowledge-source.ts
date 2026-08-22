import type { KnowledgeSource } from '@devos/domain';
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
