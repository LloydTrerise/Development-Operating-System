# DEVOS-095 — UX refinement

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** none within this sprint.

## Scope

"Operational workflow and approval usability" (source, verbatim). No wireframe or UX spec exists anywhere in the corpus — the same "build to a real, already-identified gap" precedent DEVOS-046/060/070/080/090 already established for un-wireframed UI work.

## Grounding

`apps/web/src/pages/ApprovalsPage.tsx`'s own doc comment already flags a real, concrete gap: "Evidence is shown as the raw `artifactVersionIds` the approval is scoped to — resolving those into full artifact names/content would need a new artifact-version lookup endpoint this task doesn't add; flagged as a real, if minor, gap." A reviewer deciding an approval today sees only opaque UUIDs for the evidence they are approving, not what it actually is.

## Flagged gap

Resolving an evidence artifact-version id to its owning artifact's name/type is a real, boundedly-scoped usability fix, not a redesign — no new capability, just surfacing data that already exists (`Artifact.name`/`artifactType`) instead of a raw id.

## Acceptance

The Approvals page shows each evidence artifact version's owning artifact name and type, not just its raw id, verified in a real browser against a real approval with real evidence.
