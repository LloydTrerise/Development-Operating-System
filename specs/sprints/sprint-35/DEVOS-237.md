# DEVOS-237 — Artifact version history & diff

**Priority:** P1
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.7

## Acceptance summary

Uses `listArtifactVersions`/`GET /artifacts/:id/versions/:v`: a version list plus a diff between two versions where the content type supports it (text-based artifacts at minimum), per `ui-spec.txt` §19/§20.

## Scope

- New `apps/web/src/features/artifacts/diff-lines.ts`: a small, pure, unit-tested `diffLines(a: string, b: string): DiffLine[]` line-based diff (classic LCS backtrack; no new dependency, per `AGENTS.md` §11 — see `README.md`'s own grounding that no diff library exists anywhere in this monorepo today). `DiffLine = { type: 'unchanged' | 'added' | 'removed'; text: string }`.
- `ArtifactViewerPage.tsx` (from DEVOS-236) gains:
  - A version-history table (every version from `listArtifactVersions`, newest first: version number, `createdBy`, `createdAt`), each row selectable into the header's version `Select`.
  - A "Compare versions" panel: two version-number `Select`s (defaulting to the two most recent versions when 2+ exist); renders `diffLines` over each version's pretty-printed `metadata` JSON (falling back to a `contentType`/`contentHash` one-line comparison when neither version has `metadata`), with added/removed/unchanged line styling (`success.light`/`error.light`/no highlight backgrounds, matching `StatusChip`'s existing success/error color convention). Disclosed inline as a metadata diff, not a raw-content diff (no route serves decoded artifact bytes).
  - Hidden entirely (not rendered) when an artifact has fewer than 2 versions.

## Out of scope

Diffing raw file content (unavailable — no content-serving route exists). A third-party diff library. Diffing any field beyond `metadata`/`contentType`/`contentHash`.

## Validation

`pnpm --filter @devos/web typecheck lint test build`; new `apps/web/tests/diff-lines.test.ts` (4 cases: identical inputs, empty-left, empty-right, a real mixed single-line change) — each expected output independently hand-verified against the LCS algorithm's own backtrack before being asserted, not just accepted from a first run. `pnpm --filter @devos/web test`: **42/42 green**.

**A real, disclosed finding made while attempting live 2-version verification, not assumed**: a direct Postgres query against the real seeded "DevOS POC" project (`select artifact_id, count(*) from artifact_versions av join artifacts a on a.id = av.artifact_id where a.project_id = '<project-id>' group by artifact_id having count(*) >= 2` — 0 rows, out of 2548 real artifacts) and a direct source search (no `version + 1`/version-increment logic anywhere in `packages/application/src`) both confirm **no code path in this codebase ever creates a second version of an existing artifact today** — `POST /projects/:projectId/artifacts` always creates version 1 of a brand-new artifact, and there is no route/use-case to append a version to an existing one. The version-history/diff UI is built correctly against the real, versioned `GET /artifacts/:id/versions`/`GET /artifacts/:id/versions/:v` contract (proven by the `diffLines` unit tests plus a live single-version artifact's Content/Viewer rendering) but is genuinely unexercised end-to-end against real multi-version data, since none exists or can be produced through any real code path today. Not fabricated via a direct-SQL synthetic second version, consistent with this codebase's own "real API calls only, no fabricated backend state" verification discipline.
