import { describe, expect, it } from 'vitest';
import { diffWorkflowVersions } from '../src/workflows/diff-workflow-versions.js';

describe('diffWorkflowVersions', () => {
  it('reports zero changes for two identical graphs', () => {
    const graph = {
      name: 'Same',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [{ id: 'a', type: 'TASK' }],
      edges: [],
      policies: [],
      outputs: [],
    };
    const diff = diffWorkflowVersions(graph, graph);
    expect(diff).toEqual({
      nodesAdded: [],
      nodesRemoved: [],
      nodesChanged: [],
      edgesAdded: [],
      edgesRemoved: [],
      policiesAdded: [],
      policiesRemoved: [],
      outputsAdded: [],
      outputsRemoved: [],
    });
  });

  it('reports exactly an added node, a removed edge, and a changed CONDITION node’s config.rule — and nothing else', () => {
    const before = {
      name: 'V1',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [
        {
          id: 'route',
          type: 'CONDITION',
          config: {
            rule: { source: 'variable', path: 'severity', operator: 'equals', value: 'high' },
            whenTrue: 'high',
            whenFalse: 'low',
          },
        },
        { id: 'a', type: 'TASK' },
        { id: 'b', type: 'TASK' },
      ],
      edges: [
        { from: 'route', to: 'a', branch: 'high' },
        { from: 'route', to: 'b', branch: 'low' },
      ],
      policies: ['planning-approval'],
      outputs: [],
    };

    const after = {
      name: 'V1',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [
        {
          id: 'route',
          type: 'CONDITION',
          // Changed: operator equals -> notEquals.
          config: {
            rule: { source: 'variable', path: 'severity', operator: 'notEquals', value: 'high' },
            whenTrue: 'high',
            whenFalse: 'low',
          },
        },
        { id: 'a', type: 'TASK' },
        { id: 'b', type: 'TASK' },
        { id: 'c', type: 'TASK' }, // Added node.
      ],
      edges: [
        { from: 'route', to: 'a', branch: 'high' },
        // Removed: { from: 'route', to: 'b', branch: 'low' }
      ],
      policies: ['planning-approval'],
      outputs: [],
    };

    const diff = diffWorkflowVersions(before, after);

    expect(diff.nodesAdded).toEqual([{ id: 'c', type: 'TASK' }]);
    expect(diff.nodesRemoved).toEqual([]);
    expect(diff.nodesChanged).toHaveLength(1);
    expect(diff.nodesChanged[0]?.id).toBe('route');
    expect(diff.nodesChanged[0]?.before).toEqual(before.nodes[0]);
    expect(diff.nodesChanged[0]?.after).toEqual(after.nodes[0]);

    expect(diff.edgesAdded).toEqual([]);
    expect(diff.edgesRemoved).toEqual([{ from: 'route', to: 'b', branch: 'low' }]);

    expect(diff.policiesAdded).toEqual([]);
    expect(diff.policiesRemoved).toEqual([]);
    expect(diff.outputsAdded).toEqual([]);
    expect(diff.outputsRemoved).toEqual([]);
  });

  it('reports a removed node and a removed policy', () => {
    const before = {
      name: 'V1',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [
        { id: 'a', type: 'TASK' },
        { id: 'b', type: 'TASK' },
      ],
      edges: [{ from: 'a', to: 'b' }],
      policies: ['release-approval'],
      outputs: [],
    };
    const after = {
      name: 'V1',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [{ id: 'a', type: 'TASK' }],
      edges: [],
      policies: [],
      outputs: [],
    };

    const diff = diffWorkflowVersions(before, after);

    expect(diff.nodesRemoved).toEqual([{ id: 'b', type: 'TASK' }]);
    expect(diff.nodesAdded).toEqual([]);
    expect(diff.nodesChanged).toEqual([]);
    expect(diff.edgesRemoved).toEqual([{ from: 'a', to: 'b' }]);
    expect(diff.policiesRemoved).toEqual(['release-approval']);
  });
});
