# DEVOS-115 — Extend audit-record coverage

**Priority:** P1 | **Estimate:** 2d
**Depends on:** None (Sprint 8 complete).

## Scope

`DEVOS-086`'s audit coverage is scoped to four operation families (membership, policy publish, integration creation, agent-version publish). Extend it to the remaining state-changing operations named in that task's own decision-log entry: project creation and update, work-item creation and update, workflow definition/version creation, and knowledge-source creation.

## Grounding

`DEVOS-PRODUCTION-READINESS-ROADMAP.md` F1, Sprint 7 item 9 — "a deliberate scoping decision, not an oversight," reconfirmed unchanged through `DEVOS-102`'s own review.

## Flagged gap

Confirm each new operation's audit record follows the exact same shape/conventions `DEVOS-086` already established (`actorType`, `actorId`, `action`, `targetType`, `targetId`, `outcome`) rather than inventing a divergent shape per operation family.

## Acceptance

Every operation named above produces a real audit record, verified against real Postgres, using the existing `listAuditRecordsForProject` read path with no changes needed there — only new write-side calls.
