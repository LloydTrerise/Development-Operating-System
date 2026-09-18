import type { DeploymentProvider } from '@devos/integrations';
import { ValidationError } from '@devos/domain';
import type { ProviderAdapter } from '@devos/tools';

/**
 * DEVOS-074: wires `@devos/integrations`'s `DeploymentProvider` into
 * DEVOS-052's `ProviderAdapter` shape for the `deploy` capability —
 * mirroring `command-provider-adapters.ts`'s "adapt one real provider
 * into the gateway's `invoke(target, parameters)` shape" pattern, but
 * unlike that one, `target` is actually read here: `deploy` has no
 * pre-existing workspace to close over (each deployment is its own fresh
 * checkout, not a continuation of a development task's ephemeral
 * workspace), so `repositoryPath`/`environment` travel in `target` exactly
 * as DEVOS-072's Tool-Gateway wiring already expects for policy evaluation.
 */
export function createDeploymentProviderAdapters(
  provider: DeploymentProvider,
): Record<string, ProviderAdapter> {
  return {
    deploy: {
      async invoke(target, parameters) {
        // DEVOS-105: repositoryPath is local-filesystem semantics, required
        // only by createLocalStagingDeploymentProvider (which validates it
        // itself) — this adapter stays provider-agnostic and passes it
        // through only when present, rather than assuming every
        // DeploymentProvider needs one.
        const repositoryPath = target.repositoryPath;
        const environment = target.environment;
        const revision = parameters.revision;
        if (repositoryPath !== undefined && typeof repositoryPath !== 'string') {
          throw new ValidationError('deploy target.repositoryPath must be a string when provided.');
        }
        if (typeof environment !== 'string' || environment.trim().length === 0) {
          throw new ValidationError('deploy target.environment must be a non-empty string.');
        }
        if (typeof revision !== 'string' || revision.trim().length === 0) {
          throw new ValidationError('deploy parameters.revision must be a non-empty string.');
        }

        const record = await provider.deploy({
          ...(repositoryPath !== undefined ? { repositoryPath } : {}),
          environment,
          revision,
        });

        return {
          outputMetadata: {
            deploymentId: record.id,
            revision: record.revision,
            ...(record.deployedPath !== undefined ? { deployedPath: record.deployedPath } : {}),
            ...(record.url !== undefined ? { url: record.url } : {}),
          },
          providerReference: record.id,
        };
      },
    },
  };
}
