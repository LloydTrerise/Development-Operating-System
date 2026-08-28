import type { ProjectTypeId } from '@devos/contracts';
import {
  validateWorkflowGraph,
  type ProjectTypeWorkflow,
  type UpdateProjectTypeWorkflowInput,
} from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import type { ProjectTypeUseCaseDeps } from './deps.js';

export async function updateProjectTypeWorkflow(
  deps: ProjectTypeUseCaseDeps,
  projectTypeId: ProjectTypeId,
  key: string,
  changes: UpdateProjectTypeWorkflowInput,
): Promise<ProjectTypeWorkflow> {
  const existing = await deps.projectTypeWorkflows.getByProjectTypeAndKey(projectTypeId, key);
  if (!existing) throw new NotFoundError('ProjectTypeWorkflow');

  if (changes.definition !== undefined) {
    const issues = validateWorkflowGraph(changes.definition);
    if (issues.length > 0) {
      throw new ValidationError(
        issues.map((issue) => `${issue.field}: ${issue.message}`).join('; '),
      );
    }
  }

  const updatedAt = new Date().toISOString();
  await deps.projectTypeWorkflows.update(existing.id, changes, updatedAt);

  return { ...existing, ...changes, updatedAt };
}
