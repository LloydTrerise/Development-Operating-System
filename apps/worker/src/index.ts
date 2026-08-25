/**
 * DEVOS-092: `apps/worker` had no importable entry point at all before this
 * — every other consumer only ever spawned it as a real OS subprocess
 * (`tsx src/main.ts`). A real operational-recovery test needs two
 * independent `TaskDispatcher` instances sharing one real Postgres queue
 * (simulating two worker processes, one of which crashes mid-task), which
 * requires importing the real dispatcher, not re-implementing its logic in
 * a test file. `main.ts` (the process entrypoint invoked via `tsx watch`)
 * is unaffected by this — it does not import from here.
 */
export * from './task-dispatcher.js';
