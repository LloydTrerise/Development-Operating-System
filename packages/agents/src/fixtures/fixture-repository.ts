import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentUncertainty } from '@devos/contracts';

/**
 * A recorded real invocation of one agent (DEVOS-037) — the golden fixture
 * regression tests replay instead of calling the live provider on every
 * test run, per the same "unit tests against fakes/fixtures, live calls
 * reserved for deliberate verification" philosophy already established
 * across Sprint 1's test suite (see this file's sibling `refresh-
 * fixtures.ts` for the "deliberate verification" path that produces one).
 */
export interface AgentFixture {
  role: string;
  recordedAt: string;
  provider: string;
  modelRef: string;
  objective: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  uncertainty?: AgentUncertainty[];
}

/**
 * Fixtures are files, for the same reason prompts (DEVOS-028) and schemas
 * (DEVOS-029) are: implementation assets reviewed/versioned like code, not
 * a database-editable resource.
 *
 * A reference has the form "<name>-v<N>" (matching prompts'/schemas' own
 * convention), resolved to
 * packages/agents/src/fixtures/<name>/v<N>/fixture.json.
 */
export interface AgentFixtureRepository {
  resolve: (reference: string) => Promise<AgentFixture>;
}

const REFERENCE_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)-v([1-9]\d*)$/;

export function createFilesystemFixtureRepository(baseDir?: string): AgentFixtureRepository {
  // Fixture files are never compiled, so they're always read from src/,
  // even when this module itself is running from dist/ — same reasoning
  // as createFilesystemPromptRepository/createFilesystemSchemaRepository.
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const root = baseDir ?? path.join(currentDir, '..', '..', 'src', 'fixtures');

  return {
    async resolve(reference: string): Promise<AgentFixture> {
      const match = REFERENCE_PATTERN.exec(reference);
      if (!match) {
        throw new Error(
          `Invalid fixture reference "${reference}" — expected the form "<name>-v<N>" (e.g. "discovery-v1").`,
        );
      }
      const [, name, version] = match;

      const filePath = path.join(root, name!, `v${version}`, 'fixture.json');
      let raw: string;
      try {
        raw = await readFile(filePath, 'utf8');
      } catch {
        throw new Error(`Fixture reference "${reference}" not found (expected ${filePath}).`);
      }

      const parsed: unknown = JSON.parse(raw);
      return parsed as AgentFixture;
    },
  };
}
