# DEVOS-124 — Scope the Incident Response workflow

**Priority:** P0 | **Estimate:** 1d
**Depends on:** None (Sprint 11 complete).

## Scope

Define the real graph shape for a new "Incident Response" workflow, the new tool capability handler(s) it needs, and the new agent role(s) it needs (if any) — per the source backlog document's own DEVOS-124 acceptance summary. This task's actual deliverable is the design recorded in `README.md`'s "The Incident Response workflow graph" section and the flagged scope decision above it; DEVOS-125 implements it.

## Chosen design (see `README.md` for full grounding)

**Graph** (workflow key `incident-response`, one workflow, one published version):

- **Nodes:**
  - `severity-check` — `CONDITION`, `config: { rule: { source: 'variable', path: 'severity', operator: 'equals', value: 'high' }, whenTrue: 'high', whenFalse: 'low' }`
  - `diagnose-and-notify` — `PARALLEL`, no config
  - `diagnose` — `TOOL_TASK` (new handler, taskKey `diagnose`)
  - `notify` — `TOOL_TASK` (new handler, taskKey `notify`)
  - `diagnosis-join` — `JOIN`, `config: { branchFailurePolicy: 'tolerant' }`
  - `await-confirmation` — `WAIT`, `config: { waitType: 'duration', durationSeconds: <real value, short enough for a fast test run and long enough to prove real wall-clock elapsed time, mirroring DEVOS-121's own >=900ms convention> }`
  - `remediation-approval` — `APPROVAL`, `config: { approvalType: 'incident-remediation' }`
  - `remediation` — `TOOL_TASK`, taskKey `rollback` (reuses `runReleaseRollbackTask` completely unchanged)
  - `log-only` — `TOOL_TASK` (new handler; taskKey `log-only` — matches the node's own `id`, per `task.taskKey` always being the node id; an earlier draft of this spec incorrectly said `incident-log`, caught by DEVOS-126's real e2e run and fixed in both `tool-task-router.ts` and here)
- **Edges:**
  - `{ from: 'severity-check', to: 'diagnose-and-notify', branch: 'high' }`
  - `{ from: 'severity-check', to: 'log-only', branch: 'low' }`
  - `{ from: 'diagnose-and-notify', to: 'diagnose' }`
  - `{ from: 'diagnose-and-notify', to: 'notify' }`
  - `{ from: 'diagnose', to: 'diagnosis-join' }`
  - `{ from: 'notify', to: 'diagnosis-join' }`
  - `{ from: 'diagnosis-join', to: 'await-confirmation' }`
  - `{ from: 'await-confirmation', to: 'remediation-approval' }`
  - `{ from: 'remediation-approval', to: 'remediation' }`
- **Inputs:** `workItemId` (`WORK_ITEM`, required), `severity` (`STRING`, required), `rollbackToRevision` (`STRING`, not required — only actually read by `remediation` on the high-severity path, matching `SEED_RELEASE_ROLLBACK_WORKFLOW_GRAPH`'s own input contract for the same underlying handler).
- **Policies:** none — no whole-run approval gate marker; the graph-native `APPROVAL` node is the only approval mechanism this workflow uses.

**New `TOOL_TASK` handlers** (`packages/application/src/tasks/`, registered in `apps/worker/src/tool-task-router.ts`'s `routeToolTask` switch, following the exact `runReleaseReadinessCheckTask`/`runClosureTask` pattern — deterministic, real Postgres/artifact-storage writes, no Git checkout, no Tool Gateway):

- `run-diagnose-incident-task.ts` (`runDiagnoseIncidentTask`, taskKey `diagnose`) — publishes a real `INCIDENT_DIAGNOSIS_EVIDENCE` artifact (status `GENERATED`) recording the run's own input and a deterministic summary.
- `run-notify-stakeholders-task.ts` (`runNotifyStakeholdersTask`, taskKey `notify`) — publishes a real `STATUS_UPDATE` artifact (status `GENERATED`), disclosed as a local stand-in for a real paging/status-page provider (no such provider exists in this codebase, matching Sprint 4–9's carried-forward real-vs-simulated scoping discipline).
- `run-incident-log-task.ts` (`runIncidentLogTask`, taskKey `log-only`) — publishes a real `INCIDENT_LOG_ENTRY` artifact (status `GENERATED`) for the low-severity path.

No new row in `SEED_TOOL_CAPABILITIES` — none of these three call `invokeTool`.

**New agent roles:** none — confirmed by the user ("i dont want a real new agent role built this sprint", 2026-09-18), resolving the one real fork this task surfaced (see `README.md`'s scope-decision section).

## Out of scope

Implementing the above (DEVOS-125). A real external paging/status-page provider. Any new agent role.

## Acceptance

This design is recorded (in `README.md` and this file), the one real fork it surfaced (whether to build a new agent role) is resolved by explicit user confirmation, and — per the source backlog's own acceptance summary — what this sprint deliberately does not build for real (a new agent role; a real external notification provider) is disclosed rather than fabricated.

**DEVOS-124 is COMPLETE.** No code changes were required — this task's own deliverable is the design decision, which is now recorded and confirmed.
