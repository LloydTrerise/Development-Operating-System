import type { ToolCapabilityDefinition } from '../registry/types.js';

/**
 * DEVOS-113: a real static/security-scanning stage feeding release
 * readiness — no specific tool is named anywhere in the spec corpus
 * (`DEVOS-PRODUCTION-READINESS-ROADMAP.md` E2's own flagged gap), so this
 * is this task's own recorded choice: `pnpm audit` (a real dependency/
 * vulnerability scanner already present in this codebase's own toolchain —
 * no new external dependency, real findings against this repository's own
 * real `pnpm-lock.yaml`, not a fabricated report). Same shape and risk
 * class as `build-run`/`test-run` (DEVOS-062/063) — a project-configured
 * `command` string, never agent-authored, for the identical reason those
 * two capabilities already document.
 */
export const securityScanCapability: ToolCapabilityDefinition = {
  key: 'security-scan',
  name: 'Run Security Scan',
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
