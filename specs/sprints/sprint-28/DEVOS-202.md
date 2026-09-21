# DEVOS-202 — Validation, documentation, and gap disclosure

**Priority:** P1 | **Estimate:** 1d
**Depends on:** DEVOS-198, DEVOS-199, DEVOS-200, DEVOS-201.
**Depended on by:** none — closes Sprint 28 and the whole E27 epic (pending Sprint 27's own independent completion).

## Scope

Full monorepo validation, plus explicit disclosure of any real gap DEVOS-198–201 surfaced.

## Implementation

- Run `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`; fix any real failure.
- Run the full real `tests/e2e` suite; confirm every existing file remains green (no existing test configures `reliabilityReduction`, so this is a pure regression check on `resolveApprovalRequirements`).
- Record in this file's own Acceptance section any real gap found — expected candidates: the tool-invocation `REQUIRE_APPROVAL` path's own pre-existing, still-unaddressed gap (explicitly out of this epic's scope, per the backlog document and both sprint READMEs); whether a canvas-editor UI for authoring `reliabilityReduction` (deferred per DEVOS-199's own "out of scope") should be a follow-up item.

## Out of scope

Any new feature.

## Acceptance

Full validation green. The full real `tests/e2e` suite re-confirmed unaffected. Gap disclosure recorded, not silently patched. Explicit confirmation that `requiredApprovers` cannot be reduced below 1 by any configuration this sprint introduced.
