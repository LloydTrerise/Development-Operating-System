import type { PolicyId } from '@devos/contracts';

/**
 * No policy evaluation algorithm or rule language is specified anywhere in
 * the spec corpus (specs/sprints/sprint-03/DEVOS-044.md); the only stated
 * constraints are "Policy evaluation occurs server-side"
 * (specs/api/poc-api-contracts.md §31) and "must be deterministic and
 * independent of model output" (specs/architecture/repository-code-structure.md
 * §17). This is therefore a minimal, implementation-defined rule shape for
 * `Policy.definition` (the JSONB column), not a spec-mandated format.
 *
 * `condition`, when present, must match every listed field of the
 * evaluation request exactly for the rule to apply; an absent `condition`
 * matches any request for the given `action`.
 */
export type PolicyEffect = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';

export interface PolicyRule {
  action: string;
  effect: PolicyEffect;
  condition?: {
    actorRole?: string;
    resourceType?: string;
  };
}

export interface PolicyDefinition {
  rules: PolicyRule[];
  /** Applied when this policy has no rule matching the request's action. */
  defaultEffect?: PolicyEffect;
}

export interface PolicyEvaluationRequest {
  action: string;
  actorRole?: string;
  resourceType?: string;
}

/**
 * One of the policies that produced a conflicting match for the same
 * request (DEVOS-048) — a real, mechanically-detectable "Conflicting
 * Context" case (specs/architecture/system-context-engineering-knowledge.md
 * §23): two *different* policy keys can each carry a rule that matches the
 * same action, with no defined precedence between one key and another
 * (unlike versions of the *same* key, where the highest published version
 * already wins). Domain Invariant §37.5: "Conflicting authoritative
 * information must be surfaced when precedence cannot resolve it" — rather
 * than silently picking one (e.g. by key name), the conflict is surfaced.
 */
export interface ConflictingPolicyMatch {
  policyId: PolicyId;
  policyKey: string;
  effect: PolicyEffect;
}

export interface PolicyEvaluationResult {
  decision: PolicyEffect | 'CONFLICT';
  reason: string;
  matchedPolicyId?: PolicyId;
  matchedPolicyKey?: string;
  conflictingMatches?: ConflictingPolicyMatch[];
}
