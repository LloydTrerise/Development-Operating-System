# Sprint 1 Known Limitations

Sprint 1's goal (`specs/sprints/sprint-01/README.md`) was proving the
control loop — work item → run → worker → artifact, durably, with events
and audit — not building a production system. This document lists what's
deliberately out of scope or simplified, so it's a documented decision
rather than a surprise. See `DEVOS-SPRINT1-DECISIONS.md` for the full
reasoning behind each one; this is the short, browsable version.

## Identity and access

- **No real authentication.** The API's bearer token _is_ the principal id
  (`@devos/identity`'s local provider) — there is no credential check, no
  OIDC, no session expiry. The web app has no login screen; it sends a
  fixed dev principal (`seed-user` by default) on every request. This is a
  deliberate placeholder for real identity, not a security control.
- **Single organisation.** Sprint 1 seeds and exercises exactly one
  organisation; there's no organisation-creation endpoint and multi-org
  isolation has never been tested. Project-level isolation (a non-member
  gets 404, not 403) is tested.
- **Two roles**, OWNER and MEMBER — no finer-grained permissions.

## Workflow lifecycle

- **One publish cycle per definition.** There's no "create a new draft
  after publishing" endpoint — once a workflow version is published, that
  definition can't be edited further. Fine for Sprint 1's one seeded
  workflow; would need addressing before workflows are iterated on in
  practice.
- **No version diff endpoint**, no pause/resume/cancel on a run, no
  manual retry endpoint, no dedicated run-timeline/events API. A run's
  status and its tasks are queryable; anything richer than that isn't
  built yet.
- **The web app's Runs page only shows runs started in the current browser
  session** — there's no "list runs for project" endpoint to load history
  on page refresh (see above).

## Task execution

- **One task type, one deterministic handler.** `runDiscoveryTask`
  (DEVOS-016) is a fixed, non-LLM stand-in for real agent execution — it
  always produces the same shape of `DISCOVERY_REPORT` artifact. Swapping
  in real agent execution is a Sprint 2+ concern; the queue/dispatcher
  interface was built to make that swap isolated (see the doc comment in
  `run-discovery-task.ts`).
- **Stale-task reclaim (DEVOS-024) is time-based polling, not a real
  heartbeat/lease.** A worker crashing mid-task is correctly recovered
  after `staleThresholdMs` (default 5 minutes). But there's no mechanism
  to distinguish "the worker died" from "the worker is still alive and
  just slow" — a task that legitimately runs longer than the threshold
  would be reclaimed and could be picked up by a second worker while the
  first is still processing it, risking double execution. Sprint 1's only
  task type completes in well under a second, so this is a theoretical
  risk here, not an observed one — but it's a real gap that would need a
  proper heartbeat/lease-renewal mechanism before task handlers can run
  for minutes rather than milliseconds.

## Storage, events, audit

- **Artifact storage is local filesystem only** (content-addressed,
  SHA-256-keyed), not S3/cloud object storage.
- **The outbox event publisher drains to a console-log sink** — there's no
  real message broker/event bus behind it yet. The transactional-outbox
  pattern itself (write the event in the same transaction as the state
  change, publish it idempotently after) is real and durable; only the
  downstream consumer is a stub.
- **The audit API has no query filtering** (no `?limit=`, no
  action/actor/date filters) — it returns the 100 most recent records for
  a project. The router has no query-string parsing at all yet.

## Infrastructure

- **CI (DEVOS-022) cannot enforce required-status-checks / branch
  protection** — this repository has no `git remote`. The workflow file
  is ready; branch protection is a GitHub repository setting that needs a
  real remote and admin access to configure (see
  `DEVOS-SPRINT1-DECISIONS.md`'s DEVOS-022 entry for the exact command).
- **Container images build the whole workspace**, not a pruned
  single-package deployment (`apps/api/Dockerfile`'s top comment explains
  why `pnpm deploy` wasn't used). Correct and simple, but larger than a
  production image would ideally be.
- **No observability stack.** `packages/observability` exists as an empty
  package boundary for Sprint 2+; there's no metrics/tracing/structured
  log aggregation today beyond what each process prints to stdout.
- **No policy engine or approval workflow.** `packages/policy` is an empty
  package boundary; policy/approval is explicitly Sprint 3 scope per
  `DEVOS-ROADMAP.md`.

## Testing

- **The web app has no component-level UI tests** (no
  `@testing-library/react` installed) and its rendering has never been
  visually confirmed in an actual browser by this agent — see DEVOS-007
  and DEVOS-020's entries in `DEVOS-BUILD-STATE.md` for the "no browser
  available" caveat. Typecheck, lint, a clean production build, and
  `api-client.ts` unit tests are the coverage that does exist.
- **`@devos/e2e-tests` is HTTP black-box only** — it doesn't drive the web
  UI at all (no browser automation), only the REST API and the worker
  process behind it.
