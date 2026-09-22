# DEVOS-236 — Artifact Viewer

**Priority:** P0
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.7

## Acceptance summary

Real detail view (Sprint 29's routing convention) per `ui-spec.txt` §20: header (type/version/status), content, metadata, provenance (via DEVOS-234's new wrapper), relationships.

## Scope

- New `apps/web/src/features/artifacts/ArtifactViewerPage.tsx` at `/artifacts/:id` (`DetailPageLayout`, `backTo="/artifacts"`):
  - Fetches `getArtifactForPrincipal(id)`, `listArtifactVersions(id)`, `getArtifactProvenance(id)` in parallel.
  - **Header**: artifact name, `type`, `status` (`StatusChip`), plus a version `Select` (defaults to the latest version) showing that version's own `status`-equivalent (`contentType`) and number.
  - **Content**: the selected version's `contentType`, `contentUri`, `contentHash` (real pointer fields), plus its `metadata` pretty-printed as JSON when present — disclosed inline as the closest real substitute for a raw-content preview, since no route in this codebase serves decoded artifact bytes (see `README.md`'s own grounding).
  - **Metadata panel**: project name (resolved via `ProjectContext`'s already-loaded `projects` list, falling back to the raw id), the selected version's `createdBy`, `createdAt`.
  - **Provenance panel**: the `getArtifactProvenance` result (`workflowRunId`/`workflowTaskId`, each linking to `/runs` when present), with an inline disclosure that this is the same data already shown in the artifact's own header/metadata — `getArtifactProvenance` returns no richer trace, confirmed by direct code inspection (see `README.md`'s own grounding).
  - **Relationships panel**: when the selected version's `metadata.derivedFromArtifactId` is present (real for evidence artifacts), a link to that artifact's own Viewer page; otherwise "No relationship data for this version," disclosed as a one-hop signal only, not a full upstream/downstream graph.
- `apps/web/src/App.tsx`: add the `/artifacts/:id` route.

## Out of scope

A raw file-content viewer. A "Review" panel (comments/approval linkage) — not named in this story's own acceptance text; the existing Approvals page already surfaces evidence-to-approval linkage from the approval's own side. "Validation" panel (ui-spec.txt §20) — no per-artifact quality-result record exists separate from evidence artifacts' own `metadata`, already shown in Content. A richer provenance model (`origin`/`agent`/`contextManifestId` — not implemented by any real code path).

## Validation

`pnpm --filter @devos/web typecheck lint build`. Manual verification against a real running dev server (Playwright): a real evidence artifact (e.g. `REVIEW_EVIDENCE` from a completed run) opened at `/artifacts/:id` shows its real `decision`/`findings` in Content, its real `derivedFromArtifactId` relationship link (when present) navigating correctly to the source `CODE_CHANGE` artifact's own Viewer page.
