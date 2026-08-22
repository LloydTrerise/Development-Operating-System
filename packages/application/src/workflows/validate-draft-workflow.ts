import type { WorkflowId } from '@devos/contracts';
import { validateWorkflowGraph, type WorkflowValidationIssue } from '@devos/domain';
import { requireDraftVersion } from './draft-access.js';
import type { WorkflowUseCaseDeps } from './deps.js';

export async function validateDraftWorkflow(
  deps: WorkflowUseCaseDeps,
  principalId: string,
  workflowId: WorkflowId,
): Promise<{ valid: boolean; issues: WorkflowValidationIssue[] }> {
  const { draft } = await requireDraftVersion(deps, principalId, workflowId);
  const issues = validateWorkflowGraph(draft.definition);

  return { valid: issues.length === 0, issues };
}
