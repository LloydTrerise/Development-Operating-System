import { randomUUID } from 'node:crypto';
import type { OrganisationId, PolicyId, ProjectId } from '@devos/contracts';
import type { Policy } from '@devos/domain';
import { describe, expect, it } from 'vitest';
import { evaluatePolicies } from '../src/evaluator/evaluate-policies.js';
import type { PolicyDefinition } from '../src/evaluator/policy-evaluation.js';

const PROJECT_ID = randomUUID() as ProjectId;
const ORG_ID = randomUUID() as OrganisationId;

function makePolicy(overrides: {
  key: string;
  version?: number;
  status?: Policy['status'];
  definition: PolicyDefinition;
}): Policy {
  return {
    id: randomUUID() as PolicyId,
    organisationId: ORG_ID,
    projectId: PROJECT_ID,
    key: overrides.key,
    version: overrides.version ?? 1,
    status: overrides.status ?? 'PUBLISHED',
    definition: overrides.definition,
    createdBy: 'alice',
    createdAt: new Date().toISOString(),
  };
}

describe('evaluatePolicies', () => {
  it('returns the matching rule effect for an explicit action match', () => {
    const policy = makePolicy({
      key: 'release-approval',
      definition: {
        rules: [{ action: 'release.deploy', effect: 'REQUIRE_APPROVAL' }],
      },
    });

    const result = evaluatePolicies([policy], { action: 'release.deploy' });

    expect(result.decision).toBe('REQUIRE_APPROVAL');
    expect(result.matchedPolicyKey).toBe('release-approval');
  });

  it('only matches a rule whose condition is satisfied by the request', () => {
    const policy = makePolicy({
      key: 'agent-tools',
      definition: {
        rules: [
          {
            action: 'tool.invoke',
            effect: 'DENY',
            condition: { actorRole: 'AGENT', resourceType: 'PRODUCTION_DB' },
          },
        ],
      },
    });

    const matching = evaluatePolicies([policy], {
      action: 'tool.invoke',
      actorRole: 'AGENT',
      resourceType: 'PRODUCTION_DB',
    });
    expect(matching.decision).toBe('DENY');

    const nonMatching = evaluatePolicies([policy], {
      action: 'tool.invoke',
      actorRole: 'AGENT',
      resourceType: 'STAGING_DB',
    });
    expect(nonMatching.decision).toBe('ALLOW');
    expect(nonMatching.matchedPolicyId).toBeUndefined();
  });

  it('falls back to a policy default effect when no rule matches its rules', () => {
    const policy = makePolicy({
      key: 'default-deny',
      definition: {
        rules: [{ action: 'unrelated.action', effect: 'ALLOW' }],
        defaultEffect: 'DENY',
      },
    });

    const result = evaluatePolicies([policy], { action: 'anything.else' });

    expect(result.decision).toBe('DENY');
    expect(result.matchedPolicyKey).toBe('default-deny');
  });

  it('falls back to the global default (ALLOW) when nothing applies at all', () => {
    const policy = makePolicy({
      key: 'unrelated',
      definition: { rules: [{ action: 'unrelated.action', effect: 'DENY' }] },
    });

    const result = evaluatePolicies([policy], { action: 'unaddressed.action' });

    expect(result.decision).toBe('ALLOW');
    expect(result.matchedPolicyId).toBeUndefined();
  });

  it('ignores DRAFT policies entirely', () => {
    const draft = makePolicy({
      key: 'draft-only',
      status: 'DRAFT',
      definition: { rules: [{ action: 'release.deploy', effect: 'DENY' }] },
    });

    const result = evaluatePolicies([draft], { action: 'release.deploy' });

    expect(result.decision).toBe('ALLOW');
  });

  it('uses only the highest published version of a repeated key', () => {
    const v1 = makePolicy({
      key: 'release-approval',
      version: 1,
      definition: { rules: [{ action: 'release.deploy', effect: 'ALLOW' }] },
    });
    const v2 = makePolicy({
      key: 'release-approval',
      version: 2,
      definition: { rules: [{ action: 'release.deploy', effect: 'REQUIRE_APPROVAL' }] },
    });

    const result = evaluatePolicies([v1, v2], { action: 'release.deploy' });

    expect(result.decision).toBe('REQUIRE_APPROVAL');
  });

  it('is deterministic — repeated calls with the same input produce the same result', () => {
    const policy = makePolicy({
      key: 'release-approval',
      definition: { rules: [{ action: 'release.deploy', effect: 'REQUIRE_APPROVAL' }] },
    });
    const request = { action: 'release.deploy' };

    const first = evaluatePolicies([policy], request);
    const second = evaluatePolicies([policy], request);

    expect(first).toEqual(second);
  });

  it('surfaces a CONFLICT when two different policy keys disagree on the same action', () => {
    const allowPolicy = makePolicy({
      key: 'release-freeform',
      definition: { rules: [{ action: 'release.deploy', effect: 'ALLOW' }] },
    });
    const denyPolicy = makePolicy({
      key: 'release-lockdown',
      definition: { rules: [{ action: 'release.deploy', effect: 'DENY' }] },
    });

    const result = evaluatePolicies([allowPolicy, denyPolicy], { action: 'release.deploy' });

    expect(result.decision).toBe('CONFLICT');
    expect(result.conflictingMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ policyKey: 'release-freeform', effect: 'ALLOW' }),
        expect.objectContaining({ policyKey: 'release-lockdown', effect: 'DENY' }),
      ]),
    );
  });

  it('DEVOS-072: only matches an environment-conditioned rule when the request environment matches', () => {
    const policy = makePolicy({
      key: 'release-policy',
      definition: {
        rules: [
          { action: 'deploy', effect: 'ALLOW', condition: { environment: 'staging' } },
          { action: 'deploy', effect: 'DENY', condition: { environment: 'production' } },
        ],
      },
    });

    const staging = evaluatePolicies([policy], { action: 'deploy', environment: 'staging' });
    expect(staging.decision).toBe('ALLOW');

    const production = evaluatePolicies([policy], { action: 'deploy', environment: 'production' });
    expect(production.decision).toBe('DENY');
  });

  it('DEVOS-072: an environment with no matching rule falls through to the policy default effect', () => {
    const policy = makePolicy({
      key: 'release-policy',
      definition: {
        rules: [{ action: 'deploy', effect: 'ALLOW', condition: { environment: 'staging' } }],
        defaultEffect: 'REQUIRE_APPROVAL',
      },
    });

    const result = evaluatePolicies([policy], { action: 'deploy', environment: 'production' });

    expect(result.decision).toBe('REQUIRE_APPROVAL');
    expect(result.matchedPolicyKey).toBe('release-policy');
  });

  it('does not report a conflict when multiple matching policies agree on the same effect', () => {
    const first = makePolicy({
      key: 'release-a',
      definition: { rules: [{ action: 'release.deploy', effect: 'REQUIRE_APPROVAL' }] },
    });
    const second = makePolicy({
      key: 'release-b',
      definition: { rules: [{ action: 'release.deploy', effect: 'REQUIRE_APPROVAL' }] },
    });

    const result = evaluatePolicies([first, second], { action: 'release.deploy' });

    expect(result.decision).toBe('REQUIRE_APPROVAL');
    expect(result.conflictingMatches).toBeUndefined();
  });
});
