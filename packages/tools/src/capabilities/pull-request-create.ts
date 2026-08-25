import type { ToolCapabilityDefinition } from '../registry/types.js';

/**
 * R3 — "Create/merge PR or external change" (specs/workflows/software-change-workflow.md
 * §27), review/approval controlled.
 */
export const pullRequestCreateCapability: ToolCapabilityDefinition = {
  key: 'pull-request-create',
  name: 'Create Pull Request',
  riskClass: 'R3',
  inputSchema: {
    type: 'object',
    properties: {
      sourceBranch: { type: 'string' },
      targetBranch: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['sourceBranch', 'targetBranch', 'title'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      pullRequestReference: { type: 'string' },
      url: { type: 'string' },
    },
    required: ['pullRequestReference'],
  },
};
