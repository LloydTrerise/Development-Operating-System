import { buildRunCapability } from '../capabilities/build-run.js';
import { deployCapability } from '../capabilities/deploy.js';
import { gitCommitCapability } from '../capabilities/git-commit.js';
import { healthCheckCapability } from '../capabilities/health-check.js';
import { pullRequestCreateCapability } from '../capabilities/pull-request-create.js';
import { repoReadCapability } from '../capabilities/repo-read.js';
import { repoWriteCapability } from '../capabilities/repo-write.js';
import { testRunCapability } from '../capabilities/test-run.js';
import type { ToolCapabilityDefinition } from './types.js';

/**
 * The canonical, in-code list of tool capability definitions. `build-run`/
 * `test-run` (DEVOS-062/063) join Sprint 4's four; `deploy` (DEVOS-074) is
 * the last one `specs/architecture/repository-code-structure.md` §16 names;
 * `health-check` (DEVOS-075) is not named in that section but mirrors
 * `build-run`/`test-run`'s exact shape for the same reason those two exist
 * (Stage 11's post-release validation, §22). `issue-read`/`issue-update`
 * remain out of scope — no work-item-tooling task exists anywhere in this
 * sprint's own backlog.
 */
export const capabilityDefinitions: readonly ToolCapabilityDefinition[] = [
  repoReadCapability,
  repoWriteCapability,
  gitCommitCapability,
  pullRequestCreateCapability,
  buildRunCapability,
  testRunCapability,
  deployCapability,
  healthCheckCapability,
];

export function getCapabilityDefinition(key: string): ToolCapabilityDefinition | undefined {
  return capabilityDefinitions.find((definition) => definition.key === key);
}
