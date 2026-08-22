import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    passWithNoTests: true,
    // vertical-slice.test.ts and hardening.test.ts both drive a shared,
    // real Postgres task queue with no per-test isolation — claimNext()
    // and reclaimStale() are deliberately global across runs/projects,
    // matching production. Running these files concurrently (vitest's
    // default) would let one file's worker/claims steal the other's
    // tasks. Sequential execution avoids that without bolting artificial
    // run-scoping onto the queue purely for test isolation.
    fileParallelism: false,
  },
});
