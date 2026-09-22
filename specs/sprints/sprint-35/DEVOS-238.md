# DEVOS-238 — Replace hardcoded version references with real navigation

**Priority:** P1
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.7

## Acceptance summary

`RunsPage`'s hardcoded version-1 evidence fetch and Approvals' evidence-name-only resolution both link through to the real Artifact Viewer instead, closing the "partial" verdicts the audit found for `GET /artifacts/:id/versions/:v` and `GET /artifact-versions/:id`.

## Scope

- `apps/web/src/features/runs/RunCard.tsx`:
  - The Artifacts accordion's `ListItem` rows gain a `RouterLink` to `/artifacts/${artifact.id}` alongside the existing name/type/status display.
  - The Test evidence and Review evidence accordions each gain a "View in Artifact Viewer" `RouterLink` to `/artifacts/${testEvidence.artifactId}` / `/artifacts/${reviewEvidence.artifactId}` (both already real fields on the fetched `ArtifactVersion`). The existing hardcoded `getArtifactVersion(artifact.id, 1)` fetches are unchanged — they still drive the inline Decision/Passed summary; the new link is additive, giving access to the artifact's full version history/diff without assuming version 1 is the only one that matters.
- `apps/web/src/features/approvals/ApprovalsPage.tsx`:
  - `EvidenceDetail` widened to `{ artifactId: string; artifactName: string; artifactType: string } | 'error'` (both new fields already present on `ArtifactVersionWithArtifact`, the existing `getArtifactVersionById` response type — zero new fetch).
  - The Evidence list's `ListItemText` rows become `RouterLink`s to `/artifacts/${detail.artifactId}` when resolved, replacing the current plain-text `<strong>{name}</strong> ({type})` display.

## Out of scope

Any change to `getArtifactVersion`/`getArtifactVersionById`/`listApprovalsForRun`/`listApprovalsForProject` semantics. Removing the existing hardcoded version-1 fetches in `RunCard.tsx` (they still serve a real, correct purpose — showing the latest evidence inline — independent of the new full-viewer link).

## Validation

`pnpm --filter @devos/web typecheck lint build`. Manual verification against a real running dev server: a real completed run's Test/Review evidence links navigate to the correct artifact in the new Viewer; a real approval's evidence links do the same.
