import type { ToolCapabilityDefinition } from '../registry/types.js';

/**
 * DEVOS-062: Stage 8 — Automated Validation
 * (specs/workflows/software-change-workflow.md §18) lists "build" as a
 * validation activity. Classified R2, the same class as `git-commit` — a
 * local action within the controlled workspace, not an external/PR-facing
 * action (R3) or a production/destructive one (R4). `command` is supplied
 * by the caller (resolved from the project's Git integration configuration,
 * never from agent output) — see `@devos/integrations`'s `runCommand` doc
 * comment.
 */
export const buildRunCapability: ToolCapabilityDefinition = {
  key: 'build-run',
  name: 'Run Build',
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
