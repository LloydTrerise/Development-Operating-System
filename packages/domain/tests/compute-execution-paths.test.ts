import { describe, expect, it } from 'vitest';
import { computeExecutionPaths } from '../src/workflows/compute-execution-paths.js';

describe('computeExecutionPaths', () => {
  it('computes one path per terminal node for a simple linear graph', () => {
    const paths = computeExecutionPaths({
      name: 'Linear',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [
        { id: 'a', type: 'TASK' },
        { id: 'b', type: 'TASK' },
      ],
      edges: [{ from: 'a', to: 'b' }],
      policies: [],
      outputs: [],
    });

    expect(paths).toHaveLength(1);
    expect(paths[0]?.nodeIds).toEqual(['a', 'b']);
    expect(paths[0]?.branchesTaken).toEqual([]);
    expect(paths[0]?.passesThroughApproval).toBe(false);
    expect(paths[0]?.passesThroughParallelOrJoin).toBe(false);
  });

  it('produces a distinct, correctly-labeled path per CONDITION branch, PARALLEL fan-out, and APPROVAL node — mirroring the real Incident Response shape (Sprint 12)', () => {
    const graph = {
      name: 'Incident Response shape',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [
        { id: 'severity-check', type: 'CONDITION' },
        { id: 'diagnose-and-notify', type: 'PARALLEL' },
        { id: 'diagnose', type: 'TOOL_TASK' },
        { id: 'notify', type: 'TOOL_TASK' },
        { id: 'diagnosis-join', type: 'JOIN' },
        { id: 'await-confirmation', type: 'WAIT' },
        { id: 'remediation-approval', type: 'APPROVAL' },
        { id: 'rollback', type: 'TOOL_TASK' },
        { id: 'log-only', type: 'TOOL_TASK' },
      ],
      edges: [
        { from: 'severity-check', to: 'diagnose-and-notify', branch: 'high' },
        { from: 'severity-check', to: 'log-only', branch: 'low' },
        { from: 'diagnose-and-notify', to: 'diagnose' },
        { from: 'diagnose-and-notify', to: 'notify' },
        { from: 'diagnose', to: 'diagnosis-join' },
        { from: 'notify', to: 'diagnosis-join' },
        { from: 'diagnosis-join', to: 'await-confirmation' },
        { from: 'await-confirmation', to: 'remediation-approval' },
        { from: 'remediation-approval', to: 'rollback' },
      ],
      policies: [],
      outputs: [],
    };

    const paths = computeExecutionPaths(graph);

    // One root (severity-check); three real routes to a terminal node: the
    // low-severity branch, and the high-severity branch's own two parallel
    // fan-out routes (diagnose.../rollback and notify.../rollback) — a JOIN
    // is a pass-through, not itself a further branch point.
    expect(paths).toHaveLength(3);

    const lowPath = paths.find((path) => path.nodeIds.includes('log-only'));
    expect(lowPath?.nodeIds).toEqual(['severity-check', 'log-only']);
    expect(lowPath?.branchesTaken).toEqual(['low']);
    expect(lowPath?.passesThroughApproval).toBe(false);
    expect(lowPath?.passesThroughParallelOrJoin).toBe(false);

    const highPaths = paths.filter((path) => path.nodeIds.includes('rollback'));
    expect(highPaths).toHaveLength(2);
    for (const path of highPaths) {
      expect(path.branchesTaken).toEqual(['high']);
      expect(path.passesThroughApproval).toBe(true);
      expect(path.passesThroughParallelOrJoin).toBe(true);
      expect(path.nodeIds[0]).toBe('severity-check');
      expect(path.nodeIds[path.nodeIds.length - 1]).toBe('rollback');
    }
    const viaDiagnose = highPaths.find((path) => path.nodeIds.includes('diagnose'));
    const viaNotify = highPaths.find((path) => path.nodeIds.includes('notify'));
    expect(viaDiagnose).toBeDefined();
    expect(viaNotify).toBeDefined();
  });

  it('does not loop forever on an authored cycle — this engine never required a DAG', () => {
    const paths = computeExecutionPaths({
      name: 'Cyclic',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [
        { id: 'a', type: 'TASK' },
        { id: 'b', type: 'TASK' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
      policies: [],
      outputs: [],
    });

    // Neither node has an "incoming-edge-free" root in a pure 2-cycle, so
    // there are no roots at all — zero paths is the real, honest answer
    // (not an infinite loop or a fabricated one).
    expect(paths).toEqual([]);
  });
});
