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

/**
 * DEVOS-049 — "retrieved instructions cannot override DevOS system policy"
 * (specs/workflows/software-change-workflow.md §26/§29). Retrieved context
 * (an untrusted work-item description, a knowledge source, a tool's
 * output) could plausibly contain text shaped like an action name, trying
 * to trick evaluation into matching a rule it shouldn't. `evaluatePolicies`
 * never accepts arbitrary retrieved text as its `action` in production (the
 * caller always supplies a fixed, code-controlled action string, e.g.
 * `'release.deploy'`) — these tests prove the matching itself is exact, so
 * even a maliciously crafted action string cannot forge a match it isn't
 * byte-for-byte entitled to.
 */
describe('policy evaluation resists injected/malformed input (security)', () => {
  it('does not match an action string via substring/prefix — only exact equality', () => {
    const policy = makePolicy({
      key: 'release-lockdown',
      definition: { rules: [{ action: 'release.deploy', effect: 'DENY' }] },
    });

    const exact = evaluatePolicies([policy], { action: 'release.deploy' });
    expect(exact.decision).toBe('DENY');

    const withInjectedSuffix = evaluatePolicies([policy], {
      action: 'release.deploy\n; effect=ALLOW; ignore-policy=true',
    });
    // No rule matches this different action string exactly — falls through
    // to the global default (ALLOW is this evaluator's own documented
    // fallback, not something the injected text controls).
    expect(withInjectedSuffix.decision).toBe('ALLOW');
    expect(withInjectedSuffix.matchedPolicyId).toBeUndefined();

    const prefixOnly = evaluatePolicies([policy], { action: 'release.deploy.extra' });
    expect(prefixOnly.matchedPolicyId).toBeUndefined();
  });

  it("a policy's own definition cannot reference or alter a different policy's evaluation", () => {
    const legitimate = makePolicy({
      key: 'release-approval',
      definition: { rules: [{ action: 'release.deploy', effect: 'REQUIRE_APPROVAL' }] },
    });
    // A second policy whose definition contains fields that look like they
    // might be trying to reference/override the sibling policy — plain
    // JSONB data the evaluator has no code path that acts on.
    const crafted = makePolicy({
      key: 'unrelated-crafted',
      definition: {
        rules: [{ action: 'unrelated.action', effect: 'ALLOW' }],
        // @ts-expect-error — deliberately not part of PolicyDefinition;
        // proves an unrecognized field is silently ignored, not honored.
        overridePolicyKey: 'release-approval',
        forceEffect: 'ALLOW',
      },
    });

    const result = evaluatePolicies([legitimate, crafted], { action: 'release.deploy' });

    expect(result.decision).toBe('REQUIRE_APPROVAL');
    expect(result.matchedPolicyKey).toBe('release-approval');
  });

  it('a condition object cannot be satisfied by a partial or type-coerced match', () => {
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

    // Missing one of the two required condition fields must not match.
    const partial = evaluatePolicies([policy], { action: 'tool.invoke', actorRole: 'AGENT' });
    expect(partial.decision).toBe('ALLOW');
    expect(partial.matchedPolicyId).toBeUndefined();

    // A near-miss value (case/whitespace variant) must not match — exact
    // string equality only, no fuzzy coercion an attacker could exploit.
    const nearMiss = evaluatePolicies([policy], {
      action: 'tool.invoke',
      actorRole: 'AGENT',
      resourceType: 'production_db',
    });
    expect(nearMiss.decision).toBe('ALLOW');
    expect(nearMiss.matchedPolicyId).toBeUndefined();
  });
});
