import { describe, expect, it } from 'vitest';
import {
  buildAuthenticatedCloneUrl,
  resolveAuthenticatedCloneUrl,
  resolveGitHubRepositoryTarget,
  resolveGitLabProjectTarget,
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

describe('resolveGitLabProjectTarget', () => {
  it('returns undefined when configuration.gitlab is absent', () => {
    expect(resolveGitLabProjectTarget({})).toBeUndefined();
  });

  it('returns undefined when projectId is missing/blank', () => {
    expect(resolveGitLabProjectTarget({ gitlab: {} })).toBeUndefined();
    expect(resolveGitLabProjectTarget({ gitlab: { projectId: '' } })).toBeUndefined();
  });

  it('returns undefined when host is present but blank', () => {
    expect(
      resolveGitLabProjectTarget({ gitlab: { projectId: '123', host: '' } }),
    ).toBeUndefined();
  });

  it('returns the typed target with no host when only projectId is configured', () => {
    expect(resolveGitLabProjectTarget({ gitlab: { projectId: '123' } })).toEqual({
      projectId: '123',
    });
  });

  it('returns the typed target including a configured self-managed host', () => {
    expect(
      resolveGitLabProjectTarget({ gitlab: { projectId: '123', host: 'gitlab.example.com' } }),
    ).toEqual({ projectId: '123', host: 'gitlab.example.com' });
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

  it('DEVOS-195: embeds the token under a configured username, e.g. GitLab\'s own "oauth2" convention', () => {
    const url = buildAuthenticatedCloneUrl(
      'https://gitlab.com/devos-org/devos-pilot.git',
      'glpat_real_token',
      'oauth2',
    );
    expect(url).toBe('https://oauth2:glpat_real_token@gitlab.com/devos-org/devos-pilot.git');
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
