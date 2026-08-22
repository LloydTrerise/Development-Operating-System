import type { WorkflowDefinition as WorkflowGraph, WorkflowId } from '@devos/contracts';
import { validateWorkflowGraph, type WorkflowVersion } from '@devos/domain';
import { ValidationError } from '../errors.js';
import { requireDraftVersion } from './draft-access.js';
import type { WorkflowUseCaseDeps } from './deps.js';

export async function updateDraftWorkflow(
  deps: WorkflowUseCaseDeps,
  principalId: string,
  workflowId: WorkflowId,
  graph: WorkflowGraph,
): Promise<WorkflowVersion> {
  const { draft } = await requireDraftVersion(deps, principalId, workflowId);

  const issues = validateWorkflowGraph(graph);
  if (issues.length > 0) {
    throw new ValidationError(issues.map((issue) => `${issue.field}: ${issue.message}`).join('; '));
  }

  await deps.workflowVersions.updateDefinition(draft.id, graph);

  return { ...draft, definition: graph };
}
