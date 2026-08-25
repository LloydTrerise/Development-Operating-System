export interface ToolInputValidationIssue {
  field: string;
  message: string;
}

interface JsonSchemaLike {
  properties?: Record<string, { type?: string }>;
  required?: string[];
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Structural validation only (field presence + primitive/array/object
 * type), mirroring `@devos/agents`'s `validateAgentOutput` — not full JSON
 * Schema (no `$ref`, `oneOf`, nested-object shape checking, etc.). A tool
 * capability's `inputSchema` is a plain JSONB object
 * (`packages/tools/src/capabilities/*.ts`), not validated against any
 * schema-of-schemas, so this only understands the flat
 * `{properties, required}` shape those definitions actually use.
 */
export function validateToolInput(
  parameters: Record<string, unknown>,
  schema: Record<string, unknown>,
): ToolInputValidationIssue[] {
  const issues: ToolInputValidationIssue[] = [];
  const { properties = {}, required = [] } = schema as JsonSchemaLike;

  for (const field of required) {
    const value = parameters[field];
    if (value === undefined || value === null) {
      issues.push({ field, message: 'is required but was missing.' });
    }
  }

  for (const [field, definition] of Object.entries(properties)) {
    const value = parameters[field];
    if (value === undefined || value === null) continue;
    if (definition.type !== undefined && typeOf(value) !== definition.type) {
      issues.push({
        field,
        message: `must be of type "${definition.type}" but was "${typeOf(value)}".`,
      });
    }
  }

  return issues;
}
