/**
 * DEVOS-120: a `JOIN` node's real behavior lives entirely in the shared
 * queue/failure machinery, not in this handler — `claimNext()`'s
 * `dependsOn`/`dependsOnTerminalOnly` barrier (`packages/database/src/repositories/task-queue.ts`)
 * is what decides *when* this task becomes eligible (every named branch
 * reaching `SUCCEEDED`, or — for a `'tolerant'` `branchFailurePolicy` —
 * any terminal status), and `resolveTaskFailure`'s tolerance check is what
 * decides whether one branch's real failure still fails the whole run.
 * By the time this handler actually runs, the join has already happened;
 * it only needs to report success.
 */
export async function runJoinTask(): Promise<Record<string, unknown>> {
  return { status: 'SUCCEEDED' };
}
