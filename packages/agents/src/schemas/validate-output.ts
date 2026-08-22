import type { OutputSchema, OutputSchemaField } from './schema-repository.js';

export interface OutputValidationIssue {
  field: string;
  message: string;
}

function typeOf(value: unknown): OutputSchemaField['type'] | 'null' | 'undefined' {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'object') return t;
  return 'undefined';
}

/**
 * Structural validation only (field presence + primitive/array/object
 * type) — see schema-repository.ts's doc comment for why this isn't full
 * JSON Schema. Mirrors validateWorkflowGraph's {field, message} issue
 * shape for consistency with this codebase's one other structural
 * validator.
 */
export function validateAgentOutput(
  output: Record<string, unknown>,
  schema: OutputSchema,
): OutputValidationIssue[] {
  const issues: OutputValidationIssue[] = [];

  for (const [field, definition] of Object.entries(schema.fields)) {
    const value = output[field];
    const required = definition.required ?? true;
    const actualType = typeOf(value);

    if (actualType === 'undefined' || actualType === 'null') {
      if (required) {
        issues.push({
          field,
          message: `is required but was ${actualType === 'null' ? 'null' : 'missing'}.`,
        });
      }
      continue;
    }

    if (actualType !== definition.type) {
      issues.push({
        field,
        message: `must be of type "${definition.type}" but was "${actualType}".`,
      });
    }
  }

  return issues;
}
