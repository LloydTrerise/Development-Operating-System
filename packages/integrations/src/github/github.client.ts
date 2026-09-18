import { execFile } from 'node:child_process';

export interface GitCommandResult {
  stdout: string;
  stderr: string;
}

/**
 * Provider SDKs/CLIs must remain inside integration/adapter packages
 * (specs/architecture/repository-code-structure.md §18) — this is the only
 * place in the codebase that shells out to `git`. Uses `execFile` (not
 * `exec`/`spawn` with `shell: true`) so arguments are never interpreted by
 * a shell, mirroring DEVOS-021's Windows-safe process-spawning precedent
 * (`tests/e2e`'s `EINVAL`/orphaned-process fix).
 *
 * DEVOS-108 finding: a `git clone`/`fetch`/`push` against a real remote that
 * cannot authenticate does not fail fast. Live-verified: a Git integration
 * pointed at a real *unauthenticated* clone URL hung a real `TOOL_TASK` for
 * 5+ minutes with no error anywhere, until the underlying process tree was
 * killed by hand. The actual leaf process was `git-credential-manager get`
 * — on Windows, git's default `credential.helper` — waiting for a GUI
 * credential prompt nothing in a headless worker process can ever answer.
 * `GIT_TERMINAL_PROMPT=0` alone did *not* fix this (confirmed by direct
 * testing: it only disables git's own built-in terminal prompt, not an
 * externally configured credential helper); the fix must also disable the
 * helper itself for these programmatic invocations via `-c
 * credential.helper=` (an empty value clears it), so an unauthenticatable
 * remote fails immediately with an ordinary git error instead of ever
 * reaching a helper that can hang. Kept together as defense-in-depth: with
 * no helper configured (a bare `git` install, or one deliberately using
 * git's own terminal prompt), `GIT_TERMINAL_PROMPT=0` still stops that
 * fallback too.
 */
export async function runGit(args: string[], cwd: string): Promise<GitCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-c', 'credential.helper=', ...args],
      { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`git ${args.join(' ')} failed: ${stderr.trim() || error.message}`));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}
