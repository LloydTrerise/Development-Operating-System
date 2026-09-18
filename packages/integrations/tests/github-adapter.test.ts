import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cloneRepository,
  createBranch,
  createCommit,
  openRepository,
  pushBranch,
  writeFileChange,
} from '../src/github/github.adapter.js';
import { runGit } from '../src/github/github.client.js';

/**
 * Exercises the adapter against a real, throwaway local git repository —
 * never a mock of the `git` CLI (DEVOS-054's own acceptance criterion) —
 * and never a real GitHub remote (this sprint's user-authorized
 * live-verification scoping decision).
 */
describe('github adapter (real local git repository)', () => {
  let repositoryPath: string;

  beforeEach(async () => {
    repositoryPath = await mkdtemp(join(tmpdir(), 'devos-git-adapter-test-'));
    await runGit(['init'], repositoryPath);
    // A throwaway CI/dev environment may have no global git identity
    // configured at all — set one locally so `git commit` succeeds
    // regardless of the machine it runs on.
    await runGit(['config', 'user.email', 'devos-test@example.com'], repositoryPath);
    await runGit(['config', 'user.name', 'DevOS Test'], repositoryPath);
    await writeFileChange({ repositoryPath }, 'README.md', '# test repo\n');
    await createCommit({ repositoryPath }, 'initial commit');
  });

  afterEach(async () => {
    await rm(repositoryPath, { recursive: true, force: true });
  });

  it('opens an existing repository', async () => {
    const workspace = await openRepository(repositoryPath);
    expect(workspace.repositoryPath).toBe(repositoryPath);
  });

  it('rejects opening a path that is not a git repository', async () => {
    const notARepo = await mkdtemp(join(tmpdir(), 'devos-not-a-repo-'));
    try {
      await expect(openRepository(notARepo)).rejects.toThrow();
    } finally {
      await rm(notARepo, { recursive: true, force: true });
    }
  });

  it('creates a branch, writes a file change, and commits it', async () => {
    const workspace = await openRepository(repositoryPath);
    await createBranch(workspace, 'feature/devos-054-verify');
    await writeFileChange(workspace, 'notes/change.txt', 'a real file change\n');
    const commitSha = await createCommit(workspace, 'DEVOS-054 live verification commit');

    expect(commitSha).toMatch(/^[0-9a-f]{40}$/);

    const { stdout: branchOut } = await runGit(
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      repositoryPath,
    );
    expect(branchOut.trim()).toBe('feature/devos-054-verify');

    const content = await readFile(join(repositoryPath, 'notes/change.txt'), 'utf8');
    expect(content).toBe('a real file change\n');

    const { stdout: logOut } = await runGit(['log', '--oneline', '-1'], repositoryPath);
    expect(logOut).toContain('DEVOS-054 live verification commit');
  });

  it('DEVOS-067: resumes an existing remote branch across two independent clones instead of failing to push', async () => {
    const branchName = 'devos/rework-branch';

    // First "development attempt": a fresh clone, a new branch, a commit,
    // pushed back to the shared origin.
    const firstClonePath = join(tmpdir(), `devos-git-adapter-clone-1-${Date.now()}`);
    const secondClonePath = join(tmpdir(), `devos-git-adapter-clone-2-${Date.now()}`);
    try {
      const firstWorkspace = await cloneRepository(repositoryPath, firstClonePath);
      await createBranch(firstWorkspace, branchName);
      await writeFileChange(firstWorkspace, 'attempt.txt', 'first attempt\n');
      const firstCommitSha = await createCommit(firstWorkspace, 'First attempt');
      await pushBranch(firstWorkspace, branchName);

      // Second "rework attempt": an entirely fresh clone (mirroring a new
      // ephemeral workspace), proposing the *same* branch name again.
      // Without resuming the existing remote branch, this would create a
      // divergent local branch from the default branch's HEAD and fail to
      // push as a non-fast-forward update.
      const secondWorkspace = await cloneRepository(repositoryPath, secondClonePath);
      await createBranch(secondWorkspace, branchName);
      await writeFileChange(
        secondWorkspace,
        'attempt.txt',
        'second attempt, addressing review feedback\n',
      );
      const secondCommitSha = await createCommit(secondWorkspace, 'Second attempt');
      await pushBranch(secondWorkspace, branchName);

      expect(secondCommitSha).not.toBe(firstCommitSha);

      // Both commits are real, sequential history on the same branch at
      // the origin — not two unrelated branches.
      const { stdout: log } = await runGit(['log', branchName, '--oneline'], repositoryPath);
      expect(log).toContain('First attempt');
      expect(log).toContain('Second attempt');

      const { stdout: content } = await runGit(
        ['show', `${branchName}:attempt.txt`],
        repositoryPath,
      );
      expect(content).toBe('second attempt, addressing review feedback\n');
    } finally {
      await rm(firstClonePath, { recursive: true, force: true });
      await rm(secondClonePath, { recursive: true, force: true });
    }
  }, 30_000);

  it('clones a local repository into a fresh path', async () => {
    const clonePath = join(tmpdir(), `devos-git-adapter-clone-${Date.now()}`);
    try {
      const cloned = await cloneRepository(repositoryPath, clonePath);
      expect(cloned.repositoryPath).toBe(clonePath);

      // Windows Git commonly runs with `core.autocrlf=true`, which
      // rewrites LF to CRLF on checkout — a real, correct git behavior,
      // not an adapter defect, so the assertion normalizes line endings
      // rather than asserting an exact byte-for-byte match.
      const content = await readFile(join(clonePath, 'README.md'), 'utf8');
      expect(content.replace(/\r\n/g, '\n')).toBe('# test repo\n');
    } finally {
      await rm(clonePath, { recursive: true, force: true });
    }
  });
});

/**
 * DEVOS-108 finding: live-verifying the real pilot run against a real
 * private GitHub remote hung a real `TOOL_TASK` for 5+ minutes — `git
 * clone` against a URL git can't authenticate falls back to an interactive
 * credential prompt (Windows: Git Credential Manager, a GUI dialog nothing
 * in a headless worker process can ever answer) and blocks forever, with no
 * error anywhere. `runGit` now sets `GIT_TERMINAL_PROMPT=0` (git's own
 * documented mechanism for exactly this). Reproduces the real hang
 * condition deterministically and offline: a local HTTP server that always
 * responds 401 to the smart-HTTP `info/refs` request is exactly what
 * triggers git's credential-prompt fallback for a real unauthenticated
 * remote — the fix must turn that into a fast rejection, not a hang.
 */
describe('runGit against an unauthenticated remote (DEVOS-108: no interactive credential hang)', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    server = createServer((_req, res) => {
      res.writeHead(401, { 'content-type': 'text/plain' });
      res.end('Unauthorized');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Failed to determine test server address.');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('fails fast instead of hanging on an interactive credential prompt', async () => {
    const start = Date.now();
    await expect(
      runGit(['ls-remote', `${baseUrl}/unauthorized-repo.git`], tmpdir()),
    ).rejects.toThrow();
    // The point of the fix: this resolves in seconds, not the 5+ minutes
    // (or "never") the real hang took before GIT_TERMINAL_PROMPT=0 existed.
    expect(Date.now() - start).toBeLessThan(15_000);
  }, 20_000);
});
