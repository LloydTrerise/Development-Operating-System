# DEVOS-090 — Implement governance dashboard

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** DEVOS-086, DEVOS-087, DEVOS-089.

## Scope

"Policy, approval and risk views" (source, verbatim). A new web page surfacing, per project: active policies, recent approval decisions (from DEVOS-047/073's approval mechanism), and risk-classified tool activity (denied invocations, capability-restricted invocations from DEVOS-085).

## Grounding

No wireframe or layout is specified anywhere — built to the stated acceptance criterion itself, the same precedent DEVOS-046/060/070/080 already established for un-wireframed UI work.

## Flagged gap

"Risk views" has no defined scoring/classification scheme in the specs. This task scopes "risk" to a concrete, already-real signal: denied policy evaluations and denied capability checks (DEVOS-085), surfaced as a list — not a fabricated numeric risk score.

## Acceptance

The dashboard, loaded for a real seeded project, shows at least one real policy, at least one real approval decision, and at least one real denied-invocation entry, each sourced from a live API call against real Postgres data (verified via a live browser check).
