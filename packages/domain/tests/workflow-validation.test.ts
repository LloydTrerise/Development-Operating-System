import { describe, expect, it } from 'vitest';
import { validateWorkflowGraph } from '../src/workflows/validation.js';

describe('validateWorkflowGraph', () => {
  it('accepts a minimal valid graph', () => {
    const issues = validateWorkflowGraph({
      name: 'Intake to Artifact',
      nodes: [{ id: 'discovery', type: 'TASK' }],
      edges: [],
    });
    expect(issues).toEqual([]);
  });

  it('rejects a missing name', () => {
    const issues = validateWorkflowGraph({ nodes: [{ id: 'a', type: 'TASK' }] });
    expect(issues.some((issue) => issue.field === 'name')).toBe(true);
  });

  it('rejects an empty node list', () => {
    const issues = validateWorkflowGraph({ name: 'Empty', nodes: [] });
    expect(issues.some((issue) => issue.field === 'nodes')).toBe(true);
  });

  it('rejects a node with an unknown type', () => {
    const issues = validateWorkflowGraph({
      name: 'Bad node',
      nodes: [{ id: 'a', type: 'NOT_A_REAL_TYPE' }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].type')).toBe(true);
  });

  it('rejects a non-object graph', () => {
    expect(validateWorkflowGraph(null)).toHaveLength(1);
    expect(validateWorkflowGraph('nope')).toHaveLength(1);
  });
});
