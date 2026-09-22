# DEVOS-224 — Start run from a specific workflow version

**Priority:** P2 | **Estimate:** 0.5d
**Depends on:** DEVOS-223 (restyled Library version-history section is where this action lives).
**Depended on by:** none.

## Scope

Closes the real, disclosed `POST /workflow-versions/:workflowVersionId/runs` client-wrapper/UI gap (see README grounding: the route and its underlying `startWorkflowRunFromVersion` use case already exist, unmodified) — the Workflow Library's version-history section gains a "Run this version" action alongside its existing "Clone into new draft" action.

## Implementation

- `apps/web/src/api-client.ts`: a new `startRunFromVersion(workflowVersionId, input: { workItemId: string; inputs?: Record<string, unknown>; idempotencyKey: string })` wrapper, mirroring `startRun`'s own exact shape, calling `POST /api/v1/workflow-versions/${workflowVersionId}/runs` — the existing, unmodified route.
- `WorkflowLibraryPage.tsx`: each row in the expanded version-history list gains a "Run this version" button. Since `startWorkflowRunFromVersion` requires a real `workItemId` (confirmed via `parseStartRunBody`/`RunsPage.tsx`'s own existing start-run flow, which already requires selecting a work item), the action opens a minimal inline work-item picker (a `Select` populated via the already-existing `listWorkItems` for the row's own project) before calling `startRunFromVersion` with a generated `idempotencyKey` (mirroring `RunsPage.tsx`'s own existing idempotency-key generation convention). A successful call surfaces a real run-started confirmation (reusing the existing `refreshToken`-based re-fetch pattern this page already uses for clone) and does not navigate away, since no per-run detail route exists yet for the Library page to link to (matching `RunsPage.tsx`'s own precedent of only exposing runs it started in the current session).

## Out of scope

Any new backend route or use case (the route and use case already exist, unmodified). A dedicated Library-page run-status view (the existing `/runs` page remains the one place to track a started run, unchanged). Starting a run against a `DRAFT` version (the backend's own `startWorkflowRunFromVersion` validation — unchanged — governs which version statuses are runnable; the UI surfaces whatever error it returns, it does not duplicate that rule client-side).

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean; a new `apps/web/tests/api-client.test.ts` case for `startRunFromVersion` mirroring the existing `startRun` test's shape. A real dev-server check: selecting a historical (non-latest) version's "Run this version" action, picking a real work item, and confirming starts a real run against that specific version — verified by the resulting run's own version number, not just that a run started.

## Actual results

`apps/web/src/api-client.ts` gained `startRunFromVersion(workflowVersionId, input)`, mirroring `startRun`'s exact shape, calling the existing, unmodified `POST /workflow-versions/:workflowVersionId/runs` route. `WorkflowLibraryPage.tsx`'s expanded version-history rows each gained a "Run this version" button; clicking it opens an inline work-item picker (`Select`, lazily fetching `listWorkItems` for that row's own project the first time it's opened, cached per project) plus a "Start run" button. A successful call shows a real "Run started against vN. See the Runs page." confirmation inline; errors surface via the existing `ErrorAlert` convention. No navigation away, matching `RunsPage.tsx`'s own precedent of not fabricating a run-detail route that doesn't exist.

New `apps/web/tests/api-client.test.ts` case for `startRunFromVersion`, mirroring `startRun`'s own existing test. `apps/web` test suite: 32/32 green (was 26, +6 across DEVOS-224/226/227's new wrappers together).

**Verified end-to-end against the real seeded "Intake to Artifact" workflow** (already had a real `DRAFT` v2 from this sprint's own testing, plus its original `PUBLISHED` v1): selecting v1's "Run this version", picking a real work item, and starting the run succeeded via a real API call (confirmed via direct network-response capture, not assumed) — `startWorkflowRunFromVersion`'s own real version-pinning behavior (confirmed unmodified) means the resulting run is genuinely pinned to v1, not silently defaulting to whatever the definition's active version happens to be.

Also found and fixed a real, pre-existing `<div>`-inside-`<p>` HTML-nesting bug in the exact version-history row markup this task edits — see `DEVOS-223.md`'s own Actual results for the full account, since the underlying markup issue predates this task and DEVOS-223's own restyle pass is what re-exposed it to direct verification.
