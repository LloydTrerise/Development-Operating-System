import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listRepositoryFiles } from '../src/retrieval/list-repository-files.js';
import { retrieveRepositoryFile } from '../src/retrieval/retrieve-repository-file.js';
import { retrieveRepositoryListing } from '../src/retrieval/retrieve-repository-listing.js';
import { searchRepository } from '../src/retrieval/search-repository.js';

const FAKE_REVISION = 'deadbeefcafe';

describe('repository context retrieval', () => {
  let repositoryPath: string;

  beforeEach(async () => {
    repositoryPath = await mkdtemp(join(tmpdir(), 'devos-repo-context-'));
    await writeFile(join(repositoryPath, 'README.md'), 'hello devos\n', 'utf8');
    await mkdir(join(repositoryPath, 'src'), { recursive: true });
    await writeFile(join(repositoryPath, 'src', 'index.ts'), 'export const answer = 42;\n', 'utf8');
    // Directories a real listing must never descend into.
    await mkdir(join(repositoryPath, '.git'), { recursive: true });
    await writeFile(join(repositoryPath, '.git', 'HEAD'), 'ref: refs/heads/main\n', 'utf8');
    await mkdir(join(repositoryPath, 'node_modules', 'some-dep'), { recursive: true });
    await writeFile(
      join(repositoryPath, 'node_modules', 'some-dep', 'index.js'),
      '// should never appear\n',
      'utf8',
    );
  });

  afterEach(async () => {
    await rm(repositoryPath, { recursive: true, force: true });
  });

  it('lists repository files, excluding .git and node_modules', async () => {
    const files = await listRepositoryFiles(repositoryPath);
    const paths = files.map((f) => f.path.replace(/\\/g, '/'));

    expect(paths).toContain('README.md');
    expect(paths).toContain('src/index.ts');
    expect(paths.some((p) => p.startsWith('.git'))).toBe(false);
    expect(paths.some((p) => p.startsWith('node_modules'))).toBe(false);
  });

  it('caps the listing at maxFiles, never dumping the whole repository', async () => {
    const files = await listRepositoryFiles(repositoryPath, 1);
    expect(files).toHaveLength(1);
  });

  it('wraps the listing as a RetrievedSource tied to the given revision', async () => {
    const source = await retrieveRepositoryListing(repositoryPath, FAKE_REVISION);

    expect(source.type).toBe('REPOSITORY_LISTING');
    expect(source.ref).toBe(`repository-listing:${FAKE_REVISION}`);
    expect((source.content as { revision: string }).revision).toBe(FAKE_REVISION);
  });

  it('reads a single file bounded by size, marking truncation when exceeded', async () => {
    const full = await retrieveRepositoryFile(repositoryPath, FAKE_REVISION, 'README.md');
    const fullContent = full.content as { content: string; truncated: boolean; sizeBytes: number };
    expect(fullContent.content).toBe('hello devos\n');
    expect(fullContent.truncated).toBe(false);

    const truncated = await retrieveRepositoryFile(repositoryPath, FAKE_REVISION, 'README.md', 5);
    const truncatedContent = truncated.content as { content: string; truncated: boolean };
    expect(truncatedContent.truncated).toBe(true);
    expect(truncatedContent.content.length).toBe(5);
  });

  it('searches file contents for a plain substring, skipping unreadable files', async () => {
    const source = await searchRepository(repositoryPath, FAKE_REVISION, 'answer');
    const { matches } = source.content as {
      matches: { path: string; line: number; text: string }[];
    };

    expect(matches).toHaveLength(1);
    expect(matches[0]?.path.replace(/\\/g, '/')).toBe('src/index.ts');
    expect(matches[0]?.text).toContain('answer');
  });

  it('caps search results at maxMatches', async () => {
    for (let i = 0; i < 5; i++) {
      await writeFile(join(repositoryPath, `match-${i}.txt`), 'needle\n', 'utf8');
    }

    const source = await searchRepository(repositoryPath, FAKE_REVISION, 'needle', 2);
    const { matches } = source.content as { matches: unknown[] };
    expect(matches).toHaveLength(2);
  });
});
