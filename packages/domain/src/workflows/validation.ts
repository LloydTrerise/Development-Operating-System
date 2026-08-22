import { workflowNodeTypes } from '@devos/contracts';

export interface WorkflowValidationIssue {
  field: string;
  message: string;
}

export function validateWorkflowGraph(graph: unknown): WorkflowValidationIssue[] {
  if (typeof graph !== 'object' || graph === null) {
    return [{ field: 'definition', message: 'definition must be an object.' }];
  }

  const issues: WorkflowValidationIssue[] = [];
  const candidate = graph as Record<string, unknown>;

  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    issues.push({ field: 'name', message: 'name is required.' });
  }

  if (!Array.isArray(candidate.nodes) || candidate.nodes.length === 0) {
    issues.push({ field: 'nodes', message: 'at least one node is required.' });
  } else {
    candidate.nodes.forEach((node: unknown, index: number) => {
      if (typeof node !== 'object' || node === null) {
        issues.push({ field: `nodes[${index}]`, message: 'node must be an object.' });
        return;
      }
      const n = node as Record<string, unknown>;
      if (typeof n.id !== 'string' || n.id.trim().length === 0) {
        issues.push({ field: `nodes[${index}].id`, message: 'node id is required.' });
      }
      if (
        typeof n.type !== 'string' ||
        !(workflowNodeTypes as readonly string[]).includes(n.type)
      ) {
        issues.push({
          field: `nodes[${index}].type`,
          message: `node type must be one of: ${workflowNodeTypes.join(', ')}.`,
        });
      }
    });
  }

  if (candidate.edges !== undefined && !Array.isArray(candidate.edges)) {
    issues.push({ field: 'edges', message: 'edges must be an array.' });
  }

  return issues;
}
