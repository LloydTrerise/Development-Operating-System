# DEVOS-169 — Time-to-restore proxy (disclosed)

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** DEVOS-163/167 (release evidence rows), Sprint 12's Incident Response `ProjectType` (already shipped, DEVOS-124/125).
**Depended on by:** DEVOS-171 (dashboard renders this, with its disclosure text).

## Scope

Two real, separately labelled proxy figures — neither presented as a true, industry-standard MTTR, since no real incident-detection timestamp exists anywhere in this codebase (`specs/DEVOS-ENGINEERING-INTELLIGENCE-BACKLOG.md` §2/§10 already flagged this and got explicit user sign-off on the framing before this sprint began).

## Implementation

- `packages/domain/src/engineering-intelligence/compute-release-recovery-proxy.ts` (new, pure): given a project's chronological `RELEASE_EVIDENCE` sequence, for each entry with `passed: false` or `action: 'rollback'`, finds the next chronological entry with `passed: true` and computes the interval — `computeReleaseRecoveryProxyMs(releaseEvidence: {...}[]): number[]` (one figure per real failure-then-recovery pair found; a failure with no later successful release is excluded, not fabricated).
- `packages/application/src/engineering-intelligence/compute-incident-recovery-proxy.ts` (new, has I/O): for work items belonging to a project whose `ProjectType` is the Incident Response type (resolved via the project's own `projectTypeId`, matching how `ProjectTypesPage.tsx`/the seed data already identify it), computes `closedAt - createdAt` for each closed incident work item.
- Extend DEVOS-164's report shape with `dora.releaseRecoveryProxyMsMean` and, when the project/organisation has any Incident Response project, `dora.incidentRecoveryProxyMsMean` — each with a fixed, disclosed `label` string (e.g. `"release-failure-to-next-successful-deploy"` / `"incident-work-item-created-to-closed"`) the UI surfaces verbatim, per DEVOS-171's own disclosure requirement.

## Out of scope

Any real incident-detection/paging integration. Averaging the two proxy figures into one blended number — they must stay visibly distinct.

## Acceptance

Unit tests for `computeReleaseRecoveryProxyMs`: correct pairing across a real mixed sequence; a trailing unresolved failure excluded. Unit test for the incident-recovery use case: correctly scoped to Incident Response project types only; a project of a different type returns no incident figure (not zero — genuinely absent, distinguishable in the report shape). `pnpm --filter @devos/domain --filter @devos/application typecheck test` green.
