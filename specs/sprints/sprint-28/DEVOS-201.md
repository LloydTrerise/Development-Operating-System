# DEVOS-201 — Real end-to-end pilot: reduction genuinely conditional on real evidence

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-198, DEVOS-199, DEVOS-200.
**Depended on by:** DEVOS-202.

## Scope

Live, independently-verified proof that a real reliability threshold, genuinely crossed by real captured evidence, changes a real approval's requirement — and that an agent version which has *not* crossed it changes nothing, proving the mechanism is conditional, not decorative.

## Pilot procedure

1. Reusing E25 Sprint 22's own DEVOS-175 pilot pattern (`AgentsPage.tsx`-authored agent version, real workflow runs producing real `CODE_CHANGE`/`REVIEW_EVIDENCE` pairs), a real developer `AgentVersion` accumulates enough real, distinct `PASS` review outcomes to genuinely cross a configured `minPassRate`/`minSampleSize` threshold (e.g. `minPassRate: 0.8, minSampleSize: 3`).
2. A real workflow definition's `APPROVAL` node is authored (or an existing Incident Response/Sprint-12-style workflow is extended) with `reliabilityReduction: { agentVersionId: <that version>, minPassRate: 0.8, minSampleSize: 3, reducedRequiredApprovers: 1 }`, where the node's static/policy-tiered resolution would otherwise require 2.
3. A real workflow run reaches that `APPROVAL` node; the created `Approval` row is confirmed — via a direct Postgres query, not code inspection — to have `requiredApprovers: 1` and a `reliabilityEvidence` recording `'MET'` against the real agent version.
4. A control case: a second real agent version that has accumulated real review evidence but has **not** crossed the threshold (either a lower real pass rate or fewer than `minSampleSize` real reviews) is configured identically on a second real run; its created `Approval` is confirmed to retain `requiredApprovers: 2` (the original static value) with `reliabilityEvidence` recording `'UNMET'`/`'INSUFFICIENT_SAMPLE'`.
5. Both approvals are visible with their correct, distinct outcomes in `GovernancePage.tsx` (DEVOS-200).
6. Test data (both workflow runs, both agent versions' evidence, both approvals) cleaned up afterward.

## Out of scope

Any change to the underlying `APPROVAL` node execution mechanics (`runApprovalTask`'s own decision/expiry/wait logic) — this pilot exercises only the new reliability-conditioned resolution added in DEVOS-199.

## Acceptance

Both the reduced and the unreduced outcome are independently confirmed via a direct Postgres query on the real `Approval` rows and their `reliabilityEvidence`, not asserted from application logs alone. The control case genuinely proves the mechanism is conditional (not simply "always reduces once configured").
