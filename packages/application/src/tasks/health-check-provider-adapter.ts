import { runCommand } from '@devos/integrations';
import type { ProviderAdapter } from '@devos/tools';

/**
 * DEVOS-075: wires `@devos/integrations`'s `runCommand` into DEVOS-052's
 * `ProviderAdapter` shape for the `health-check` capability — mirrors
 * `command-provider-adapters.ts`'s exact "adapt runCommand, non-zero exit
 * is data not a thrown error" pattern, but closes over a bare deployed
 * directory path (DEVOS-074's `DeploymentRecord.deployedPath`) rather than
 * a `DevelopmentWorkspace`, since a deployment target isn't an ephemeral
 * development workspace.
 */
export function createHealthCheckProviderAdapter(
  deployedPath: string,
): Record<string, ProviderAdapter> {
  return {
    'health-check': {
      async invoke(_target, parameters) {
        const command = String(parameters.command);
        const result = await runCommand(command, deployedPath);
        return {
          outputMetadata: {
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
          },
        };
      },
    },
  };
}
