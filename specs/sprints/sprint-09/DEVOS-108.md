# DEVOS-108 — Real-provider end-to-end pilot verification

**Priority:** P0 | **Estimate:** 1d
**Depends on:** `DEVOS-104`, `DEVOS-105`, `DEVOS-106`, `DEVOS-107` all complete.

## Scope

"A real Software Change Workflow run opens a real PR, deploys to a real target, and is triggered by a real OIDC-authenticated user, in one run" (`specs/DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §7, verbatim). This mirrors `DEVOS-100`'s own precedent (Sprint 8's real pilot run) — proving the four new adapters work together end-to-end, not just individually.

## Grounding

`Analysis/DevOS_POC_Architecture_and_Implementation_Plan_v1.0.docx` §42 ("Example E2E Test") — the same reference scenario, now run against real external systems instead of local fakes for the first time.

## Flagged gap

None expected if `DEVOS-104`–`107` are each independently verified first — this task's entire purpose is to surface any integration-level gap between them (e.g. does the real OIDC principal's id satisfy every downstream membership/ownership check the same way the local dev principal id always has).

## Acceptance

One real, complete Software Change Workflow run: a real OIDC-authenticated user starts it; discovery through planning proceed as today; the development stage opens a real GitHub PR (`DEVOS-104`); validation and review proceed as today; the release stage deploys to the real target (`DEVOS-105`); every credential either stage needed was resolved through the real secret backend (`DEVOS-106`). Any defect this surfaces is fixed and covered by a regression test before this task is marked complete — mirroring `DEVOS-101`'s own precedent for pilot-remediation.
