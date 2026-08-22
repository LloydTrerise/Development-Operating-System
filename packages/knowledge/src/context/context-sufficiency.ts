import type { AssembledContext } from './assembled-context.js';

/**
 * Step 10 of the Context Assembly pipeline (specs/architecture/system-context-engineering-knowledge.md
 * §22), deliberately deferred out of DEVOS-041's `buildContext()` into this
 * dedicated task (DEVOS-048), per that task's own decision log entry.
 *
 * §23 names five categories (Sufficient/Incomplete/Conflicting/Stale/
 * Untrusted); only `SUFFICIENT`/`INCOMPLETE` are implemented here, since
 * they are the only ones this codebase has a concrete, mechanically
 * checkable signal for today — `buildContext()` either found at least one
 * source or it found none. `Conflicting` context is handled separately, at
 * the policy-evaluation layer (`packages/policy`'s `evaluatePolicies`,
 * extended by this same task), where two different policies can genuinely
 * disagree. `Stale` (a freshness/expiry concept) and `Untrusted` (a
 * trust-tier concept) have no data anywhere in this codebase to check
 * against — no source records a freshness window or a trust level — so
 * fabricating a check for them would invent a signal that doesn't exist,
 * rather than surface a real one.
 */
export type ContextSufficiencyStatus = 'SUFFICIENT' | 'INCOMPLETE';

/**
 * Constitution Principle 2/13 and specs/architecture/system-context-engineering-knowledge.md
 * §23 both give this exact required response text when information is
 * insufficient — reused verbatim, not paraphrased.
 */
export const INSUFFICIENT_CONTEXT_MESSAGE = 'I do not have enough information to determine this.';

export interface ContextSufficiencyResult {
  status: ContextSufficiencyStatus;
  message?: string;
}

/**
 * `buildContext()` having produced zero sources for a task is the one
 * concrete "Incomplete Context" signal available: nothing authorised,
 * relevant, or otherwise was found to supply the execution. This does not
 * itself decide what the workflow should do next (§23 also lists request
 * additional information / ask for human clarification / retrieve more
 * context / return to an earlier task as the possible responses) — it only
 * surfaces the insufficiency, per Constitution Principle 13 ("Fail
 * Safely": stop and surface, don't guess).
 */
export function assessContextSufficiency(context: AssembledContext): ContextSufficiencyResult {
  if (context.sources.length === 0) {
    return { status: 'INCOMPLETE', message: INSUFFICIENT_CONTEXT_MESSAGE };
  }
  return { status: 'SUFFICIENT' };
}
