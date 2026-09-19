import type { Policy } from '@devos/domain';
import { evaluatePolicies } from './evaluate-policies.js';
import type { PolicyEvaluationRequest, PolicyEvaluationResult } from './policy-evaluation.js';

/**
 * DEVOS-139: Core Platform spec §14's mandatory-precedence rule — "a
 * lower-level configuration must not weaken a higher-level mandatory
 * policy" — applied to exactly the two real levels this codebase evaluates
 * (organisation, project). Organisation and project policies are evaluated
 * *separately* (not concatenated into one `evaluatePolicies` call) so an
 * organisation-level internal conflict and a project-level internal
 * conflict each still surface as `CONFLICT` on their own terms, exactly as
 * `evaluatePolicies` already reports them.
 *
 * The override is deliberately narrow: it only fires when the organisation
 * genuinely addressed this action (a real rule or `defaultEffect` matched,
 * not just the evaluator's own global fallback) with `DENY` or
 * `REQUIRE_APPROVAL`, and the project's own decision would otherwise be
 * `ALLOW` — the one shape that is unambiguously "a lower-level
 * configuration weakening a higher-level mandatory policy." Every other
 * combination (no organisation policies at all; an organisation policy that
 * itself resolves to `ALLOW`; a project policy that is already `DENY`/
 * `REQUIRE_APPROVAL` in its own right) falls through to the project's own
 * decision unchanged — with zero organisation policies, this is byte-for-
 * byte identical to calling `evaluatePolicies(projectPolicies, request)`
 * alone, exactly today's pre-DEVOS-139 behaviour.
 */
export function evaluatePoliciesWithPrecedence(
  organisationPolicies: Policy[],
  projectPolicies: Policy[],
  request: PolicyEvaluationRequest,
): PolicyEvaluationResult {
  const organisationDecision = evaluatePolicies(organisationPolicies, request);
  if (organisationDecision.decision === 'CONFLICT') return organisationDecision;

  const projectDecision = evaluatePolicies(projectPolicies, request);
  if (projectDecision.decision === 'CONFLICT') return projectDecision;

  const organisationIsMandatory =
    organisationDecision.matchedPolicyId !== undefined &&
    (organisationDecision.decision === 'DENY' ||
      organisationDecision.decision === 'REQUIRE_APPROVAL');

  if (organisationIsMandatory && projectDecision.decision === 'ALLOW') {
    return {
      ...organisationDecision,
      reason: `${organisationDecision.reason} Organisation-level policy takes precedence over the project's own "${projectDecision.reason}"`,
    };
  }

  return projectDecision;
}
