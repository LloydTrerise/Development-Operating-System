import { describe, expect, it, vi } from 'vitest';
import { createGitHubPullRequestProvider } from '../src/pull-requests/github-pull-request-provider.js';

const REQUEST = {
  sourceBranch: 'feature/x',
  targetBranch: 'main',
  title: 'Add feature X',
  description: 'Implements feature X.',
  idempotencyKey: 'idem-1',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createGitHubPullRequestProvider', () => {
  it('creates a real PR when no open one exists yet for the same head/base', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, [])) // GET existing-open-PR check
      .mockResolvedValueOnce(
        jsonResponse(201, {
          number: 42,
          title: 'Add feature X',
          body: 'Implements feature X.',
          html_url: 'https://github.com/devos-org/devos-pilot/pull/42',
          head: { ref: 'feature/x' },
          base: { ref: 'main' },
        }),
      );

    const provider = createGitHubPullRequestProvider({
      token: 'ghp_test_token',
      owner: 'devos-org',
      repo: 'devos-pilot',
      fetchImpl,
    });

    const record = await provider.createPullRequest(REQUEST);

    expect(record).toEqual({
      id: '42',
      title: 'Add feature X',
      sourceBranch: 'feature/x',
      targetBranch: 'main',
      description: 'Implements feature X.',
      url: 'https://github.com/devos-org/devos-pilot/pull/42',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const [getUrl, getInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(getUrl).toContain('/repos/devos-org/devos-pilot/pulls?state=open');
    expect(getUrl).toContain('head=devos-org%3Afeature%2Fx');
    expect((getInit.headers as Record<string, string>).authorization).toBe('Bearer ghp_test_token');

    const [postUrl, postInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(postUrl).toBe('https://api.github.com/repos/devos-org/devos-pilot/pulls');
    expect(postInit.method).toBe('POST');
    const body = JSON.parse(postInit.body as string);
    expect(body).toEqual({
      title: 'Add feature X',
      head: 'feature/x',
      base: 'main',
      body: 'Implements feature X.',
    });
  });

  it('is idempotent: returns the already-open PR instead of creating a duplicate', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, [
        {
          number: 7,
          title: 'Add feature X',
          body: null,
          html_url: 'https://github.com/devos-org/devos-pilot/pull/7',
          head: { ref: 'feature/x' },
          base: { ref: 'main' },
        },
      ]),
    );

    const provider = createGitHubPullRequestProvider({
      token: 'ghp_test_token',
      owner: 'devos-org',
      repo: 'devos-pilot',
      fetchImpl,
    });

    const record = await provider.createPullRequest(REQUEST);

    expect(record.id).toBe('7');
    expect(record.url).toBe('https://github.com/devos-org/devos-pilot/pull/7');
    expect(fetchImpl).toHaveBeenCalledTimes(1); // no POST — the GET-first check was enough
  });

  it('throws with the status and response body, without exposing the token, on a failed create', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(new Response('{"message":"Validation Failed"}', { status: 422 }));

    const provider = createGitHubPullRequestProvider({
      token: 'super-secret-token',
      owner: 'devos-org',
      repo: 'devos-pilot',
      fetchImpl,
    });

    await expect(provider.createPullRequest(REQUEST)).rejects.toThrow(/status 422/);
    await expect(provider.createPullRequest(REQUEST)).rejects.not.toThrow(/super-secret-token/);
  });
});
