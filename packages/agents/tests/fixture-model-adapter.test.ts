import { describe, expect, it } from 'vitest';
import { createFixtureModelAdapter } from '../src/fixtures/fixture-model-adapter.js';
import type { AgentFixture } from '../src/fixtures/fixture-repository.js';

const discoveryFixture: AgentFixture = {
  role: 'DISCOVERY',
  recordedAt: '2026-01-01T00:00:00.000Z',
  provider: 'gemini',
  modelRef: 'gemini-3.6-flash',
  objective: 'x',
  input: {},
  result: { summary: 'a fixture summary', findings: ['a finding'] },
};

describe('createFixtureModelAdapter', () => {
  it('replays the recorded result for a role with a fixture, no network call involved', async () => {
    const adapter = createFixtureModelAdapter({ DISCOVERY: discoveryFixture });

    const result = await adapter.invoke({
      configuration: {
        role: 'DISCOVERY',
        provider: 'gemini',
        modelRef: 'gemini-3.6-flash',
        allowedCapabilities: [],
      },
      objective: 'irrelevant to the replay',
      input: {},
    });

    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      result: { summary: 'a fixture summary', findings: ['a finding'] },
    });
    expect(result.modelReference).toContain('gemini:gemini-3.6-flash');
  });

  it('fails clearly for a role with no recorded fixture', async () => {
    const adapter = createFixtureModelAdapter({ DISCOVERY: discoveryFixture });

    const result = await adapter.invoke({
      configuration: {
        role: 'PLANNING',
        provider: 'gemini',
        modelRef: 'gemini-3.6-flash',
        allowedCapabilities: [],
      },
      objective: 'irrelevant to the replay',
      input: {},
    });

    expect(result).toMatchObject({
      status: 'FAILED',
      errorMessage: expect.stringContaining('No fixture recorded for role "PLANNING"'),
    });
  });
});
