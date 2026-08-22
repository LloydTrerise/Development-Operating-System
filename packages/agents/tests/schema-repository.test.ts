import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFilesystemSchemaRepository } from '../src/schemas/schema-repository.js';

describe('createFilesystemSchemaRepository', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'devos-schema-repo-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('resolves a versioned reference to its parsed schema', async () => {
    await mkdir(path.join(dir, 'prd', 'v1'), { recursive: true });
    await writeFile(
      path.join(dir, 'prd', 'v1', 'output-schema.json'),
      JSON.stringify({ name: 'prd', version: 1, fields: { title: { type: 'string' } } }),
      'utf8',
    );

    const repository = createFilesystemSchemaRepository(dir);
    const schema = await repository.resolve('prd-v1');

    expect(schema).toEqual({ name: 'prd', version: 1, fields: { title: { type: 'string' } } });
  });

  it('resolves the real built-in example schema using the default (no baseDir) root', async () => {
    const repository = createFilesystemSchemaRepository();
    const schema = await repository.resolve('example-v1');
    expect(schema.fields.summary).toEqual({ type: 'string' });
  });

  it('rejects a malformed reference before touching the filesystem', async () => {
    const repository = createFilesystemSchemaRepository(dir);
    await expect(repository.resolve('not_valid')).rejects.toThrow(
      'Invalid output schema reference',
    );
  });

  it('throws a clear error when the reference is well-formed but the file is missing', async () => {
    const repository = createFilesystemSchemaRepository(dir);
    await expect(repository.resolve('missing-v1')).rejects.toThrow('not found');
  });
});
