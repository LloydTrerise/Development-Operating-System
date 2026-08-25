import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCommit, writeFileChange } from '../src/github/github.adapter.js';
import { runGit } from '../src/github/github.client.js';
import { createLocalStagingDeploymentProvider } from '../src/deployment/local-staging-deployment-provider.js';

// Windows Git commonly runs with `core.autocrlf=true`, which rewrites LF
// to CRLF on a real clone — normalized here rather than asserting an
// environment-dependent line ending, mirroring github-adapter.test.ts's
// identical precedent.
async function readFileNormalized(path: string): Promise<string> {
  return (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
}

/**
 * DEVOS-074: exercises the provider against a real, throwaway local git
 * repository and a real, throwaway staging directory it deploys into —
 * never a mock, and never a real external deployment/hosting provider
 * (this sprint's user-authorized scoping decision, `specs/sprints/sprint-06/README.md`).
 */
describe('local staging deployment provider (real local git + filesystem)', () => {
  let repositoryPath: string;
  let stagingRoot: string;
  let firstRevision: string;

  beforeEach(async () => {
    repositoryPath = await mkdtemp(join(tmpdir(), 'devos-deploy-repo-'));
    stagingRoot = await mkdtemp(join(tmpdir(), 'devos-deploy-staging-'));
    await runGit(['init'], repositoryPath);
    await runGit(['config', 'user.email', 'devos-test@example.com'], repositoryPath);
    await runGit(['config', 'user.name', 'DevOS Test'], repositoryPath);
    await writeFileChange({ repositoryPath }, 'index.html', '<h1>v1</h1>\n');
    firstRevision = await createCommit({ repositoryPath }, 'v1');
  });

  afterEach(async () => {
    await rm(repositoryPath, { recursive: true, force: true });
    await rm(stagingRoot, { recursive: true, force: true });
  });

  it('deploys a real revision into a real, environment-named directory under stagingRoot', async () => {
    const provider = createLocalStagingDeploymentProvider(stagingRoot);

    const record = await provider.deploy({
      repositoryPath,
      environment: 'staging',
      revision: firstRevision,
    });

    expect(record.environment).toBe('staging');
    expect(record.revision).toBe(firstRevision);
    expect(record.deployedPath).toBe(join(stagingRoot, 'staging'));

    const content = await readFileNormalized(join(record.deployedPath, 'index.html'));
    expect(content).toBe('<h1>v1</h1>\n');
  });

  it('re-deploying the same environment with a newer revision replaces the deployed content', async () => {
    const provider = createLocalStagingDeploymentProvider(stagingRoot);

    await provider.deploy({ repositoryPath, environment: 'staging', revision: firstRevision });

    await writeFileChange({ repositoryPath }, 'index.html', '<h1>v2</h1>\n');
    const secondRevision = await createCommit({ repositoryPath }, 'v2');

    const record = await provider.deploy({
      repositoryPath,
      environment: 'staging',
      revision: secondRevision,
    });

    expect(record.revision).toBe(secondRevision);
    expect(record.revision).not.toBe(firstRevision);
    const content = await readFileNormalized(join(record.deployedPath, 'index.html'));
    expect(content).toBe('<h1>v2</h1>\n');
  }, 30_000);

  it('deploys different environments into separate, independent directories', async () => {
    const provider = createLocalStagingDeploymentProvider(stagingRoot);

    const staging = await provider.deploy({
      repositoryPath,
      environment: 'staging',
      revision: firstRevision,
    });
    const preview = await provider.deploy({
      repositoryPath,
      environment: 'preview',
      revision: firstRevision,
    });

    expect(staging.deployedPath).not.toBe(preview.deployedPath);
    const stagingContent = await readFileNormalized(join(staging.deployedPath, 'index.html'));
    const previewContent = await readFileNormalized(join(preview.deployedPath, 'index.html'));
    expect(stagingContent).toBe('<h1>v1</h1>\n');
    expect(previewContent).toBe('<h1>v1</h1>\n');
  });

  it('rejects deploying a revision that does not exist in the repository', async () => {
    const provider = createLocalStagingDeploymentProvider(stagingRoot);

    await expect(
      provider.deploy({
        repositoryPath,
        environment: 'staging',
        revision: 'not-a-real-revision',
      }),
    ).rejects.toThrow();
  });
});
