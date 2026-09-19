import { randomUUID } from 'node:crypto';
import type { OrganisationId, PolicyId, ProjectId } from '@devos/contracts';
import type { Policy } from '@devos/domain';
import { describe, expect, it } from 'vitest';
import { evaluatePoliciesWithPrecedence } from '../src/evaluator/evaluate-policies-with-precedence.js';
import type { PolicyDefinition } from '../src/evaluator/policy-evaluation.js';

const PROJECT_ID = randomUUID() as ProjectId;
const ORG_ID = randomUUID() as OrganisationId;

function makeOrganisationPolicy(key: string, definition: PolicyDefinition): Policy {
  return {
    id: randomUUID() as PolicyId,
    organisationId: ORG_ID,
    key,
    version: 1,
    status: 'PUBLISHED',
    definition: definition as unknown as Record<string, unknown>,
    createdBy: 'alice',
    createdAt: new Date().toISOString(),
  };
}

function makeProjectPolicy(key: string, definition: PolicyDefinition): Policy {
  return {
    id: randomUUID() as PolicyId,
    organisationId: ORG_ID,
    projectId: PROJECT_ID,
    key,
    version: 1,
    status: 'PUBLISHED',
    definition: definition as unknown as Record<string, unknown>,
    createdBy: 'alice',
    createdAt: new Date().toISOString(),
  };
}

describe('evaluatePoliciesWithPrecedence', () => {
  it('DEVOS-139: is byte-for-byte identical to evaluating the project policies alone when there are no organisation policies', () => {
    const projectPolicy = makeProjectPolicy('release', {
      rules: [{ action: 'release.deploy', effect: 'REQUIRE_APPROVAL' }],
    });

    const result = evaluatePoliciesWithPrecedence([], [projectPolicy], {
      action: 'release.deploy',
    });

    expect(result.decision).toBe('REQUIRE_APPROVAL');
    expect(result.matchedPolicyKey).toBe('release');
  });

  it('DEVOS-139: an organisation DENY overrides a project ALLOW for the same action', () => {
    const organisationPolicy = makeOrganisationPolicy('org-lockdown', {
      rules: [{ action: 'tool.invoke', effect: 'DENY' }],
    });
    const projectPolicy = makeProjectPolicy('project-permissive', {
      rules: [{ action: 'tool.invoke', effect: 'ALLOW' }],
    });

    const result = evaluatePoliciesWithPrecedence([organisationPolicy], [projectPolicy], {
      action: 'tool.invoke',
    });

    expect(result.decision).toBe('DENY');
    expect(result.matchedPolicyKey).toBe('org-lockdown');
  });

  it('DEVOS-139: an organisation REQUIRE_APPROVAL overrides a project ALLOW for the same action', () => {
    const organisationPolicy = makeOrganisationPolicy('org-approval', {
      rules: [{ action: 'tool.invoke', effect: 'REQUIRE_APPROVAL' }],
    });
    const projectPolicy = makeProjectPolicy('project-permissive', {
      rules: [{ action: 'tool.invoke', effect: 'ALLOW' }],
    });

    const result = evaluatePoliciesWithPrecedence([organisationPolicy], [projectPolicy], {
      action: 'tool.invoke',
    });

    expect(result.decision).toBe('REQUIRE_APPROVAL');
  });

  it('DEVOS-139: an organisation ALLOW does not override a stricter project decision', () => {
    const organisationPolicy = makeOrganisationPolicy('org-permissive', {
      rules: [{ action: 'tool.invoke', effect: 'ALLOW' }],
    });
    const projectPolicy = makeProjectPolicy('project-strict', {
      rules: [{ action: 'tool.invoke', effect: 'DENY' }],
    });

    const result = evaluatePoliciesWithPrecedence([organisationPolicy], [projectPolicy], {
      action: 'tool.invoke',
    });

    expect(result.decision).toBe('DENY');
    expect(result.matchedPolicyKey).toBe('project-strict');
  });

  it('DEVOS-139: an organisation policy that does not address this action does not suppress the project decision', () => {
    const organisationPolicy = makeOrganisationPolicy('org-unrelated', {
      rules: [{ action: 'unrelated.action', effect: 'DENY' }],
    });
    const projectPolicy = makeProjectPolicy('project-permissive', {
      rules: [{ action: 'tool.invoke', effect: 'ALLOW' }],
    });

    const result = evaluatePoliciesWithPrecedence([organisationPolicy], [projectPolicy], {
      action: 'tool.invoke',
    });

    expect(result.decision).toBe('ALLOW');
  });

  it('DEVOS-139: a project decision that is already DENY/REQUIRE_APPROVAL (not ALLOW) is not touched by a mandatory organisation policy', () => {
    const organisationPolicy = makeOrganisationPolicy('org-strict', {
      rules: [{ action: 'tool.invoke', effect: 'DENY' }],
    });
    const projectPolicy = makeProjectPolicy('project-approval', {
      rules: [{ action: 'tool.invoke', effect: 'REQUIRE_APPROVAL' }],
    });

    const result = evaluatePoliciesWithPrecedence([organisationPolicy], [projectPolicy], {
      action: 'tool.invoke',
    });

    expect(result.decision).toBe('REQUIRE_APPROVAL');
    expect(result.matchedPolicyKey).toBe('project-approval');
  });

  it('DEVOS-139: two organisation policies disagreeing with each other still surface CONFLICT, not a silent fallback to the project decision', () => {
    const organisationAllow = makeOrganisationPolicy('org-a', {
      rules: [{ action: 'tool.invoke', effect: 'ALLOW' }],
    });
    const organisationDeny = makeOrganisationPolicy('org-b', {
      rules: [{ action: 'tool.invoke', effect: 'DENY' }],
    });
    const projectPolicy = makeProjectPolicy('project-permissive', {
      rules: [{ action: 'tool.invoke', effect: 'ALLOW' }],
    });

    const result = evaluatePoliciesWithPrecedence(
      [organisationAllow, organisationDeny],
      [projectPolicy],
      { action: 'tool.invoke' },
    );

    expect(result.decision).toBe('CONFLICT');
  });

  it('DEVOS-139: two project policies disagreeing with each other still surface CONFLICT, unaffected by an unrelated organisation policy', () => {
    const organisationPolicy = makeOrganisationPolicy('org-unrelated', {
      rules: [{ action: 'unrelated.action', effect: 'DENY' }],
    });
    const projectAllow = makeProjectPolicy('project-a', {
      rules: [{ action: 'tool.invoke', effect: 'ALLOW' }],
    });
    const projectDeny = makeProjectPolicy('project-b', {
      rules: [{ action: 'tool.invoke', effect: 'DENY' }],
    });

    const result = evaluatePoliciesWithPrecedence(
      [organisationPolicy],
      [projectAllow, projectDeny],
      { action: 'tool.invoke' },
    );

    expect(result.decision).toBe('CONFLICT');
  });
});
