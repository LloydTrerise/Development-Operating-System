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

  // DEVOS-096: closes three real gaps found by inspecting validateWorkflowGraph
  // directly — none of duplicate node ids, dangling edges, or a missing
  // agentRef on an AGENT_TASK node were previously rejected at publish time.
  it('DEVOS-096: rejects two nodes sharing the same id', () => {
    const issues = validateWorkflowGraph({
      name: 'Duplicate ids',
      nodes: [
        { id: 'a', type: 'TASK' },
        { id: 'a', type: 'TASK' },
      ],
      edges: [],
    });
    expect(issues.some((issue) => issue.field === 'nodes[1].id')).toBe(true);
  });

  it('DEVOS-096: rejects an edge whose from/to does not match a declared node id', () => {
    const issues = validateWorkflowGraph({
      name: 'Dangling edge',
      nodes: [{ id: 'a', type: 'TASK' }],
      edges: [{ from: 'a', to: 'ghost' }],
    });
    expect(issues.some((issue) => issue.field === 'edges[0].to')).toBe(true);
    expect(issues.some((issue) => issue.field === 'edges[0].from')).toBe(false);
  });

  it('DEVOS-096: rejects an AGENT_TASK node with no agentRef', () => {
    const issues = validateWorkflowGraph({
      name: 'Missing agentRef',
      nodes: [{ id: 'discovery', type: 'AGENT_TASK' }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].agentRef')).toBe(true);
  });

  it('DEVOS-096: rejects an AGENT_TASK node with an empty-string agentRef', () => {
    const issues = validateWorkflowGraph({
      name: 'Blank agentRef',
      nodes: [{ id: 'discovery', type: 'AGENT_TASK', agentRef: '   ' }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].agentRef')).toBe(true);
  });

  it('DEVOS-096: accepts a valid graph with edges and a properly-configured AGENT_TASK node', () => {
    const issues = validateWorkflowGraph({
      name: 'Valid graph',
      nodes: [
        { id: 'discovery', type: 'AGENT_TASK', agentRef: 'discovery-agent' },
        { id: 'review', type: 'TASK' },
      ],
      edges: [{ from: 'discovery', to: 'review' }],
    });
    expect(issues).toEqual([]);
  });
});
