import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A minimal, DevOS-specific structural schema — NOT full JSON Schema.
 * Sprint 2's actual need is "does this output have the expected top-level
 * fields with the expected primitive types," and this codebase's
 * established idiom for structural validation is a small hand-rolled
 * checker returning {field, message} issues (see
 * packages/domain/src/workflows/validation.ts's validateWorkflowGraph) —
 * not a schema-library dependency. Extended here rather than reinvented.
 */
export type OutputFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface OutputSchemaField {
  type: OutputFieldType;
  /** Defaults to true — most fields in a generated artifact are expected to be present. */
  required?: boolean;
}

export interface OutputSchema {
  name: string;
  version: number;
  fields: Record<string, OutputSchemaField>;
}

/**
 * Schemas are files, for the same reason prompts are (DEVOS-028): they're
 * implementation assets defining an agent's output contract, reviewed and
 * versioned like code, not a database-editable resource.
 *
 * A reference has the form "<name>-v<N>" (e.g. "prd-v1" — matching the
 * literal example in specs/api/poc-api-contracts.md §21's Agent Definition
 * Contract), resolved to
 * packages/agents/src/schemas/<name>/v<N>/output-schema.json.
 */
export interface SchemaRepository {
  resolve: (reference: string) => Promise<OutputSchema>;
}

const REFERENCE_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)-v([1-9]\d*)$/;

export function createFilesystemSchemaRepository(baseDir?: string): SchemaRepository {
  // Same reasoning as createFilesystemPromptRepository: these files are
  // never compiled, so they're always read from src/, even when this
  // module itself is running from dist/.
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const root = baseDir ?? path.join(currentDir, '..', '..', 'src', 'schemas');

  return {
    async resolve(reference: string): Promise<OutputSchema> {
      const match = REFERENCE_PATTERN.exec(reference);
      if (!match) {
        throw new Error(
          `Invalid output schema reference "${reference}" — expected the form "<name>-v<N>" (e.g. "prd-v1").`,
        );
      }
      const [, name, version] = match;

      const filePath = path.join(root, name!, `v${version}`, 'output-schema.json');
      let raw: string;
      try {
        raw = await readFile(filePath, 'utf8');
      } catch {
        throw new Error(`Output schema reference "${reference}" not found (expected ${filePath}).`);
      }

      const parsed: unknown = JSON.parse(raw);
      return parsed as OutputSchema;
    },
  };
}
