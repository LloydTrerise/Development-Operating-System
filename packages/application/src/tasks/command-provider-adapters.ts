import type { DevelopmentWorkspace } from '@devos/integrations';
import { runCommand } from '@devos/integrations';
import type { ProviderAdapter } from '@devos/tools';

/**
 * DEVOS-062/063: wires `@devos/integrations`'s `runCommand` into DEVOS-052's
 * `ProviderAdapter` shape for the `build-run`/`test-run` capabilities —
 * mirroring `git-provider-adapters.ts`'s exact pattern (a real workspace
 * closed over by the factory, `target` unused since the workspace already
 * carries the repository path). One provider adapter serves both
 * capabilities, since they differ only in which configured command runs,
 * not in how it runs.
 *
 * Unlike `git-commit`'s adapter, a non-zero exit code is not a thrown
 * error — the capability's own output schema (`exitCode`/`stdout`/`stderr`)
 * exists precisely so a failing build/test is captured as `SUCCEEDED` tool
 * output (the *invocation* succeeded at running the command; the command's
 * own result is data for the caller — DEVOS-064's validation task handler —
 * to interpret).
 */
export function createCommandProviderAdapters(
  workspace: DevelopmentWorkspace,
): Record<string, ProviderAdapter> {
  const invoke = async (
    _target: Record<string, unknown>,
    parameters: Record<string, unknown>,
  ): Promise<{ outputMetadata: Record<string, unknown> }> => {
    const command = String(parameters.command);
    const result = await runCommand(command, workspace.path);
    return {
      outputMetadata: {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      },
    };
  };

  return {
    'build-run': { invoke },
    'test-run': { invoke },
    // DEVOS-113: identical mechanics — a project-configured command run in
    // the same workspace — so it reuses the exact same adapter.
    'security-scan': { invoke },
  };
}
