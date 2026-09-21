# DEVOS-198 — Real reliability-signal query at approval-creation time

**Priority:** P0 | **Estimate:** 2d
**Depends on:** none.
**Depended on by:** DEVOS-199.

## Scope

A real, query-time read of a project's own already-captured reliability data (`computeAgentVersionQuality`), returning a three-way answer — threshold met, threshold unmet, or insufficient sample — that DEVOS-199 will consult before reducing an approval requirement. Zero new data capture.

## Implementation

- `packages/domain/src/agents/resolve-reliability-signal.ts` (new): a pure function `resolveReliabilitySignal(qualities: AgentVersionQuality[], agentVersionId: string, minPassRate: number, minSampleSize: number): 'MET' | 'UNMET' | 'INSUFFICIENT_SAMPLE'` — looks up `agentVersionId` in the already-computed `AgentVersionQuality[]` (from `computeAgentVersionQuality`, `packages/domain/src/agents/compute-agent-version-quality.ts`, unchanged); no matching row, or `reviewCount < minSampleSize`, returns `'INSUFFICIENT_SAMPLE'`; else `'MET'` if `passRate >= minPassRate` else `'UNMET'`. Pure, no I/O — mirrors `computeAgentVersionQuality`'s own pure-function shape exactly, so DEVOS-199's caller supplies the already-fetched evidence rather than this function reaching into a repository itself.
- `packages/application/src/approval/resolve-approval-reliability.ts` (new): the I/O-performing wrapper `resolveApprovalReliability(deps, projectId, agentVersionId, minPassRate, minSampleSize)` — fetches `REVIEW_EVIDENCE`/`CODE_CHANGE` evidence for the project (`deps.artifacts.listEvidenceForProject`, the exact same two calls `getAgentQuality` already makes, `packages/application/src/agents/get-agent-quality.ts:33-36`), computes `computeAgentVersionQuality`, and calls the new pure function above. Reuses `AgentUseCaseDeps`'s existing `artifacts` dependency shape — no new port.
- `packages/domain/src/agents/index.ts` / `packages/application/src/approval/index.ts` (or equivalent barrels): export the new function/type.

## Out of scope

Any change to `computeAgentVersionQuality`, `getAgentQuality`, or the `GET /agents/:agentId/quality` route — all reused completely unchanged. Any new stored "reliability score" — this remains a compute-on-read query, mirroring `aggregateEngineeringEvidence`'s own established convention.

## Acceptance

New unit tests (`packages/domain/tests/resolve-reliability-signal.test.ts`): threshold met; threshold unmet (real data, real rate below minimum); insufficient sample (fewer reviews than `minSampleSize`, even with a 100% pass rate — proving a brand-new agent version cannot accidentally qualify); no data at all for the given `agentVersionId`. New unit test for `resolveApprovalReliability` (`packages/application/tests/resolve-approval-reliability.test.ts`) confirming it correctly wires real evidence rows into the pure function. `pnpm --filter @devos/domain --filter @devos/application typecheck test` green.
