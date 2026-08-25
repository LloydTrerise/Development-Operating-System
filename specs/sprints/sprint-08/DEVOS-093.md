# DEVOS-093 — Performance baseline

**Priority:** P0 | **Estimate:** 1d
**Depends on:** Sprint 7 complete (real metrics registry, DEVOS-087).

## Scope

"Workflow/task/agent/tool latency baselines" (source, verbatim). DEVOS-087 already built a real, in-process metrics registry (`workflow_task.duration_ms` histogram, labeled by `taskType`) and wired it into the worker's task dispatcher — but nothing anywhere can currently read that registry from outside the process it lives in. Establishing a "baseline" requires actually being able to capture and report real numbers after a real run, which today is impossible without attaching a debugger.

## Grounding

`specs/architecture/repository-code-structure.md` §24 (observability). No numeric latency target is specified anywhere in the spec corpus — this task establishes what the real numbers currently are, not what they "should" be.

## Flagged gap

No export/query surface exists for the metrics registry outside its own process. This task adds a minimal one (a periodic snapshot log line, or an equivalent low-effort mechanism) sufficient to capture real numbers from a real run — not a dashboard or external metrics backend, which stays out of scope.

## Acceptance

A real workflow run is executed against the real worker process; real latency numbers for at least one `AGENT_TASK` and one `TOOL_TASK` are captured from the real metrics registry and recorded as this task's baseline (in its own decision-log entry).
