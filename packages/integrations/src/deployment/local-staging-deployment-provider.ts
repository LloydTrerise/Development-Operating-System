import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { cloneRepository, runGit } from '../github/index.js';
import type { DeployRequest, DeploymentProvider, DeploymentRecord } from './deployment-provider.js';

/**
 * The fake/local-but-real `DeploymentProvider` this sprint's
 * user-authorized scoping decision requires: no real cloud/hosting API
 * call, but a genuine, verifiable local filesystem action, not an in-memory
 * mock — mirrors DEVOS-054's real Git adapter more closely than DEVOS-058's
 * purely in-memory `PullRequestProvider`, since DEVOS-075's post-release
 * validation needs somewhere real to actually check.
 *
 * "Deploying" clones the repository fresh into
 * `<stagingRoot>/<environment>/` and checks out the requested revision —
 * the resulting directory's real, on-disk content at that revision *is*
 * the deployment, not a record describing one. Re-deploying the same
 * environment replaces its directory outright (`rm` then re-clone) rather
 * than attempting an in-place update, since a staging environment is
 * disposable by design and a fresh checkout is simpler and more reliably
 * idempotent than reconciling a possibly-diverged working tree.
 */
export function createLocalStagingDeploymentProvider(stagingRoot: string): DeploymentProvider {
  return {
    async deploy(request: DeployRequest): Promise<DeploymentRecord> {
      const deployedPath = join(stagingRoot, request.environment);
      await rm(deployedPath, { recursive: true, force: true });
      await mkdir(stagingRoot, { recursive: true });
      await cloneRepository(request.repositoryPath, deployedPath);
      await runGit(['checkout', request.revision], deployedPath);
      const { stdout } = await runGit(['rev-parse', 'HEAD'], deployedPath);

      return {
        id: randomUUID(),
        environment: request.environment,
        revision: stdout.trim(),
        deployedPath,
      };
    },
  };
}
