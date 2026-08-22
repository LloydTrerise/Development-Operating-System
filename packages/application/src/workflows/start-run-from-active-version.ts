import type { WorkflowId } from '@devos/contracts';
import type { WorkflowRun } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import type { WorkflowUseCaseDeps } from './deps.js';
import { startRunForVersion, type StartRunInput } from './run-creation.js';

export async function startWorkflowRunFromActiveVersion(
  deps: WorkflowUseCaseDeps,
  principalId: string,
  workflowId: WorkflowId,
  input: StartRunInput,
): Promise<WorkflowRun> {
  const definition = await deps.workflowDefinitions.getById(workflowId);
  if (!definition) throw new NotFoundError('Workflow');

  const versions = await deps.workflowVersions.listForDefinition(workflowId);
  const published = versions
    .filter((version) => version.status === 'PUBLISHED')
    .sort((a, b) => b.version - a.version)[0];

  if (!published) {
    throw new ValidationError('This workflow has no published version to run.');
  }

  return startRunForVersion(deps, principalId, published, input);
}
