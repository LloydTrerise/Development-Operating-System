import type { ToolCapabilityDefinition } from '../registry/types.js';

/**
 * R2 — "Create feature branch/commit" (specs/workflows/software-change-workflow.md
 * §27), policy controlled.
 */
export const gitCommitCapability: ToolCapabilityDefinition = {
  key: 'git-commit',
  name: 'Create Git Commit',
  riskClass: 'R2',
  inputSchema: {
    type: 'object',
    properties: {
      branch: { type: 'string' },
      message: { type: 'string' },
    },
    required: ['branch', 'message'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      commitSha: { type: 'string' },
      branch: { type: 'string' },
    },
    required: ['commitSha', 'branch'],
  },
};
