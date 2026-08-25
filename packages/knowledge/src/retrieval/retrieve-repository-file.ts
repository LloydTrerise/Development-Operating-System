import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { RetrievedSource } from './retrieved-source.js';

const DEFAULT_MAX_BYTES = 100_000;

/**
 * A single file's content, size-bounded — "never an unbounded... copy"
 * (specs/architecture/system-context-engineering-knowledge.md §10) applies
 * per-file as much as to the repository as a whole. A file larger than
 * `maxBytes` is truncated, not rejected outright, with `truncated: true`
 * so the caller/agent can tell the content is partial rather than
 * mistaking it for the complete file.
 */
export async function retrieveRepositoryFile(
  repositoryPath: string,
  revision: string,
  relativeFilePath: string,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<RetrievedSource> {
  const fullPath = join(repositoryPath, relativeFilePath);
  const stats = await stat(fullPath);
  const buffer = await readFile(fullPath);
  const truncated = buffer.byteLength > maxBytes;
  const content = buffer.subarray(0, maxBytes).toString('utf8');

  return {
    type: 'REPOSITORY_FILE',
    ref: `repository-file:${revision}:${relativeFilePath}`,
    name: relativeFilePath,
    content: { path: relativeFilePath, content, truncated, sizeBytes: stats.size },
  };
}
