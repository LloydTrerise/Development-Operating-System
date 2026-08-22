import type { Policy } from '@devos/domain';
import type {
  PolicyDefinition,
  PolicyEffect,
  PolicyEvaluationRequest,
  PolicyEvaluationResult,
  PolicyRule,
} from './policy-evaluation.js';

/**
 * "The default response when nothing applies" is not specified anywhere —
 * an explicit implementation choice, not a spec fact. `ALLOW` is used
 * because this POC's workflow already enforces its own hard-coded human
 * gates (e.g. ADR-SCW-002's planning approval) independently of any policy;
 * defaulting an *unaddressed* action to DENY would risk silently blocking
 * behaviour no policy author ever intended to restrict.
 */
const GLOBAL_DEFAULT_EFFECT: PolicyEffect = 'ALLOW';

function matchesCondition(rule: PolicyRule, request: PolicyEvaluationRequest): boolean {
  if (!rule.condition) return true;

  if (rule.condition.actorRole !== undefined && rule.condition.actorRole !== request.actorRole) {
    return false;
  }
  if (
    rule.condition.resourceType !== undefined &&
    rule.condition.resourceType !== request.resourceType
  ) {
    return false;
  }
  return true;
}

/** Only the highest-version *published* row for each key governs evaluation. */
function latestPublishedPerKey(policies: Policy[]): Policy[] {
  const byKey = new Map<string, Policy>();
  for (const policy of policies) {
    if (policy.status !== 'PUBLISHED') continue;
    const current = byKey.get(policy.key);
    if (!current || policy.version > current.version) byKey.set(policy.key, policy);
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Deterministic policy evaluation (specs/api/poc-api-contracts.md §31:
 * "Policy evaluation occurs server-side"; specs/architecture/repository-code-structure.md
 * §17: "must be deterministic and independent of model output"). Given the
 * same published policies and the same request, always returns the same
 * decision — no model call is involved anywhere in this function.
 *
 * Precedence: a specific rule match (across any applicable policy, in
 * key-sorted order) always wins over any policy's `defaultEffect`; a
 * `defaultEffect` wins over the evaluator's own global fallback.
 */
export function evaluatePolicies(
  policies: Policy[],
  request: PolicyEvaluationRequest,
): PolicyEvaluationResult {
  const applicable = latestPublishedPerKey(policies);

  const matches: Array<{ policy: Policy; rule: PolicyRule }> = [];
  for (const policy of applicable) {
    const definition = policy.definition as unknown as PolicyDefinition;
    const rule = definition.rules?.find(
      (candidate) => candidate.action === request.action && matchesCondition(candidate, request),
    );
    if (rule) matches.push({ policy, rule });
  }

  if (matches.length > 0) {
    const distinctEffects = new Set(matches.map((m) => m.rule.effect));

    if (distinctEffects.size > 1) {
      return {
        decision: 'CONFLICT',
        reason: `Policies disagree on action "${request.action}": ${matches
          .map((m) => `"${m.policy.key}" v${m.policy.version} says ${m.rule.effect}`)
          .join('; ')}. No precedence rule resolves conflicts between different policy keys.`,
        conflictingMatches: matches.map((m) => ({
          policyId: m.policy.id,
          policyKey: m.policy.key,
          effect: m.rule.effect,
        })),
      };
    }

    const { policy, rule } = matches[0]!;
    return {
      decision: rule.effect,
      reason: `Matched rule for action "${request.action}" in policy "${policy.key}" v${policy.version}.`,
      matchedPolicyId: policy.id,
      matchedPolicyKey: policy.key,
    };
  }

  for (const policy of applicable) {
    const definition = policy.definition as unknown as PolicyDefinition;
    if (definition.defaultEffect !== undefined) {
      return {
        decision: definition.defaultEffect,
        reason: `No rule matched action "${request.action}"; applied policy "${policy.key}" v${policy.version}'s default effect.`,
        matchedPolicyId: policy.id,
        matchedPolicyKey: policy.key,
      };
    }
  }

  return {
    decision: GLOBAL_DEFAULT_EFFECT,
    reason: `No applicable policy addressed action "${request.action}"; applied the global default effect.`,
  };
}
