import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLocalFilesystemStorage } from '../src/local-filesystem-storage.js';

describe('local filesystem artifact storage', () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(tmpdir(), 'devos-artifact-storage-'));
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('stores content addressed by its SHA-256 hash', async () => {
    const storage = createLocalFilesystemStorage(baseDir);
    const content = JSON.stringify({ hello: 'world' });

    const result = await storage.put(content, 'application/json');

    const expectedHash = createHash('sha256').update(content).digest('hex');
    expect(result.hash).toBe(expectedHash);
    expect(result.uri).toBe(`local-fs://${expectedHash}`);
  });

  it('retrieves previously stored content by uri', async () => {
    const storage = createLocalFilesystemStorage(baseDir);
    const content = 'hello, artifact';

    const { uri } = await storage.put(content, 'text/plain');
    const retrieved = await storage.get(uri);

    expect(retrieved).toBe(content);
  });

  it('deduplicates identical content under the same hash', async () => {
    const storage = createLocalFilesystemStorage(baseDir);
    const content = 'duplicate content';

    const first = await storage.put(content, 'text/plain');
    const second = await storage.put(content, 'text/plain');

    expect(first.uri).toBe(second.uri);
  });

  it('rejects a uri with an unrecognized scheme', async () => {
    const storage = createLocalFilesystemStorage(baseDir);
    await expect(storage.get('s3://bucket/key')).rejects.toThrow('Unrecognized');
  });
});
