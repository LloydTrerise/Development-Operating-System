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

  // DEVOS-096: node ids declared by this graph, collected while validating
  // nodes so edge referential-integrity checks (below) can be validated
  // against them in one pass, without a second walk of `nodes`.
  const declaredNodeIds = new Set<string>();
  const seenNodeIds = new Set<string>();

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
      } else if (seenNodeIds.has(n.id)) {
        issues.push({
          field: `nodes[${index}].id`,
          message: `duplicate node id "${n.id}" — node ids must be unique within a graph.`,
        });
      } else {
        seenNodeIds.add(n.id);
        declaredNodeIds.add(n.id);
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
      if (
        n.type === 'AGENT_TASK' &&
        (typeof n.agentRef !== 'string' || n.agentRef.trim().length === 0)
      ) {
        issues.push({
          field: `nodes[${index}].agentRef`,
          message: 'AGENT_TASK nodes require a non-empty agentRef.',
        });
      }
    });
  }

  if (candidate.edges !== undefined && !Array.isArray(candidate.edges)) {
    issues.push({ field: 'edges', message: 'edges must be an array.' });
  } else if (Array.isArray(candidate.edges)) {
    // DEVOS-096: referential-integrity only — this codebase does not
    // traverse edges for execution ordering (every node's task is created
    // at run-start independent of the others), so this checks that an
    // edge doesn't point at a node id that was never declared, not that
    // the graph forms any particular shape.
    candidate.edges.forEach((edge: unknown, index: number) => {
      if (typeof edge !== 'object' || edge === null) {
        issues.push({ field: `edges[${index}]`, message: 'edge must be an object.' });
        return;
      }
      const e = edge as Record<string, unknown>;
      if (typeof e.from !== 'string' || !declaredNodeIds.has(e.from)) {
        issues.push({
          field: `edges[${index}].from`,
          message: `edge references unknown node id "${String(e.from)}".`,
        });
      }
      if (typeof e.to !== 'string' || !declaredNodeIds.has(e.to)) {
        issues.push({
          field: `edges[${index}].to`,
          message: `edge references unknown node id "${String(e.to)}".`,
        });
      }
    });
  }

  return issues;
}
