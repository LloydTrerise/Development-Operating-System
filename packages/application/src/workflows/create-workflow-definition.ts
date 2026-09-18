import { randomUUID } from 'node:crypto';
import type { AuditId, ProjectId } from '@devos/contracts';
import {
  validateWorkflowGraph,
  type WorkflowDefinition,
  type WorkflowVersion,
} from '@devos/domain';
import type { WorkflowDefinition as WorkflowGraph } from '@devos/contracts';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { CreateWorkflowDefinitionDeps } from './deps.js';

export interface CreateWorkflowDefinitionInput {
  key: string;
  name: string;
  description?: string;
  definition: WorkflowGraph;
}

export async function createWorkflowDefinition(
  deps: CreateWorkflowDefinitionDeps,
  principalId: string,
  projectId: ProjectId,
  input: CreateWorkflowDefinitionInput,
): Promise<{ definition: WorkflowDefinition; version: WorkflowVersion }> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  if (input.key.trim().length === 0) throw new ValidationError('key is required.');
  if (input.name.trim().length === 0) throw new ValidationError('name is required.');

  const existing = await deps.workflowDefinitions.getByProjectAndKey(projectId, input.key);
  if (existing) throw new ValidationError(`A workflow with key "${input.key}" already exists.`);

  const issues = validateWorkflowGraph(input.definition);
  if (issues.length > 0) {
    throw new ValidationError(issues.map((issue) => `${issue.field}: ${issue.message}`).join('; '));
  }

  const now = new Date().toISOString();
  const definition: WorkflowDefinition = {
    id: randomUUID() as WorkflowDefinition['id'],
    projectId,
    key: input.key,
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    createdAt: now,
    updatedAt: now,
  };

  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: definition.id,
    version: 1,
    status: 'DRAFT',
    definition: input.definition,
    createdBy: principalId,
    createdAt: now,
  };

  await deps.createDraft(definition, version);

  // DEVOS-115: extends DEVOS-086's audit coverage to workflow
  // definition/version creation — one record, since createDraft creates
  // both the definition and its initial (version 1, DRAFT) version together.
  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId,
    actorType: 'USER',
    actorId: principalId,
    action: 'workflow.created',
    targetType: 'WorkflowDefinition',
    targetId: definition.id,
    outcome: 'SUCCESS',
    metadata: { key: definition.key, name: definition.name, versionId: version.id },
    createdAt: now,
  });

  return { definition, version };
}
