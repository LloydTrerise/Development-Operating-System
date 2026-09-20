# DEVOS-193 — Validation and real confirmation

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** DEVOS-192.
**Depended on by:** none — closes this gap-closure sprint.

## Scope

Full monorepo validation, plus a real, direct confirmation (not just a passing typecheck) that a real development-agent run's model input genuinely contains real repository file content.

## Implementation

- Run `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`; fix any real failure.
- Run the full real `tests/e2e` suite; confirm `development-path.test.ts` (the existing real-git-repository fixture this gap directly affects) and every other file remain green.
- Add a real assertion to `run-development-agent-task.test.ts` (or extend `development-path.test.ts`) that directly inspects the captured model request/input and confirms `relevantRepositoryFiles` contains the real, actual byte-for-byte content of a real fixture file the test's own plan summary was designed to match — not merely that the field is present.

## Out of scope

Any new feature.

## Acceptance

Full validation green. The new direct-content assertion passes against real file content, not a mocked stand-in.
