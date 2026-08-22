import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Prompts are implementation assets — versioned and reviewed like code
 * (specs/architecture/repository-code-structure.md §42 "Agent Prompt
 * Repository": "Agent prompts are implementation assets. They must be
 * reviewed and versioned like code."), not a database-editable resource.
 * So unlike Agent/AgentVersion (DEVOS-025, genuinely dynamic, user-created
 * through the API), a prompt is a file in this package, and "creating a new
 * version" means adding a new file and committing it — the same workflow as
 * any other source change.
 *
 * A reference has the form "<role>/v<N>" (e.g. "requirements/v1"), resolved
 * to packages/agents/src/prompts/<role>/v<N>/system.md.
 */
export interface PromptRepository {
  resolve: (reference: string) => Promise<string>;
}

const REFERENCE_PATTERN = /^[a-z0-9-]+\/v[1-9]\d*$/;

export function createFilesystemPromptRepository(baseDir?: string): PromptRepository {
  // Prompt .md files are never compiled — they're read as plain text, so
  // they live only under src/ and are read from there even when this
  // module itself is running from dist/ (tsc doesn't copy non-.ts files).
  // Both dist/prompts/ and src/prompts/ sit one level under the package
  // root, so climbing up two levels from either and back down into
  // src/prompts finds the same real files in both dev and built mode.
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const root = baseDir ?? path.join(currentDir, '..', '..', 'src', 'prompts');

  return {
    async resolve(reference: string): Promise<string> {
      if (!REFERENCE_PATTERN.test(reference)) {
        throw new Error(
          `Invalid prompt reference "${reference}" — expected the form "<role>/v<N>" (e.g. "requirements/v1").`,
        );
      }

      const filePath = path.join(root, reference, 'system.md');
      try {
        return await readFile(filePath, 'utf8');
      } catch {
        throw new Error(`Prompt reference "${reference}" not found (expected ${filePath}).`);
      }
    },
  };
}
