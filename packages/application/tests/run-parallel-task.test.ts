import { describe, expect, it } from 'vitest';
import { runParallelTask } from '../src/tasks/run-parallel-task.js';

describe('runParallelTask', () => {
  it('always succeeds — real fan-out is structural, driven by the dependsOn barrier', async () => {
    const output = await runParallelTask();
    expect(output).toEqual({ status: 'SUCCEEDED' });
  });
});
