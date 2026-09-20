# DEVOS-174 — Real per-agent-version quality signal

**Priority:** P1 | **Estimate:** 2.5d
**Depends on:** none beyond already-real data (`CODE_CHANGE.metadata.agentVersionId`, `REVIEW_EVIDENCE.metadata.derivedFromArtifactId`) and E24's own `listEvidenceForProject`/`ArtifactEvidenceRow` (DEVOS-163), reused directly.
**Depended on by:** DEVOS-175 (pilot verifies this), Sprint 23's DEVOS-179 (selection tie-break reads this).

## Scope

A real pass/rework rate per developer `AgentVersion`, computed by joining `REVIEW_EVIDENCE.derivedFromArtifactId` → `CODE_CHANGE.metadata.agentVersionId` — real data already captured, zero new capture.

## Implementation

- `packages/domain/src/agents/compute-agent-version-quality.ts` (new, pure, mirroring `aggregateEngineeringEvidence`'s established pattern): given a project's real `REVIEW_EVIDENCE` and `CODE_CHANGE` evidence rows (`ArtifactEvidenceRow[]`, from `@devos/domain`'s E24-era type), builds a `Map<codeChangeArtifactId, developerAgentVersionId>` from the `CODE_CHANGE` rows, then for each `REVIEW_EVIDENCE` row looks up its `derivedFromArtifactId` in that map and attributes its `decision` to the resolved developer `AgentVersion`; returns `{ agentVersionId, reviewCount, passCount, passRate }[]`. A `REVIEW_EVIDENCE` row whose `derivedFromArtifactId` doesn't resolve to a known `CODE_CHANGE` is excluded, not fabricated into a `0`.
- `packages/application/src/agents/get-agent-quality.ts` (new): resolves an `Agent`'s membership (mirroring every other agent use case), fetches the project's real evidence rows via `deps.artifacts.listEvidenceForProject` (DEVOS-163, reused directly — `@devos/application`'s `agents` module gains an `artifacts: ArtifactRepository` dependency), computes the above, and filters to rows matching this agent's own `AgentVersion` ids.
- `apps/api/src/routes/agents.ts`: new `GET /agents/:agentId/quality` route.
- `apps/web/src/pages/AgentsPage.tsx`: a new section per agent rendering each version's real pass rate, labelled exactly "Review pass rate" — never a general "quality score."

## Out of scope

Any new capture (both fields already exist). Aggregating across agents/projects (this is per-agent-version, single-project scope, matching the epic's own project-first framing). The full `EvaluationPolicy` model (§9 of the backlog document).

## Acceptance

Unit tests for `computeAgentVersionQuality`: a real `CODE_CHANGE` → `REVIEW_EVIDENCE` pair attributes correctly to the developer agent version; a `REVIEW_EVIDENCE` with no resolvable `CODE_CHANGE` is excluded, not zeroed; two distinct agent versions produce two distinct, correct rates. `pnpm --filter @devos/domain --filter @devos/application --filter @devos/api typecheck test` green.
