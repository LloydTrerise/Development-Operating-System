import { describe, expect, it } from 'vitest';
import { validateAgentOutput } from '../src/schemas/validate-output.js';
import type { OutputSchema } from '../src/schemas/schema-repository.js';

const SCHEMA: OutputSchema = {
  name: 'prd',
  version: 1,
  fields: {
    title: { type: 'string' },
    sections: { type: 'array' },
    approved: { type: 'boolean', required: false },
  },
};

describe('validateAgentOutput', () => {
  it('returns no issues for a conforming output', () => {
    const issues = validateAgentOutput({ title: 'A PRD', sections: ['intro'] }, SCHEMA);
    expect(issues).toEqual([]);
  });

  it('accepts an optional field being absent, but flags a wrong type when present', () => {
    const missingOptional = validateAgentOutput({ title: 'A PRD', sections: [] }, SCHEMA);
    expect(missingOptional).toEqual([]);

    const wrongOptionalType = validateAgentOutput(
      { title: 'A PRD', sections: [], approved: 'yes' },
      SCHEMA,
    );
    expect(wrongOptionalType).toEqual([
      { field: 'approved', message: 'must be of type "boolean" but was "string".' },
    ]);
  });

  it('flags a missing required field', () => {
    const issues = validateAgentOutput({ sections: [] }, SCHEMA);
    expect(issues).toEqual([{ field: 'title', message: 'is required but was missing.' }]);
  });

  it('flags a required field that is explicitly null', () => {
    const issues = validateAgentOutput({ title: null, sections: [] }, SCHEMA);
    expect(issues).toEqual([{ field: 'title', message: 'is required but was null.' }]);
  });

  it('flags a field with the wrong type', () => {
    const issues = validateAgentOutput({ title: 42, sections: [] }, SCHEMA);
    expect(issues).toEqual([
      { field: 'title', message: 'must be of type "string" but was "number".' },
    ]);
  });

  it('reports every issue, not just the first', () => {
    const issues = validateAgentOutput({}, SCHEMA);
    expect(issues).toEqual([
      { field: 'title', message: 'is required but was missing.' },
      { field: 'sections', message: 'is required but was missing.' },
    ]);
  });
});
