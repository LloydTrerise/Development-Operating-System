# DEVOS-100 — Pilot execution

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-099 (the pilot environment to run against).

## Scope

"Run representative software changes" (source, verbatim). A real execution of the reference Software Change Workflow's full path (discovery through closure, including a rework cycle and a release) against DEVOS-099's real, isolated pilot environment — the same proof `tests/e2e/full-workflow.test.ts` already automates, run here as a live, observed pilot rather than an automated CI assertion, with its real outcome honestly reported.

## Grounding

`specs/workflows/software-change-workflow.md`'s full stage list; the existing e2e suite already proves the mechanism works. This task is about actually *running* it once more, live, against the isolated pilot environment specifically, and reporting what really happened (timings, any friction, any surprise) rather than re-asserting what the automated suite already asserts.

## Flagged gap

No real GitHub API calls, no real external deployment/hosting provider calls — the same carried-forward scoping decision as every prior sprint. The pilot's "representative software change" therefore uses the same real-local-git/real-local-staging-deployment mechanism the rest of this codebase already uses for real work, not a fabricated cloud pilot.

## Acceptance

A real work item is carried through the full reference workflow against the DEVOS-099 pilot environment, and its real outcome (timings from DEVOS-093's baseline mechanism, any defect encountered) is recorded in this task's own decision-log entry as the pilot report.
