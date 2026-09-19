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

  it('DEVOS-158: accepts an AGENT_TASK node with only requiredRole (no agentRef)', () => {
    const issues = validateWorkflowGraph({
      name: 'Role-targeted node',
      nodes: [{ id: 'discovery', type: 'AGENT_TASK', requiredRole: 'DISCOVERY' }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].agentRef')).toBe(false);
  });

  it('DEVOS-158: accepts an AGENT_TASK node with requiredRole and requiredCapabilities', () => {
    const issues = validateWorkflowGraph({
      name: 'Role+capability-targeted node',
      nodes: [
        {
          id: 'discovery',
          type: 'AGENT_TASK',
          requiredRole: 'DISCOVERY',
          requiredCapabilities: ['repo-read'],
        },
      ],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].agentRef')).toBe(false);
  });

  it('DEVOS-158: still rejects an AGENT_TASK node with neither agentRef nor requiredRole', () => {
    const issues = validateWorkflowGraph({
      name: 'Unresolvable node',
      nodes: [{ id: 'discovery', type: 'AGENT_TASK' }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].agentRef')).toBe(true);
  });

  it('DEVOS-158: still rejects an AGENT_TASK node with a blank requiredRole and no agentRef', () => {
    const issues = validateWorkflowGraph({
      name: 'Blank requiredRole',
      nodes: [{ id: 'discovery', type: 'AGENT_TASK', requiredRole: '   ' }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].agentRef')).toBe(true);
  });

  it('DEVOS-119: rejects a CONDITION node with no config.rule', () => {
    const issues = validateWorkflowGraph({
      name: 'Missing rule',
      nodes: [{ id: 'route', type: 'CONDITION' }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].config.rule')).toBe(true);
  });

  it('DEVOS-119: rejects a CONDITION node whose config.rule is not an object', () => {
    const issues = validateWorkflowGraph({
      name: 'Non-object rule',
      nodes: [{ id: 'route', type: 'CONDITION', config: { rule: 'not-an-object' } }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].config.rule')).toBe(true);
  });

  it('DEVOS-119: accepts a CONDITION node with a config.rule and branch-tagged edges', () => {
    const issues = validateWorkflowGraph({
      name: 'Valid condition graph',
      nodes: [
        {
          id: 'route',
          type: 'CONDITION',
          config: { rule: { source: 'variable', path: 'flag', operator: 'equals', value: true } },
        },
        { id: 'onTrue', type: 'TASK' },
        { id: 'onFalse', type: 'TASK' },
      ],
      edges: [
        { from: 'route', to: 'onTrue', branch: 'true' },
        { from: 'route', to: 'onFalse', branch: 'false' },
      ],
    });
    expect(issues).toEqual([]);
  });

  it('DEVOS-120: accepts a JOIN node with no branchFailurePolicy (defaults to strict)', () => {
    const issues = validateWorkflowGraph({
      name: 'Default join',
      nodes: [{ id: 'join', type: 'JOIN' }],
    });
    expect(issues).toEqual([]);
  });

  it('DEVOS-120: accepts a JOIN node with a valid branchFailurePolicy', () => {
    const issues = validateWorkflowGraph({
      name: 'Tolerant join',
      nodes: [{ id: 'join', type: 'JOIN', config: { branchFailurePolicy: 'tolerant' } }],
    });
    expect(issues).toEqual([]);
  });

  it('DEVOS-120: rejects a JOIN node with an unrecognized branchFailurePolicy', () => {
    const issues = validateWorkflowGraph({
      name: 'Bad join policy',
      nodes: [{ id: 'join', type: 'JOIN', config: { branchFailurePolicy: 'lenient' } }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].config.branchFailurePolicy')).toBe(
      true,
    );
  });

  it('DEVOS-121: rejects a WAIT node with no config.waitType', () => {
    const issues = validateWorkflowGraph({
      name: 'Missing wait type',
      nodes: [{ id: 'wait', type: 'WAIT' }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].config.waitType')).toBe(true);
  });

  it('DEVOS-121: rejects a duration WAIT node with no positive durationSeconds', () => {
    const issues = validateWorkflowGraph({
      name: 'Bad duration',
      nodes: [{ id: 'wait', type: 'WAIT', config: { waitType: 'duration', durationSeconds: 0 } }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].config.durationSeconds')).toBe(true);
  });

  it('DEVOS-121: accepts a valid duration WAIT node', () => {
    const issues = validateWorkflowGraph({
      name: 'Valid duration wait',
      nodes: [{ id: 'wait', type: 'WAIT', config: { waitType: 'duration', durationSeconds: 30 } }],
    });
    expect(issues).toEqual([]);
  });

  it('DEVOS-121: rejects a dependency WAIT node with no taskKey', () => {
    const issues = validateWorkflowGraph({
      name: 'Bad dependency',
      nodes: [{ id: 'wait', type: 'WAIT', config: { waitType: 'dependency' } }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].config.taskKey')).toBe(true);
  });

  it('DEVOS-121: accepts a valid dependency WAIT node', () => {
    const issues = validateWorkflowGraph({
      name: 'Valid dependency wait',
      nodes: [
        { id: 'produce', type: 'TASK' },
        { id: 'wait', type: 'WAIT', config: { waitType: 'dependency', taskKey: 'produce' } },
      ],
    });
    expect(issues).toEqual([]);
  });

  it('DEVOS-122: accepts an APPROVAL node with no config at all', () => {
    const issues = validateWorkflowGraph({
      name: 'Default approval',
      nodes: [{ id: 'gate', type: 'APPROVAL' }],
    });
    expect(issues).toEqual([]);
  });

  it('DEVOS-122: accepts an APPROVAL node with a valid config', () => {
    const issues = validateWorkflowGraph({
      name: 'Configured approval',
      nodes: [
        {
          id: 'gate',
          type: 'APPROVAL',
          config: { approvalType: 'MID_BRANCH', pollIntervalSeconds: 5 },
        },
      ],
    });
    expect(issues).toEqual([]);
  });

  it('DEVOS-122: rejects an APPROVAL node with an empty-string approvalType', () => {
    const issues = validateWorkflowGraph({
      name: 'Blank approval type',
      nodes: [{ id: 'gate', type: 'APPROVAL', config: { approvalType: '   ' } }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].config.approvalType')).toBe(true);
  });

  it('DEVOS-122: rejects an APPROVAL node with a non-positive pollIntervalSeconds', () => {
    const issues = validateWorkflowGraph({
      name: 'Bad poll interval',
      nodes: [{ id: 'gate', type: 'APPROVAL', config: { pollIntervalSeconds: 0 } }],
    });
    expect(issues.some((issue) => issue.field === 'nodes[0].config.pollIntervalSeconds')).toBe(
      true,
    );
  });
});
