import type { PullRequestProvider } from '@devos/integrations';
import type { ProviderAdapter } from '@devos/tools';

/**
 * Wires a `PullRequestProvider` (DEVOS-058) into DEVOS-052's
 * `ProviderAdapter` shape for the `pull-request-create` capability —
 * lives here, not in `packages/integrations` or `packages/tools`, for the
 * same package-boundary reason as `createGitProviderAdapters` (DEVOS-057):
 * it needs both packages' types, and neither package may depend on the
 * other.
 *
 * `ProviderAdapter.invoke` only receives `(target, parameters)`, not the
 * invocation's own `idempotencyKey` (DEVOS-052's own signature) — the
 * caller is expected to also place it in `parameters.idempotencyKey` for
 * capabilities, like this one, whose provider needs to see it.
 */
export function createPullRequestProviderAdapter(
  provider: PullRequestProvider,
): Record<string, ProviderAdapter> {
  return {
    'pull-request-create': {
      async invoke(_target, parameters) {
        const record = await provider.createPullRequest({
          sourceBranch: String(parameters.sourceBranch),
          targetBranch: String(parameters.targetBranch),
          title: String(parameters.title),
          ...(parameters.description !== undefined
            ? { description: String(parameters.description) }
            : {}),
          idempotencyKey: String(parameters.idempotencyKey),
        });

        return {
          outputMetadata: { pullRequestReference: record.id, url: record.url },
          providerReference: record.id,
        };
      },
    },
  };
}
