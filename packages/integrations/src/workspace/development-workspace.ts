import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WorkflowTaskId } from '@devos/contracts';
import { cloneRepository } from '../github/github.adapter.js';

/**
 * An ephemeral, authorised development workspace. This is the sprint's
 * thinnest task by its own spec: "workspace" appears in the spec corpus
 * exactly once, as a negative constraint ("Development agent workspaces
 * must not contain unrelated credentials",
 * specs/architecture/repository-code-structure.md §47) — no entity,
 * table, lifecycle state machine, or isolation mechanism (container, VM,
 * git worktree) is specified anywhere. Every choice below is an
 * implementation-level assumption, not a spec derivation: a workspace is a
 * temporary local directory, scoped one-per-development-task, populated by
 * cloning the target repository via DEVOS-054's Git adapter, mirroring
 * this codebase's existing `mkdtemp`/`rm` temp-directory pattern
 * (`@devos/storage`, `tests/e2e/*.test.ts`) rather than a heavier
 * container-based isolation mechanism.
 */
export interface DevelopmentWorkspace {
  workflowTaskId: WorkflowTaskId;
  path: string;
}

/**
 * Creates a workspace scoped to a single development task by cloning
 * `repositoryUrlOrPath` into a fresh, uniquely-named temp directory. Takes
 * no credential resolver and reads no secret material — "must not contain
 * unrelated credentials" is satisfied by construction, not by a runtime
 * check, since nothing here ever writes a credential into the workspace.
 */
export async function createWorkspace(
  workflowTaskId: WorkflowTaskId,
  repositoryUrlOrPath: string,
): Promise<DevelopmentWorkspace> {
  const path = await mkdtemp(join(tmpdir(), `devos-workspace-${workflowTaskId}-`));
  await cloneRepository(repositoryUrlOrPath, path);
  return { workflowTaskId, path };
}

export async function destroyWorkspace(workspace: DevelopmentWorkspace): Promise<void> {
  await rm(workspace.path, { recursive: true, force: true });
}

/**
 * Guarantees cleanup regardless of outcome — "reliably cleaned up whether
 * the task succeeds or fails" is enforced mechanically via `finally`, not
 * left to every caller to remember.
 */
export async function withWorkspace<T>(
  workflowTaskId: WorkflowTaskId,
  repositoryUrlOrPath: string,
  fn: (workspace: DevelopmentWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await createWorkspace(workflowTaskId, repositoryUrlOrPath);
  try {
    return await fn(workspace);
  } finally {
    await destroyWorkspace(workspace);
  }
}
