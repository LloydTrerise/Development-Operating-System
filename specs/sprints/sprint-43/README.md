# Sprint 43 — Notifications UI

**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.16 (E28 UI/UX Redesign & Full Functional Coverage, fourteenth sprint).
**Conversion date:** 2026-09-23
**Status:** Converted per explicit user instruction ("proceed", then "Proceed with sprint. Run through sprint fully without waiting for authorisation after each task. Stop once sprint is done", 2026-09-23, in direct response to a position report naming Sprint 43 as the recorded next action). Depends on Sprint 42's `Notification` entity/routes (`GET /notifications`, `PATCH /notifications/:id/read`), unchanged.

## Goal

Wire the header notification bell — present in the mockup (`Design/DevOS.dc.html:102-105`) as a static badge, never backed by a real component anywhere in `apps/web` — to Sprint 42's real routes, with each notification deep-linking to its real target per `ui-spec.txt` §29's own Notification/Action table, wherever a real target route exists.

## Grounding (confirmed by direct code inspection before scoping)

- **The mockup's bell is a real, specific element, not a paraphrase**: `Design/DevOS.dc.html:102-105`, an icon button (`ph-bell`) with a small absolutely-positioned count badge (hardcoded `3`), sitting in the header's real-time cluster next to the theme toggle. `App.tsx`'s `AppBar` has no notification affordance today (confirmed by grep — no `notification`/`bell` reference anywhere in `apps/web/src/App.tsx` before this sprint), the same "mockup element never wired" situation DEVOS-264 found for the search box.
- **`Notification.type` reuses the real `EventType` that fired; `referenceType`/`referenceId` mirror the triggering envelope's own `aggregateType`/`aggregateId`** (`packages/domain/src/notifications/notification.ts`, unchanged since Sprint 42). Grepping every real `createEventEnvelope(...)` call site in `packages/database/src/repositories/` (`task-queue.ts`, `start-workflow-run.ts`, `publish-artifact.ts`, `approval-run-transition.ts`) plus `run-approval-task.ts`'s own inline envelope construction shows only **four** `aggregateType` values are ever actually produced today: `'Approval'`, `'WorkflowRun'`, `'WorkflowTask'`, `'Artifact'`. `EventType` also lists `AgentExecutionStarted`/`AgentExecutionCompleted`/`ToolInvocationStarted`/`ToolInvocationCompleted`/`ValidationFailed`/`ArtifactPublished`, but no real envelope of any of those types is constructed anywhere in this codebase — `ui-spec.txt` §29's "Agent blocked"/"Integration failure"/"Security warning" mockup categories have no real triggering event to date. DEVOS-271's label/deep-link mapping is built to cover the full `EventType` union (so it never silently mishandles a future real trigger) but is only genuinely exercised, live, for the four aggregate types above.
- **Real deep-link targets, confirmed present or absent by direct route/page inspection, not assumed from the backlog's own "approval/run/artifact/integration" wording**:
  - `Approval` → `/approvals?approvalId=<id>` (`ApprovalsPage.tsx`'s own established convention since Sprint 31/32 — selects the approval directly into the detail pane, project-selection-dependent since the page loads via `listApprovalsForProject(selectedProjectId)`; a real, disclosed limitation, not this sprint's to fix, mirroring every prior sprint's own "disclose don't invent" precedent).
  - `WorkflowRun` → `/runs/<id>` (`RunDetailPage.tsx`, Sprint 41 gap closure — fetches by run id directly via `getRun(id)`, independent of the selected project).
  - `Artifact` → `/artifacts/<id>` (`ArtifactViewerPage.tsx`, Sprint 35 — likewise fetches by id directly, project-independent).
  - `WorkflowTask` → **no real target exists**. `referenceId` for this type is a task id, not a run id; no route anywhere in this codebase (`GET /tasks/:id` or equivalent) resolves a bare task id back to its owning run (confirmed by grep across every route file — only `GET /runs/:runId/tasks`, list-by-run, exists). The backlog's own DEVOS-271 acceptance text names "approval/run/artifact/integration" as the four target kinds — notably not "task" — consistent with this being a known, accepted gap rather than an oversight. A `WorkflowTask`-type notification renders with its label and timestamp but no clickable link, disclosed inline in the UI itself (not silently hidden).
  - `Integration` → **no real per-integration route exists** (Sprint 36's own already-disclosed finding, reconfirmed here: no `GET /integrations/:id` route anywhere). No real envelope with `aggregateType: 'Integration'` is ever constructed either (grepped above), so this case is currently unreachable in practice — the mapping still routes it to the list page (`/integrations`), the closest real target, for defensiveness only, matching Sprint 36's own "list only, no id route" precedent rather than inventing a detail route.
- **No project-scoping on `Notification` itself** (`packages/database/migrations/0043_notifications.ts`'s own disclosed decision — no `organisation_id`/`project_id` column). This is why the `Approval` deep-link is disclosed as project-selection-dependent above: the notification bell has no way to know which project a given approval belongs to without first opening it, and `ApprovalsPage.tsx` was never built to accept a bare id without a project context. Not a regression this sprint introduces — a pre-existing shape decision from Sprint 42.
- **No client wrapper exists yet for either Sprint 42 route** (confirmed by grep — no `notifications` reference anywhere in `apps/web/src/api-client.ts`), so DEVOS-271 adds both from scratch, following the same `request<T>()` wrapper convention as every prior sprint's own additions (most recently DEVOS-264's `searchProject`).

## In scope

- **DEVOS-271** — `Notification` type, `listNotifications`, `markNotificationRead` in `apps/web/src/api-client.ts`; a new `features/notifications/` module (label/deep-link mapping, a `NotificationBell` component); wired into `App.tsx`'s `AppBar` in the same real-time cluster the mockup places it (next to the theme toggle).
- **DEVOS-272** — Full monorepo validation; the full real `tests/e2e` suite; a real end-to-end proof (a real triggering event produces a real notification row, and the bell renders it with a working deep link for at least one of the three real, routable target kinds).

## Out of scope

Any change to `Notification`'s own shape, the Sprint 42 routes, or the outbox/drain mechanism. Any "mark all as read" bulk action — no bulk route exists, and the backlog does not name one. Any notification-preference/mute/digest/email/push mechanism. Any project-scoping addition to `Notification` to fix the disclosed `Approval` deep-link limitation above — a candidate follow-up, not this sprint's to invent. Any per-task detail route to resolve the disclosed `WorkflowTask` deep-link gap above — same reasoning.

## Task index

| ID        | Story                                         | File           |
| --------- | ---------------------------------------------- | -------------- |
| DEVOS-271 | Notification bell and list                    | `DEVOS-271.md` |
| DEVOS-272 | Validation, documentation, and gap disclosure | `DEVOS-272.md` |
