/**
 * DEVOS-120: a `PARALLEL` node's own real behavior is entirely structural,
 * not computational — every branch's first task already depends only on
 * this node (`run-creation.ts`'s `dependsOn` computation from the graph's
 * declared edges), so once this task reaches `SUCCEEDED`, `claimNext()`'s
 * existing barrier already makes every branch concurrently eligible with no
 * further code needed. This handler exists only so `PARALLEL` has one
 * registered at all (`task-dispatcher.ts` otherwise fails it with "No
 * handler registered for task type").
 */
export async function runParallelTask(): Promise<Record<string, unknown>> {
  return { status: 'SUCCEEDED' };
}
