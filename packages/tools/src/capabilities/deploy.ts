import type { ToolCapabilityDefinition } from '../registry/types.js';

/**
 * DEVOS-074: Stage 11 — Release (specs/workflows/software-change-workflow.md
 * §22) — "controlled staging deployment" (source description,
 * specs/sprints/sprint-06/DEVOS-074.md). Classified R3, the same class as
 * `pull-request-create` — an external/environment-facing change, not merely
 * a local workspace action (R2) — since §27's Risk Model names no
 * deployment-specific class and this sprint's own README flags that as an
 * explicit assumption. `revision` is the only caller-supplied parameter
 * (schema-validated); `repositoryPath`/`environment` travel in `target`
 * (unvalidated by this schema, exactly like every other capability's
 * `target` — see `build-run`/`git-commit`), and `target.environment` is
 * what DEVOS-072's Tool-Gateway wiring threads into policy evaluation.
 */
export const deployCapability: ToolCapabilityDefinition = {
  key: 'deploy',
  name: 'Deploy to Environment',
  riskClass: 'R3',
  inputSchema: {
    type: 'object',
    properties: {
      revision: { type: 'string' },
    },
    required: ['revision'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      deploymentId: { type: 'string' },
      deployedPath: { type: 'string' },
      revision: { type: 'string' },
    },
    required: ['deploymentId', 'deployedPath', 'revision'],
  },
};
