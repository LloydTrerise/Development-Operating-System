import type { ToolCapabilityDefinition } from '../registry/types.js';

/**
 * DEVOS-075: Stage 11 — Release (specs/workflows/software-change-workflow.md
 * §22) implies verification of the release result before it is considered
 * complete; source description "Smoke/health validation"
 * (specs/sprints/sprint-06/DEVOS-075.md). No smoke/health-check contract is
 * specified anywhere — this deliberately mirrors `build-run`/`test-run`'s
 * exact shape (`{command}` -> `{exitCode, stdout, stderr}`, R2) rather than
 * inventing a differently-shaped mechanism, since a post-release check is
 * the same kind of thing (an admin-configured local command, never agent
 * output) run against a different target: DEVOS-074's real deployed
 * directory instead of a development workspace.
 */
export const healthCheckCapability: ToolCapabilityDefinition = {
  key: 'health-check',
  name: 'Run Post-Release Health Check',
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
