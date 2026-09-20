import { retrieveRepositoryFile } from './retrieve-repository-file.js';
import { retrieveRepositoryListing } from './retrieve-repository-listing.js';
import type { RepositorySearchMatch } from './search-repository.js';
import { searchRepository } from './search-repository.js';
import type { RetrievedSource } from './retrieved-source.js';

const DEFAULT_MAX_TERMS = 5;
const DEFAULT_MAX_MATCHES_PER_TERM = 10;
const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_FILE_BYTES = 20_000;

export interface RelevantRepositoryContextOptions {
  maxTerms?: number;
  maxMatchesPerTerm?: number;
  maxFiles?: number;
  maxFileBytes?: number;
}

export interface RelevantRepositoryContext {
  listing: RetrievedSource;
  searchResult?: RetrievedSource;
  files: RetrievedSource[];
}

/**
 * DEVOS-192 — the real, first-ever caller of `searchRepository`/
 * `retrieveRepositoryFile` (dead code since their own introduction; see
 * `specs/DEVOS-KNOWLEDGE-PLATFORM-BACKLOG.md` §9 and
 * `specs/sprints/sprint-26/README.md`'s own grounding). Composes all three
 * previously-standalone retrieval functions into one deterministic
 * pipeline, mirroring how `buildContext()` itself composes this package's
 * other retrieval functions.
 *
 * `query` is expected to be a plan's own free-text summary — there is no
 * structured field anywhere that names specific files a change should
 * touch (`IMPLEMENTATION_PLAN`'s schema has only `summary`/`tasks: array`),
 * so this derives plain keyword terms from it and searches for them, the
 * same "real keyword relevance, never semantic" discipline DEVOS-187
 * already established for `KnowledgeSource` retrieval — applied here to
 * repository content instead. A missing/empty query, or a query that
 * matches nothing, returns just the real listing — the same information
 * every caller already had before this function existed, now sourced from
 * the real function instead of a hand-rolled ref.
 *
 * Bounded on every axis (`system-context-engineering-knowledge.md` §10:
 * never an unbounded repository dump): capped distinct terms, capped
 * matches per term, capped distinct files, capped bytes per file.
 */
export async function retrieveRelevantRepositoryContext(
  repositoryPath: string,
  revision: string,
  query?: string,
  options: RelevantRepositoryContextOptions = {},
): Promise<RelevantRepositoryContext> {
  const listing = await retrieveRepositoryListing(repositoryPath, revision);

  const trimmedQuery = query?.trim();
  if (!trimmedQuery) return { listing, files: [] };

  const maxTerms = options.maxTerms ?? DEFAULT_MAX_TERMS;
  const terms = [...new Set(trimmedQuery.toLowerCase().split(/\s+/).filter((t) => t.length > 3))].slice(
    0,
    maxTerms,
  );
  if (terms.length === 0) return { listing, files: [] };

  const maxMatchesPerTerm = options.maxMatchesPerTerm ?? DEFAULT_MAX_MATCHES_PER_TERM;
  const allMatches: RepositorySearchMatch[] = [];
  for (const term of terms) {
    const result = await searchRepository(repositoryPath, revision, term, maxMatchesPerTerm);
    allMatches.push(...(result.content as { matches: RepositorySearchMatch[] }).matches);
  }
  if (allMatches.length === 0) return { listing, files: [] };

  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const matchedPaths = [...new Set(allMatches.map((match) => match.path))].slice(0, maxFiles);

  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const files: RetrievedSource[] = [];
  for (const path of matchedPaths) {
    try {
      files.push(await retrieveRepositoryFile(repositoryPath, revision, path, maxFileBytes));
    } catch {
      // A matched path that can no longer be read (e.g. deleted between
      // search and fetch) is skipped, not a task failure.
    }
  }

  const searchResult: RetrievedSource = {
    type: 'REPOSITORY_SEARCH_RESULT',
    ref: `repository-search:${revision}:${terms.join(',')}`,
    name: `Search: ${terms.join(', ')}`,
    content: { revision, terms, matches: allMatches },
  };

  return { listing, searchResult, files };
}
