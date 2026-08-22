import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFilesystemFixtureRepository } from '../src/fixtures/fixture-repository.js';

describe('createFilesystemFixtureRepository', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'devos-fixture-repo-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('resolves a versioned reference to its parsed fixture', async () => {
    await mkdir(path.join(dir, 'discovery', 'v1'), { recursive: true });
    await writeFile(
      path.join(dir, 'discovery', 'v1', 'fixture.json'),
      JSON.stringify({
        role: 'DISCOVERY',
        recordedAt: '2026-01-01T00:00:00.000Z',
        provider: 'gemini',
        modelRef: 'gemini-3.6-flash',
        objective: 'x',
        input: {},
        result: { summary: 'a fixture summary', findings: [] },
      }),
      'utf8',
    );

    const repository = createFilesystemFixtureRepository(dir);
    const fixture = await repository.resolve('discovery-v1');

    expect(fixture.role).toBe('DISCOVERY');
    expect(fixture.result).toEqual({ summary: 'a fixture summary', findings: [] });
  });

  it('resolves the four real recorded planning-path fixtures using the default (no baseDir) root', async () => {
    const repository = createFilesystemFixtureRepository();

    for (const [reference, role] of [
      ['discovery-v1', 'DISCOVERY'],
      ['requirements-v1', 'REQUIREMENTS'],
      ['technical-design-v1', 'TECHNICAL_DESIGN'],
      ['planning-v1', 'PLANNING'],
    ] as const) {
      const fixture = await repository.resolve(reference);
      expect(fixture.role).toBe(role);
      expect(fixture.provider).toBe('gemini');
      expect(typeof fixture.result.summary).toBe('string');
    }
  });

  it('rejects a malformed reference before touching the filesystem', async () => {
    const repository = createFilesystemFixtureRepository(dir);
    await expect(repository.resolve('not_valid')).rejects.toThrow('Invalid fixture reference');
  });

  it('throws a clear error when the reference is well-formed but the file is missing', async () => {
    const repository = createFilesystemFixtureRepository(dir);
    await expect(repository.resolve('missing-v1')).rejects.toThrow('not found');
  });
});
