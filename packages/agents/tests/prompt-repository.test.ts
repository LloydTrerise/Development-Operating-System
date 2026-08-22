import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFilesystemPromptRepository } from '../src/prompts/prompt-repository.js';

describe('createFilesystemPromptRepository', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'devos-prompt-repo-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('resolves a versioned reference to its file content', async () => {
    await mkdir(path.join(dir, 'requirements', 'v1'), { recursive: true });
    await writeFile(path.join(dir, 'requirements', 'v1', 'system.md'), 'Be precise.', 'utf8');

    const repository = createFilesystemPromptRepository(dir);
    const text = await repository.resolve('requirements/v1');

    expect(text).toBe('Be precise.');
  });

  it('resolves the real built-in example prompt using the default (no baseDir) root', async () => {
    const repository = createFilesystemPromptRepository();
    const text = await repository.resolve('example/v1');
    expect(text).toContain('DEVOS-028');
  });

  it('rejects a malformed reference before touching the filesystem', async () => {
    const repository = createFilesystemPromptRepository(dir);
    await expect(repository.resolve('not-a-valid-reference')).rejects.toThrow(
      'Invalid prompt reference',
    );
  });

  it('throws a clear error when the reference is well-formed but the file is missing', async () => {
    const repository = createFilesystemPromptRepository(dir);
    await expect(repository.resolve('missing-role/v1')).rejects.toThrow('not found');
  });
});
