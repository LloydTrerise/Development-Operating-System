import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DEFAULT_MAX_FILES = 200;

/**
 * Directories a repository-context walk should never descend into:
 * `.git` (internal metadata, not source content) and the common
 * build/dependency-output directories this monorepo itself already
 * excludes elsewhere (`node_modules`, `dist`, `.turbo`).
 */
const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', '.turbo']);

export interface RepositoryFileEntry {
  /** Relative to the repository root. */
  path: string;
  sizeBytes: number;
}

/**
 * A bounded, depth-first filesystem walk — never an unbounded
 * whole-repository dump (specs/architecture/system-context-engineering-knowledge.md
 * §10: "An agent working on implementation should generally receive
 * relevant repository information rather than an unbounded copy of the
 * entire repository"). No repository indexing technology or file chunking
 * strategy is built — §39 explicitly defers both — so this is exactly
 * what it looks like: a direct directory walk with a hard file-count cap.
 */
export async function listRepositoryFiles(
  repositoryPath: string,
  maxFiles = DEFAULT_MAX_FILES,
): Promise<RepositoryFileEntry[]> {
  const entries: RepositoryFileEntry[] = [];

  async function walk(directory: string): Promise<void> {
    if (entries.length >= maxFiles) return;
    const children = await readdir(directory, { withFileTypes: true });
    for (const child of children) {
      if (entries.length >= maxFiles) return;
      if (EXCLUDED_DIRECTORIES.has(child.name)) continue;

      const fullPath = join(directory, child.name);
      if (child.isDirectory()) {
        await walk(fullPath);
      } else if (child.isFile()) {
        const stats = await stat(fullPath);
        entries.push({ path: relative(repositoryPath, fullPath), sizeBytes: stats.size });
      }
    }
  }

  await walk(repositoryPath);
  return entries;
}
