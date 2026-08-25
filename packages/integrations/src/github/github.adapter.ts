import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { extractCommitSha } from './github.mapper.js';
import { assertNonEmpty } from './github.schemas.js';
import { runGit } from './github.client.js';

/**
 * "adapter: implements internal port" (specs/architecture/repository-code-structure.md
 * §36). Git itself is provider-agnostic — a repository path/URL can be a
 * real GitHub remote or a local path — so these core clone/branch/commit
 * mechanics are implemented against the real `git` CLI and are
 * provider-independent; only PR creation (DEVOS-058) is GitHub-API-specific
 * and belongs in a separate module. Per this sprint's user-authorized
 * scoping decision, live verification uses a throwaway local git repository
 * only — nothing here makes a network call to a real GitHub remote.
 */
export interface GitWorkspace {
  repositoryPath: string;
}

/** Opens an existing local repository, verifying it actually is one. */
export async function openRepository(repositoryPath: string): Promise<GitWorkspace> {
  assertNonEmpty(repositoryPath, 'repositoryPath');
  await runGit(['rev-parse', '--git-dir'], repositoryPath);
  return { repositoryPath };
}

/** Clones a repository (a real GitHub remote or a local path) to `targetPath`. */
export async function cloneRepository(url: string, targetPath: string): Promise<GitWorkspace> {
  assertNonEmpty(url, 'url');
  assertNonEmpty(targetPath, 'targetPath');
  await runGit(['clone', url, targetPath], process.cwd());
  return { repositoryPath: targetPath };
}

/**
 * DEVOS-067: a rework cycle's development task gets a brand-new workspace
 * (a fresh clone) but often proposes the *same* branch name as a prior
 * attempt — continuing work on the same change, not starting an unrelated
 * one. A plain `git checkout -b` would create a new local branch from the
 * default branch's current HEAD, unaware of that prior attempt's commit;
 * pushing it would then be rejected as a non-fast-forward update. Checking
 * whether `branchName` already exists on `origin` first, and basing the
 * new local branch on it when it does, makes a second (or third) round
 * correctly continue the same branch instead of failing to push.
 */
export async function createBranch(workspace: GitWorkspace, branchName: string): Promise<void> {
  assertNonEmpty(branchName, 'branchName');
  const remoteBranchExists = await runGit(
    ['ls-remote', '--exit-code', '--heads', 'origin', branchName],
    workspace.repositoryPath,
  )
    .then(({ stdout }) => stdout.trim().length > 0)
    .catch(() => false);

  if (remoteBranchExists) {
    await runGit(['fetch', 'origin', branchName], workspace.repositoryPath);
    await runGit(['checkout', '-b', branchName, `origin/${branchName}`], workspace.repositoryPath);
  } else {
    await runGit(['checkout', '-b', branchName], workspace.repositoryPath);
  }
}

/** Writes a file's content and stages it (does not commit). */
export async function writeFileChange(
  workspace: GitWorkspace,
  relativePath: string,
  content: string,
): Promise<void> {
  assertNonEmpty(relativePath, 'relativePath');
  const fullPath = join(workspace.repositoryPath, relativePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, 'utf8');
  await runGit(['add', relativePath], workspace.repositoryPath);
}

/** Commits staged changes and returns the new commit's SHA. */
export async function createCommit(workspace: GitWorkspace, message: string): Promise<string> {
  assertNonEmpty(message, 'message');
  await runGit(['commit', '-m', message], workspace.repositoryPath);
  const { stdout } = await runGit(['rev-parse', 'HEAD'], workspace.repositoryPath);
  return extractCommitSha(stdout);
}

/**
 * Pushes a branch to the `origin` remote — found necessary while building
 * DEVOS-057: a workspace created via `cloneRepository` is ephemeral
 * (destroyed after the development task completes), so a commit made only
 * inside it is otherwise discarded along with the workspace, never durable
 * anywhere. Cloning from a local path (this sprint's live-verification
 * scoping decision) automatically configures `origin` as that same local
 * path, so this push is itself a purely local git operation — no real
 * GitHub remote is contacted.
 */
export async function pushBranch(workspace: GitWorkspace, branchName: string): Promise<void> {
  assertNonEmpty(branchName, 'branchName');
  await runGit(['push', 'origin', branchName], workspace.repositoryPath);
}
