import { describe, expect, it } from 'vitest';
import {
  assessContextSufficiency,
  INSUFFICIENT_CONTEXT_MESSAGE,
} from '../src/context/context-sufficiency.js';
import type { AssembledContext } from '../src/context/assembled-context.js';

describe('assessContextSufficiency', () => {
  it('is SUFFICIENT when at least one source was assembled', () => {
    const context: AssembledContext = {
      sources: [
        { type: 'PROJECT_CONTEXT', ref: 'project:1', name: 'A', content: {}, authorityLevel: 2 },
      ],
    };

    const result = assessContextSufficiency(context);

    expect(result).toEqual({ status: 'SUFFICIENT' });
  });

  it('is INCOMPLETE with the required response text when no sources were found', () => {
    const context: AssembledContext = { sources: [] };

    const result = assessContextSufficiency(context);

    expect(result.status).toBe('INCOMPLETE');
    expect(result.message).toBe(INSUFFICIENT_CONTEXT_MESSAGE);
    expect(result.message).toBe('I do not have enough information to determine this.');
  });
});
