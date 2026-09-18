import { randomUUID } from 'node:crypto';
import type { ProjectTypeId } from '@devos/contracts';
import {
  validateWorkflowGraph,
  type CreateProjectTypeWorkflowInput,
  type ProjectTypeWorkflow,
} from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import type { ProjectTypeUseCaseDeps } from './deps.js';

export async function createProjectTypeWorkflow(
  deps: ProjectTypeUseCaseDeps,
  projectTypeId: ProjectTypeId,
  input: CreateProjectTypeWorkflowInput,
): Promise<ProjectTypeWorkflow> {
  const projectType = await deps.projectTypes.getById(projectTypeId);
  if (!projectType) throw new NotFoundError('ProjectType');

  if (input.key.trim().length === 0) throw new ValidationError('key is required.');
  if (input.name.trim().length === 0) throw new ValidationError('name is required.');

  const existing = await deps.projectTypeWorkflows.getByProjectTypeAndKey(projectTypeId, input.key);
  if (existing) {
    throw new ValidationError(`A workflow template with key "${input.key}" already exists.`);
  }

  const issues = validateWorkflowGraph(input.definition);
  if (issues.length > 0) {
    throw new ValidationError(issues.map((issue) => `${issue.field}: ${issue.message}`).join('; '));
  }

  const now = new Date().toISOString();
  const workflow: ProjectTypeWorkflow = {
    id: randomUUID() as ProjectTypeWorkflow['id'],
    projectTypeId,
    key: input.key,
    name: input.name,
    definition: input.definition,
    createdAt: now,
    updatedAt: now,
  };

  await deps.projectTypeWorkflows.create(workflow);

  return workflow;
}
