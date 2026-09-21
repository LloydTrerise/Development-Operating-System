import { describe, expect, it, vi } from 'vitest';
import { createGitLabPullRequestProvider } from '../src/pull-requests/gitlab-pull-request-provider.js';

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

describe('createGitLabPullRequestProvider', () => {
  it('creates a real merge request when no open one exists yet for the same source/target', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, [])) // GET existing-open-MR check
      .mockResolvedValueOnce(
        jsonResponse(201, {
          iid: 42,
          title: 'Add feature X',
          description: 'Implements feature X.',
          web_url: 'https://gitlab.com/devos-org/devos-pilot/-/merge_requests/42',
          source_branch: 'feature/x',
          target_branch: 'main',
        }),
      );

    const provider = createGitLabPullRequestProvider({
      token: 'glpat_test_token',
      projectId: 'devos-org/devos-pilot',
      fetchImpl,
    });

    const record = await provider.createPullRequest(REQUEST);

    expect(record).toEqual({
      id: '42',
      title: 'Add feature X',
      sourceBranch: 'feature/x',
      targetBranch: 'main',
      description: 'Implements feature X.',
      url: 'https://gitlab.com/devos-org/devos-pilot/-/merge_requests/42',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const [getUrl, getInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(getUrl).toContain('/projects/devos-org%2Fdevos-pilot/merge_requests?state=opened');
    expect(getUrl).toContain('source_branch=feature%2Fx');
    expect((getInit.headers as Record<string, string>)['private-token']).toBe(
      'glpat_test_token',
    );

    const [postUrl, postInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(postUrl).toBe(
      'https://gitlab.com/api/v4/projects/devos-org%2Fdevos-pilot/merge_requests',
    );
    expect(postInit.method).toBe('POST');
    const body = JSON.parse(postInit.body as string);
    expect(body).toEqual({
      title: 'Add feature X',
      source_branch: 'feature/x',
      target_branch: 'main',
      description: 'Implements feature X.',
    });
  });

  it('is idempotent: returns the already-open merge request instead of creating a duplicate', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, [
        {
          iid: 7,
          title: 'Add feature X',
          description: null,
          web_url: 'https://gitlab.com/devos-org/devos-pilot/-/merge_requests/7',
          source_branch: 'feature/x',
          target_branch: 'main',
        },
      ]),
    );

    const provider = createGitLabPullRequestProvider({
      token: 'glpat_test_token',
      projectId: 'devos-org/devos-pilot',
      fetchImpl,
    });

    const record = await provider.createPullRequest(REQUEST);

    expect(record.id).toBe('7');
    expect(record.url).toBe('https://gitlab.com/devos-org/devos-pilot/-/merge_requests/7');
    expect(fetchImpl).toHaveBeenCalledTimes(1); // no POST — the GET-first check was enough
  });

  it('honours a configured self-managed host', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(
        jsonResponse(201, {
          iid: 1,
          title: 'Add feature X',
          description: null,
          web_url: 'https://gitlab.example.com/devos-org/devos-pilot/-/merge_requests/1',
          source_branch: 'feature/x',
          target_branch: 'main',
        }),
      );

    const provider = createGitLabPullRequestProvider({
      token: 'glpat_test_token',
      projectId: '123',
      host: 'gitlab.example.com',
      fetchImpl,
    });

    await provider.createPullRequest(REQUEST);

    const [postUrl] = fetchImpl.mock.calls[1] as [string];
    expect(postUrl).toBe('https://gitlab.example.com/api/v4/projects/123/merge_requests');
  });

  it('throws with the status and response body, without exposing the token, on a failed create', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(new Response('{"message":"Validation Failed"}', { status: 422 }));

    const provider = createGitLabPullRequestProvider({
      token: 'super-secret-token',
      projectId: 'devos-org/devos-pilot',
      fetchImpl,
    });

    await expect(provider.createPullRequest(REQUEST)).rejects.toThrow(/status 422/);
    await expect(provider.createPullRequest(REQUEST)).rejects.not.toThrow(/super-secret-token/);
  });
});
