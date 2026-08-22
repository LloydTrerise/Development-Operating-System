import type { WorkflowVersionId } from '@devos/contracts';
import type { WorkflowRun } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import type { WorkflowUseCaseDeps } from './deps.js';
import { startRunForVersion, type StartRunInput } from './run-creation.js';

export async function startWorkflowRunFromVersion(
  deps: WorkflowUseCaseDeps,
  principalId: string,
  workflowVersionId: WorkflowVersionId,
  input: StartRunInput,
): Promise<WorkflowRun> {
  const version = await deps.workflowVersions.getById(workflowVersionId);
  if (!version) throw new NotFoundError('Workflow version');

  return startRunForVersion(deps, principalId, version, input);
}
