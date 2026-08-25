import { randomUUID } from 'node:crypto';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WorkflowTaskId } from '@devos/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runGit } from '../src/github/github.client.js';
import {
  createWorkspace,
  destroyWorkspace,
  withWorkspace,
} from '../src/workspace/development-workspace.js';

describe('development workspace (real local git repository)', () => {
  let sourceRepositoryPath: string;

  beforeEach(async () => {
    sourceRepositoryPath = await mkdtemp(join(tmpdir(), 'devos-workspace-source-'));
    await runGit(['init'], sourceRepositoryPath);
    await runGit(['config', 'user.email', 'devos-test@example.com'], sourceRepositoryPath);
    await runGit(['config', 'user.name', 'DevOS Test'], sourceRepositoryPath);
    await writeFile(join(sourceRepositoryPath, 'README.md'), '# source repo\n', 'utf8');
    await runGit(['add', 'README.md'], sourceRepositoryPath);
    await runGit(['commit', '-m', 'initial commit'], sourceRepositoryPath);
  });

  afterEach(async () => {
    await rm(sourceRepositoryPath, { recursive: true, force: true });
  });

  it('creates a workspace containing only the checked-out repository content', async () => {
    const workflowTaskId = randomUUID() as WorkflowTaskId;
    const workspace = await createWorkspace(workflowTaskId, sourceRepositoryPath);

    try {
      expect(workspace.workflowTaskId).toBe(workflowTaskId);
      await expect(access(join(workspace.path, 'README.md'))).resolves.toBeUndefined();
    } finally {
      await destroyWorkspace(workspace);
    }
  });

  it('reliably removes the workspace directory on destroy', async () => {
    const workflowTaskId = randomUUID() as WorkflowTaskId;
    const workspace = await createWorkspace(workflowTaskId, sourceRepositoryPath);

    await destroyWorkspace(workspace);

    await expect(access(workspace.path)).rejects.toThrow();
  });

  it('scopes two workspaces for two different tasks to separate, non-interfering directories', async () => {
    const workspaceA = await createWorkspace(randomUUID() as WorkflowTaskId, sourceRepositoryPath);
    const workspaceB = await createWorkspace(randomUUID() as WorkflowTaskId, sourceRepositoryPath);

    try {
      expect(workspaceA.path).not.toBe(workspaceB.path);
      await writeFile(join(workspaceA.path, 'only-in-a.txt'), 'a', 'utf8');
      await expect(access(join(workspaceB.path, 'only-in-a.txt'))).rejects.toThrow();
    } finally {
      await destroyWorkspace(workspaceA);
      await destroyWorkspace(workspaceB);
    }
  });

  it('withWorkspace cleans up even when the callback succeeds', async () => {
    let capturedPath = '';
    const result = await withWorkspace(
      randomUUID() as WorkflowTaskId,
      sourceRepositoryPath,
      async (workspace) => {
        capturedPath = workspace.path;
        return 'ok';
      },
    );

    expect(result).toBe('ok');
    await expect(access(capturedPath)).rejects.toThrow();
  });

  it('withWorkspace cleans up even when the callback throws', async () => {
    let capturedPath = '';

    await expect(
      withWorkspace(randomUUID() as WorkflowTaskId, sourceRepositoryPath, async (workspace) => {
        capturedPath = workspace.path;
        throw new Error('development task failed');
      }),
    ).rejects.toThrow('development task failed');

    await expect(access(capturedPath)).rejects.toThrow();
  });
});
