import type { ProviderAdapter } from '@devos/tools';

export interface HttpHealthCheckProviderAdapterOptions {
  /** Injectable for tests — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * DEVOS-105: the real-target counterpart of `createHealthCheckProviderAdapter`
 * (DEVOS-075) — a deployment that resolves to a real `url` (e.g.
 * `createRenderDeploymentProvider`) has no local `deployedPath` to run a
 * shell command against, so "post-release health check" means a real HTTP
 * request to that URL instead. Registered under the same `'health-check'`
 * capability key as the local, command-based adapter — `performRelease`
 * (`run-release-task.ts`) selects one or the other per release based on
 * which kind of `DeploymentRecord` the deploy step actually returned, so no
 * capability/policy registration changes.
 *
 * Returns the same `exitCode`/`stdout`/`stderr` output shape as the
 * command-based adapter (`0` for a `2xx`/`3xx` response, `1` otherwise) so
 * `performRelease`'s existing `passed = healthCheckExitCode === 0` logic
 * works unchanged for either adapter.
 */
export function createHttpHealthCheckProviderAdapter(
  url: string,
  options: HttpHealthCheckProviderAdapterOptions = {},
): Record<string, ProviderAdapter> {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    'health-check': {
      async invoke() {
        try {
          const response = await fetchImpl(url);
          const bodyText = await response.text().catch(() => '');
          return {
            outputMetadata: {
              exitCode: response.ok ? 0 : 1,
              stdout: response.ok ? bodyText.slice(0, 2000) : '',
              stderr: response.ok ? '' : `${response.status} ${response.statusText}`,
            },
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown network error.';
          return {
            outputMetadata: {
              exitCode: 1,
              stdout: '',
              stderr: `Request to ${url} failed: ${message}`,
            },
          };
        }
      },
    },
  };
}
