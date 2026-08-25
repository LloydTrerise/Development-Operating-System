import type { ToolCapabilityDefinition } from '../registry/types.js';

/**
 * R2 — "Create feature branch/commit" (specs/workflows/software-change-workflow.md
 * §27), policy controlled.
 */
export const repoWriteCapability: ToolCapabilityDefinition = {
  key: 'repo-write',
  name: 'Write Repository File',
  riskClass: 'R2',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      content: { type: 'string' },
      branch: { type: 'string' },
    },
    required: ['path', 'content', 'branch'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
    },
    required: ['path'],
  },
};
