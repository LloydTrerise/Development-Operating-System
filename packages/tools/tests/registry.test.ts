import { describe, expect, it } from 'vitest';
import {
  capabilityDefinitions,
  getCapabilityDefinition,
} from '../src/registry/capability-registry.js';

describe('capability registry', () => {
  it('defines exactly the nine capabilities introduced through Sprint 10', () => {
    const keys = capabilityDefinitions.map((d) => d.key).sort();
    expect(keys).toEqual([
      'build-run',
      'deploy',
      'git-commit',
      'health-check',
      'pull-request-create',
      'repo-read',
      'repo-write',
      'security-scan',
      'test-run',
    ]);
  });

  it('looks up a definition by key, and returns undefined for an unknown key', () => {
    expect(getCapabilityDefinition('repo-read')?.riskClass).toBe('R0');
    expect(getCapabilityDefinition('deploy')?.riskClass).toBe('R3');
    expect(getCapabilityDefinition('does-not-exist')).toBeUndefined();
  });
});
