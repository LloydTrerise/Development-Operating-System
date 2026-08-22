import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ArtifactStorage } from './artifact-storage.js';

const URI_SCHEME = 'local-fs://';

/**
 * Content-addressed local filesystem storage — no object-storage technology
 * has been chosen anywhere in the repo (specs/technical/poc-technical-implementation.md
 * §49 lists "cloud/container platform" as an open decision). Swappable for a
 * real object-storage adapter later behind the same ArtifactStorage port.
 */
export function createLocalFilesystemStorage(baseDir: string): ArtifactStorage {
  function pathForHash(hash: string): string {
    return path.join(baseDir, hash.slice(0, 2), hash.slice(2));
  }

  return {
    // contentType is part of the ArtifactStorage contract for adapters that
    // need it (e.g. an S3 adapter setting a Content-Type header) — this
    // content-addressed local adapter doesn't need it.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async put(content, contentType) {
      const hash = createHash('sha256').update(content).digest('hex');
      const filePath = pathForHash(hash);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, 'utf8');
      return { uri: `${URI_SCHEME}${hash}`, hash };
    },

    async get(uri) {
      if (!uri.startsWith(URI_SCHEME)) {
        throw new Error(`Unrecognized artifact storage URI: ${uri}`);
      }
      const hash = uri.slice(URI_SCHEME.length);
      return readFile(pathForHash(hash), 'utf8');
    },
  };
}
