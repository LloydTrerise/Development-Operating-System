import { describe, expect, it } from 'vitest';
import { createLocalPullRequestProvider } from '../src/pull-requests/local-pull-request-provider.js';

describe('createLocalPullRequestProvider', () => {
  it('creates a pull request record from the given fields', async () => {
    const provider = createLocalPullRequestProvider();

    const record = await provider.createPullRequest({
      sourceBranch: 'feature/x',
      targetBranch: 'main',
      title: 'Add feature X',
      description: 'Implements feature X.',
      idempotencyKey: 'idem-1',
    });

    expect(record.title).toBe('Add feature X');
    expect(record.sourceBranch).toBe('feature/x');
    expect(record.targetBranch).toBe('main');
    expect(record.description).toBe('Implements feature X.');
    expect(record.id).toBeTruthy();
    expect(record.url).toContain(record.id);
  });

  it('is idempotent: a repeated request with the same key returns the original record', async () => {
    const provider = createLocalPullRequestProvider();

    const first = await provider.createPullRequest({
      sourceBranch: 'feature/x',
      targetBranch: 'main',
      title: 'Add feature X',
      idempotencyKey: 'idem-1',
    });
    const second = await provider.createPullRequest({
      sourceBranch: 'feature/x',
      targetBranch: 'main',
      title: 'Add feature X (retried)',
      idempotencyKey: 'idem-1',
    });

    expect(second.id).toBe(first.id);
    expect(second.title).toBe(first.title);
  });

  it('creates a distinct record for a different idempotency key', async () => {
    const provider = createLocalPullRequestProvider();

    const first = await provider.createPullRequest({
      sourceBranch: 'feature/x',
      targetBranch: 'main',
      title: 'Add feature X',
      idempotencyKey: 'idem-1',
    });
    const second = await provider.createPullRequest({
      sourceBranch: 'feature/y',
      targetBranch: 'main',
      title: 'Add feature Y',
      idempotencyKey: 'idem-2',
    });

    expect(second.id).not.toBe(first.id);
  });
});
