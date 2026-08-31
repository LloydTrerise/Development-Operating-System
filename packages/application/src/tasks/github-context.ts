import type { CredentialResolver } from '@devos/integrations';

export interface GitHubRepositoryTarget {
  owner: string;
  repo: string;
}

/**
 * DEVOS-104's own flagged gap: `CreatePullRequestRequest` has no field
 * identifying which GitHub repository to open a PR against, so a real
 * target must come from the Git integration's own `configuration` JSONB bag
 * — a typed `{ owner, repo }` shape nested under `configuration.github`,
 * matching this codebase's existing `credentialReference`-via-`Integration`
 * precedent rather than a new column. Absent (or partially configured)
 * means "no real GitHub target for this project" — the local provider stays
 * in effect, not an error, since not every project needs one.
 *
 * Shared by `run-development-agent-task.ts` (which also needs a real
 * `PullRequestProvider`) and `run-validation-task.ts` (DEVOS-108's own
 * finding: it clones the same Git integration's `repositoryPath` but had no
 * way to authenticate against a real, private GitHub remote — see
 * `resolveAuthenticatedCloneUrl` below).
 */
export function resolveGitHubRepositoryTarget(
  configuration: Record<string, unknown>,
): GitHubRepositoryTarget | undefined {
  const github = configuration.github;
  if (typeof github !== 'object' || github === null) return undefined;
  const owner = (github as Record<string, unknown>).owner;
  const repo = (github as Record<string, unknown>).repo;
  if (typeof owner !== 'string' || owner.trim().length === 0) return undefined;
  if (typeof repo !== 'string' || repo.trim().length === 0) return undefined;
  return { owner, repo };
}

/**
 * A real repo needs `git clone`/`git push`/`git fetch` themselves to
 * authenticate, not only the PR-creation REST call. Injects the resolved PAT
 * into `repositoryPath` itself (only when it's genuinely an `https:` URL — a
 * local filesystem path, as every existing test and any locally-staged
 * project uses, is returned unchanged, nothing to authenticate) — GitHub's
 * own supported pattern for scripted/non-interactive git access
 * (`https://x-access-token:<token>@github.com/...`), and the only option
 * that needs zero changes to the Git adapter (`runGit` and friends,
 * DEVOS-054), which has no per-call credential-injection seam today.
 * Accepted tradeoff: the token sits in that clone's `.git/config` in
 * plaintext for the life of the ephemeral workspace — mitigated by
 * `destroyWorkspace` always running in a `finally` block immediately after
 * the task completes, and by the PAT itself being fine-grained and
 * repo-scoped, not a broad credential. Never logged, and never placed into
 * the plain `repositoryPath` that flows into ToolInvocation/audit records.
 */
export function buildAuthenticatedCloneUrl(repositoryPath: string, token: string): string {
  let parsed: URL;
  try {
    parsed = new URL(repositoryPath);
  } catch {
    return repositoryPath;
  }
  if (parsed.protocol !== 'https:') return repositoryPath;
  parsed.username = 'x-access-token';
  parsed.password = token;
  return parsed.toString();
}

/**
 * Resolves the URL a real workspace should actually clone from: an
 * authenticated GitHub HTTPS URL when the Git integration configures a real
 * GitHub target (`configuration.github`), else `repositoryPath` unchanged.
 *
 * DEVOS-108 finding: `run-validation-task.ts` originally cloned straight
 * from the plain `repositoryPath` with no credential resolution at all — for
 * a real *private* GitHub repository (the pilot's own `devos-pilot-test`,
 * confirmed private via an unauthenticated GitHub API call returning 404)
 * that clone fails outright. `run-development-agent-task.ts` already solved
 * this for its own clone (`resolveGitHubContext`); this is that same logic,
 * factored out so both call sites share it instead of one silently drifting
 * from the other.
 */
export async function resolveAuthenticatedCloneUrl(
  credentialResolver: CredentialResolver | undefined,
  gitIntegration: { credentialReference: string; configuration: Record<string, unknown> },
  repositoryPath: string,
): Promise<string> {
  const target = resolveGitHubRepositoryTarget(gitIntegration.configuration);
  if (!target) return repositoryPath;

  if (!credentialResolver) {
    throw new Error(
      'Git integration configures a real GitHub target (configuration.github) but no credentialResolver is available to resolve its token.',
    );
  }
  const token = await credentialResolver.resolve(gitIntegration.credentialReference);
  if (token === null) {
    throw new Error(
      `Could not resolve a credential for reference "${gitIntegration.credentialReference}".`,
    );
  }

  return buildAuthenticatedCloneUrl(repositoryPath, token);
}
