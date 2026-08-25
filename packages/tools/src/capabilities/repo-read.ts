import type { ToolCapabilityDefinition } from '../registry/types.js';

/**
 * R0 — "Read-only discovery" (specs/workflows/software-change-workflow.md
 * §27), automatically controlled.
 */
export const repoReadCapability: ToolCapabilityDefinition = {
  key: 'repo-read',
  name: 'Read Repository File',
  riskClass: 'R0',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      ref: { type: 'string' },
    },
    required: ['path'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['path', 'content'],
  },
};
