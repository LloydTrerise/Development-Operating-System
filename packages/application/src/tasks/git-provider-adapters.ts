import type { DevelopmentWorkspace } from '@devos/integrations';
import { createBranch, createCommit, pushBranch, writeFileChange } from '@devos/integrations';
import type { ProviderAdapter } from '@devos/tools';

/**
 * Wires DEVOS-054's Git adapter into DEVOS-052's `ProviderAdapter` shape —
 * closing the gap DEVOS-054's own decision log deliberately deferred
 * ("No wiring into packages/tools's ProviderAdapter interface yet...
 * deferred to whichever later task (likely DEVOS-057) actually composes
 * it"). Lives here, in `packages/application`, rather than in
 * `packages/tools` or `packages/integrations`, because it needs both
 * packages' types and neither package may depend on the other.
 *
 * One branch is created once per workspace, on the first `repo-write`
 * call — every subsequent write and the final `git-commit` reuse it,
 * matching how a single development task proposes one branch worth of
 * changes.
 */
export function createGitProviderAdapters(
  workspace: DevelopmentWorkspace,
): Record<string, ProviderAdapter> {
  const gitWorkspace = { repositoryPath: workspace.path };
  let branchCreated = false;

  return {
    'repo-write': {
      async invoke(_target, parameters) {
        const branch = String(parameters.branch);
        const path = String(parameters.path);
        const content = String(parameters.content);

        if (!branchCreated) {
          await createBranch(gitWorkspace, branch);
          branchCreated = true;
        }

        await writeFileChange(gitWorkspace, path, content);
        return { outputMetadata: { path } };
      },
    },
    'git-commit': {
      async invoke(_target, parameters) {
        const branch = String(parameters.branch);
        const message = String(parameters.message);
        const commitSha = await createCommit(gitWorkspace, message);
        // The workspace is ephemeral (destroyed once this task completes)
        // — without pushing, the commit would otherwise vanish with it.
        // See github.adapter.ts's `pushBranch` doc comment.
        await pushBranch(gitWorkspace, branch);
        return { outputMetadata: { commitSha }, providerReference: commitSha };
      },
    },
  };
}
