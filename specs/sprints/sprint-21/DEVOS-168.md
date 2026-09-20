# DEVOS-168 — Lead time for changes via provenance walk

**Priority:** P0 | **Estimate:** 2d
**Depends on:** none beyond the already-shipped `getArtifactProvenance` (DEVOS-095) and DEVOS-163's query layer.
**Depended on by:** DEVOS-171 (dashboard renders this).

## Scope

A new function computes the real interval between a `CODE_CHANGE` artifact's `generatedAt` and the `completedAt` of the first `passed: true` `RELEASE_EVIDENCE` reachable through its own `derivedFromArtifactId` chain.

## Implementation

**Corrected during implementation, disclosed here rather than left stale:** `getArtifactProvenance` (DEVOS-095) does not actually walk `derivedFromArtifactId` at all — direct inspection (`packages/application/src/artifacts/get-artifact-provenance.ts`) showed it only returns an artifact's own `workflowRunId`/`workflowTaskId`. Further inspection of every real evidence-writing task handler found the real chain is simpler than planned: `run-validation-task.ts`/`run-security-scan-task.ts`/`run-review-agent-task.ts`/`run-release-task.ts` each independently set `derivedFromArtifactId` to the _same_ project's latest `CODE_CHANGE` artifact directly — a flat one-hop fan-out from one `CODE_CHANGE`, not a linear multi-hop chain. So no provenance-walk extension is needed at all:

- `packages/domain/src/engineering-intelligence/compute-lead-time.ts` (new, pure): `computeLeadTimeMs(codeChangeGeneratedAt, releaseCompletedAt): number` and `summarizeLeadTimes(samplesMs: number[]): LeadTimeSummary` (`sampleCount`/`leadTimeMsP50`/`leadTimeMsMean`, `0`s on an empty sample set, not `NaN`).
- `packages/application/src/engineering-intelligence/aggregate-evidence.ts`: `EvidenceRows` gains a `codeChange: ArtifactEvidenceRow[]` field (fetched via DEVOS-163's already-generic `listEvidenceForProject`/`listEvidenceForOrganisation('CODE_CHANGE')` — no new repository method). For each `passed: true` `RELEASE_EVIDENCE` row, its `metadata.derivedFromArtifactId` is looked up directly in a `Map` of `CODE_CHANGE` artifact id → `generatedAt`; a match produces one lead-time sample. `CODE_CHANGE`s with no matching release simply never appear in the map lookup — excluded, not fabricated as `0`.
- `getProjectEngineeringReport`/`getOrganisationEngineeringReport` (DEVOS-164) both fetch the extra `CODE_CHANGE` evidence rows and pass them through; `QualityReport` gains a top-level `leadTime: LeadTimeSummary` field (not nested under `dora`, since it is a distinct DORA metric, not a release-count-derived one).

## Out of scope

Any change to `getArtifactProvenance` itself or its existing callers/tests — unaffected. Fabricating a lead time for a `CODE_CHANGE` with no matched release.

## Acceptance

Unit tests for `computeLeadTimeMs`/`summarizeLeadTimes` (`packages/domain/tests/compute-lead-time.test.ts`): correct interval; correct median for odd/even sample counts; `0`s on empty input. Unit test for `aggregateEngineeringEvidence` (`packages/application/tests/engineering-intelligence.test.ts`): a real `CODE_CHANGE` → `RELEASE_EVIDENCE` pair (via `derivedFromArtifactId`) produces exactly one real lead-time sample; a second, unreleased `CODE_CHANGE` is correctly excluded, not errored or zeroed. A real Postgres + real running `apps/api` e2e test (`tests/e2e/engineering-intelligence-reporting.test.ts`) proves the same end to end. `pnpm --filter @devos/domain --filter @devos/application --filter @devos/api typecheck test` green; `getArtifactProvenance`'s own existing tests pass unmodified.
