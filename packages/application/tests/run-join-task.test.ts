import { describe, expect, it } from 'vitest';
import { runJoinTask } from '../src/tasks/run-join-task.js';

describe('runJoinTask', () => {
  it('always succeeds — the real join semantics live in the queue/failure machinery', async () => {
    const output = await runJoinTask();
    expect(output).toEqual({ status: 'SUCCEEDED' });
  });
});
