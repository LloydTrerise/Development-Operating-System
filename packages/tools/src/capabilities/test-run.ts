import type { ToolCapabilityDefinition } from '../registry/types.js';

/**
 * DEVOS-063: Stage 8 — Automated Validation
 * (specs/workflows/software-change-workflow.md §18) lists "unit tests;
 * integration tests; contract tests; relevant E2E tests" as validation
 * activities, deliberately not split into separate capabilities per test
 * kind — nothing in the spec corpus requires that granularity, and this
 * POC's own repository already runs its full suite through one `pnpm test`
 * entrypoint per package. Same shape and risk class as `build-run`
 * (DEVOS-062) — see that capability's doc comment for the R2 classification
 * and the `command`-comes-from-configuration rule.
 */
export const testRunCapability: ToolCapabilityDefinition = {
  key: 'test-run',
  name: 'Run Tests',
  riskClass: 'R2',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string' },
    },
    required: ['command'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      exitCode: { type: 'number' },
      stdout: { type: 'string' },
      stderr: { type: 'string' },
    },
    required: ['exitCode', 'stdout', 'stderr'],
  },
};
