import { describe, expect, it } from 'vitest';
import {
  buildAuthenticatedCloneUrl,
  resolveAuthenticatedCloneUrl,
  resolveGitHubRepositoryTarget,
} from '../src/tasks/github-context.js';

describe('resolveGitHubRepositoryTarget', () => {
  it('returns undefined when configuration.github is absent', () => {
    expect(resolveGitHubRepositoryTarget({})).toBeUndefined();
  });

  it('returns undefined when owner or repo is missing/blank', () => {
    expect(resolveGitHubRepositoryTarget({ github: { owner: '', repo: 'x' } })).toBeUndefined();
    expect(resolveGitHubRepositoryTarget({ github: { owner: 'x' } })).toBeUndefined();
  });

  it('returns the typed target when both owner and repo are configured', () => {
    expect(
      resolveGitHubRepositoryTarget({ github: { owner: 'devos-org', repo: 'devos-pilot' } }),
    ).toEqual({ owner: 'devos-org', repo: 'devos-pilot' });
  });
});

describe('buildAuthenticatedCloneUrl', () => {
  it('embeds the token into a real https:// GitHub URL', () => {
    const url = buildAuthenticatedCloneUrl(
      'https://github.com/LloydTrerise/devos-pilot-test.git',
      'ghp_real_token',
    );
    expect(url).toBe(
      'https://x-access-token:ghp_real_token@github.com/LloydTrerise/devos-pilot-test.git',
    );
  });

  it('leaves a local filesystem path unchanged', () => {
    const localPath = 'C:\\Users\\lte\\AppData\\Local\\Temp\\devos-repo';
    expect(buildAuthenticatedCloneUrl(localPath, 'ghp_real_token')).toBe(localPath);
  });

  it('leaves a non-https URL unchanged', () => {
    const sshUrl = 'git@github.com:LloydTrerise/devos-pilot-test.git';
    expect(buildAuthenticatedCloneUrl(sshUrl, 'ghp_real_token')).toBe(sshUrl);
  });
});

describe('resolveAuthenticatedCloneUrl', () => {
  const gitIntegration = {
    credentialReference: 'github/devos-pilot-test-pat',
    configuration: { github: { owner: 'LloydTrerise', repo: 'devos-pilot-test' } },
  };

  it('returns repositoryPath unchanged when no GitHub target is configured', async () => {
    const url = await resolveAuthenticatedCloneUrl(
      { resolve: async () => 'unused' },
      { credentialReference: 'ref', configuration: {} },
      'https://github.com/LloydTrerise/devos-pilot-test.git',
    );
    expect(url).toBe('https://github.com/LloydTrerise/devos-pilot-test.git');
  });

  it('throws when a GitHub target is configured but no credentialResolver is supplied', async () => {
    await expect(
      resolveAuthenticatedCloneUrl(
        undefined,
        gitIntegration,
        'https://github.com/LloydTrerise/devos-pilot-test.git',
      ),
    ).rejects.toThrow('no credentialResolver is available');
  });

  it('throws when the credential reference cannot be resolved', async () => {
    await expect(
      resolveAuthenticatedCloneUrl(
        { resolve: async () => null },
        gitIntegration,
        'https://github.com/LloydTrerise/devos-pilot-test.git',
      ),
    ).rejects.toThrow('Could not resolve a credential for reference "github/devos-pilot-test-pat"');
  });

  it('returns an authenticated clone URL built from the resolved token', async () => {
    const url = await resolveAuthenticatedCloneUrl(
      { resolve: async () => 'ghp_real_token' },
      gitIntegration,
      'https://github.com/LloydTrerise/devos-pilot-test.git',
    );
    expect(url).toBe(
      'https://x-access-token:ghp_real_token@github.com/LloydTrerise/devos-pilot-test.git',
    );
  });
});
