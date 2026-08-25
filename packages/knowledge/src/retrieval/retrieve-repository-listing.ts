import { listRepositoryFiles } from './list-repository-files.js';
import type { RetrievedSource } from './retrieved-source.js';

/**
 * "Repository context should normally be tied to a specific revision...
 * where reproducibility requires it" (specs/architecture/system-context-engineering-knowledge.md
 * §28; Domain Invariant §37.9). `revision` is an opaque caller-supplied
 * string (a commit SHA, typically) — this function has no `git` dependency
 * of its own; obtaining the revision is the caller's job (DEVOS-054's Git
 * adapter), keeping `@devos/knowledge` decoupled from `@devos/integrations`.
 */
export async function retrieveRepositoryListing(
  repositoryPath: string,
  revision: string,
  maxFiles?: number,
): Promise<RetrievedSource> {
  const files = await listRepositoryFiles(repositoryPath, maxFiles);

  return {
    type: 'REPOSITORY_LISTING',
    ref: `repository-listing:${revision}`,
    name: 'Repository file listing',
    content: { revision, files },
  };
}
