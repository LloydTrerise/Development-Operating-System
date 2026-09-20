# DEVOS-190 — Real end-to-end pilot: relevance retrieval + share + install

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-187, DEVOS-188, DEVOS-189.
**Depended on by:** DEVOS-191.

## Scope

A real knowledge source moves from one project to another within the same organisation and is then genuinely preferred by real relevance retrieval over an unrelated source in the target project; a cross-organisation install attempt is confirmed to fail.

## Implementation

- New `tests/e2e/knowledge-platform-marketplace-pilot.test.ts`, mirroring `agent-platform-marketplace-pilot.test.ts`'s own established pattern.
- Scenario 1: a real knowledge source in project A (same organisation as the seeded org) is shared; installed into a real project B in the same organisation; a real, unrelated second knowledge source also exists in project B. A real workflow run in project B, for a work item whose title/description real-text-matches the installed source's content, confirms — via a direct Postgres query against `context_manifests`/the assembled context — that the installed source is selected ahead of the unrelated one.
- Scenario 2: an install attempt from a shared source into a project in a **different** organisation is confirmed to fail with `NotFoundError` (via a direct API call, `expect(status).toBe(404)`).
- Full real row cleanup afterward, mirroring the marketplace pilot's own FK-ordering discipline.

## Out of scope

Any Sprint 24 scenario (already covered by DEVOS-185).

## Acceptance

The new pilot test passes against the real, already-running local Postgres stack. Test data fully cleaned up afterward.
