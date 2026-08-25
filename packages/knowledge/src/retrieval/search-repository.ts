import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listRepositoryFiles } from './list-repository-files.js';
import type { RetrievedSource } from './retrieved-source.js';

const DEFAULT_MAX_MATCHES = 50;

export interface RepositorySearchMatch {
  path: string;
  line: number;
  text: string;
}

/**
 * "This document does not decide: ... repository indexing technology;
 * file chunking strategy; retrieval algorithms"
 * (specs/architecture/system-context-engineering-knowledge.md §39) — no
 * vector search, embeddings, or indexing infrastructure is built. This is
 * a direct substring search over the same bounded file listing
 * `retrieveRepositoryListing` uses, an explicit implementation choice, not
 * a spec derivation. Unreadable files (binaries, permission errors) are
 * skipped rather than surfaced as search failures.
 */
export async function searchRepository(
  repositoryPath: string,
  revision: string,
  pattern: string,
  maxMatches = DEFAULT_MAX_MATCHES,
): Promise<RetrievedSource> {
  const files = await listRepositoryFiles(repositoryPath);
  const matches: RepositorySearchMatch[] = [];

  for (const file of files) {
    if (matches.length >= maxMatches) break;

    let content: string;
    try {
      content = await readFile(join(repositoryPath, file.path), 'utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      if (matches.length >= maxMatches) break;
      const line = lines[lineIndex] ?? '';
      if (line.includes(pattern)) {
        matches.push({ path: file.path, line: lineIndex + 1, text: line });
      }
    }
  }

  return {
    type: 'REPOSITORY_SEARCH_RESULT',
    ref: `repository-search:${revision}:${pattern}`,
    name: `Search: "${pattern}"`,
    content: { revision, pattern, matches },
  };
}
