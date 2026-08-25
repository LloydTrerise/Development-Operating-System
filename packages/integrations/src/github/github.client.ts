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
 */
export async function runGit(args: string[], cwd: string): Promise<GitCommandResult> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`git ${args.join(' ')} failed: ${stderr.trim() || error.message}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
