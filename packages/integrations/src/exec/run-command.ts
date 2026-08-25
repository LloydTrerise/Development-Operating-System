import { exec } from 'node:child_process';

export interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * DEVOS-062/063: the shared execution primitive behind the `build-run` and
 * `test-run` tool capabilities. Unlike `github.client.ts`'s `runGit` (a
 * fixed, code-controlled `execFile` argument array, never a shell), `command`
 * here is an arbitrary, free-form shell command string — build/test tooling
 * routinely needs shell features (`&&`, pipes, npm-style ` -- ` argument
 * forwarding) that a plain argv array can't express, and no spec names a
 * concrete build/test invocation contract to normalize against (see this
 * sprint's decision log). `command` must only ever come from a project's own
 * configured `Integration` row (an admin-controlled setting, the same trust
 * level as `repositoryPath`) — never from agent or model output, which is
 * never given tool authority directly (Constitution Principle 6/7).
 *
 * Deliberately does not reject on a non-zero exit code: unlike a `git`
 * command (where any non-zero exit is an infrastructure fault), a failing
 * build or test run is expected, meaningful data the caller must capture as
 * evidence, not an error to throw past. Only a genuine failure to spawn the
 * shell itself rejects.
 */
export async function runCommand(command: string, cwd: string): Promise<RunCommandResult> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') {
        reject(new Error(`Failed to run command "${command}": ${error.message}`));
        return;
      }
      resolve({ exitCode: error?.code ?? 0, stdout, stderr });
    });
  });
}
