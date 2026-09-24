# DEVOS-297 — Agent actions attributed to their own principal — no credential, no login

**Priority:** P1
**Depends on:** DEVOS-295 (`AGENT_PROFILE`/`PRINCIPAL` rows), DEVOS-296 (`accountable_owner_id`).
**Depended on by:** DEVOS-298 (validation/disclosure).

## Scope

The existing internal workflow/task-handler execution path (the only way an agent ever acts, per decision §9.7) records the agent's own `PRINCIPAL` id in `audit_records`/`created_by` fields instead of the triggering human's or run's id. Explicitly, no `AGENT_CREDENTIAL` table, no bearer token, no authentication path is added — confirmed as a deliberate exclusion in this task's own acceptance evidence, not an oversight.

## Implementation

### The real chokepoint: `runAgentTask`'s own context-manifest audit record

`runAgentTask` (`packages/application/src/tasks/run-agent-task.ts`) is the one real chokepoint every one of the six concrete agent-task handlers (discovery/requirements/technical-design/planning/development/review) already shares — it already resolves the real `Agent`/`AgentVersion` being executed, and it already calls `deps.recordContextManifest(manifest)` for **every single agent execution**, writing a real `context_manifest.created` audit record. Before this sprint that record was always attributed to the generic `devos-agent-runtime` system actor, regardless of which specific agent ran.

- `AuditActorType` (`packages/domain/src/audit/audit-record.ts`) widened from `'USER' | 'SYSTEM'` to `'USER' | 'SYSTEM' | 'AGENT'` — a real, additive third value distinguishing a specific agent's own action from both a human and the undifferentiated platform system actor. `apps/web`'s own `actorType: string` field (loosely typed already) needed no change; `GovernancePage.tsx`'s audit rendering is fully generic (renders whatever string arrives), needing no change either.
- `RecordContextManifest`'s type (declared separately in both `@devos/database`'s `record-context-manifest.ts` and `@devos/application`'s `tasks/deps.ts`, per this codebase's own existing package-boundary convention for `PublishArtifact`) widened from `(manifest) => Promise<void>` to `(manifest, actorId: string) => Promise<void>`. This is a real, deliberate behavior change (unlike an optional-and-additive widening) — but TypeScript's own "a function with fewer parameters is assignable to a type expecting more" leniency means every one of the 9 existing test files' own `async (manifest) => {...}` fakes still type-checks completely unmodified (JS ignores an extra argument a fake never reads).
- `createContextManifestRecorder`'s real implementation (`packages/database/src/repositories/record-context-manifest.ts`) now writes `actorType: 'AGENT'`, `actorId` (the passed argument) instead of the hardcoded `SYSTEM_ACTOR_ID`/`'SYSTEM'` — safe to hardcode `'AGENT'` here specifically because this function has exactly one production caller (`runAgentTask`), confirmed by a full-repository grep, and that caller always passes the resolved agent's own real principal id.
- `runAgentTask`'s own return value gains `agentId: agent.id` alongside the existing `agentVersionId`. Every one of its six concrete callers destructures `agentId` out explicitly (the identical existing pattern for `agentVersionId`, with the identical existing `as string`/`as AgentVersionId` cast need, since the function's own return type is `Record<string, unknown>`) — necessary so `agentId` never leaks into a spread `...modelOutput` and ends up stored inside an artifact's own metadata unintentionally.

### The six concrete handlers' own published-artifact attribution

Each of `run-discovery-agent-task.ts`/`run-requirements-agent-task.ts`/`run-technical-design-agent-task.ts`/`run-planning-agent-task.ts`/`run-development-agent-task.ts`/`run-review-agent-task.ts` published its own real output artifact with `createdBy: SYSTEM_ACTOR_ID` (`'devos-agent-runtime'`) on both the `Artifact` and its first `ArtifactVersion` — now `createdBy: agentId`, the specific resolved agent's own real principal id. `publish-artifact.ts`'s own actor-type resolution (previously a hardcoded `SYSTEM_ACTOR_IDS.has(createdBy) ? 'SYSTEM' : 'USER'` check) now does a real `principals` lookup (`resolveActorType()`) so an agent-authored artifact is correctly classified `'AGENT'`, not misclassified `'USER'` merely for not matching the old two-sentinel set.

## Disclosed, deliberate scope boundaries — not oversights

- **`invokeTool`'s own principal id stays `devos-agent-runtime`, unchanged**, in `run-development-agent-task.ts`'s three `invokeTool` calls (`repo-write`/`git-commit`/`pull-request-create`). `invokeTool`'s "Project Scope" step (`packages/tools/src/gateway/invoke-tool.ts`) actually **authorizes** against the passed principal — it needs a real project membership row to succeed, and only the seeded system actor has one (`SEED_AGENT_RUNTIME_MEMBERSHIP_ID`, DEVOS-052's own precedent). Switching this to the development agent's own principal id would require also granting every individual agent principal its own real project membership — a genuine, disclosed, out-of-scope expansion of this sprint's own access-grant surface, not something DEVOS-297's own attribution-only story authorizes. The development agent's own published `CODE_CHANGE` artifact is still correctly attributed to its own principal id (see above) — that is the real, durable per-agent attribution this task adds for that handler.
- **The automatic rework-run trigger in `runReviewAgentTask` (`startRunForVersion(deps, SYSTEM_ACTOR_ID, ...)`) stays attributed to the generic system actor.** Starting a new run on a `CHANGES_REQUIRED` decision is a platform orchestration decision this task's own code makes in response to the review agent's output, not the review agent's own produced action — the review agent's own real output (the `REVIEW_EVIDENCE` artifact) is attributed to its own principal id, unchanged from every other handler.
- **No `AGENT_CREDENTIAL` table, no bearer token, no authentication path was added anywhere.** Every agent action this sprint attributes still only ever happens through the existing internal workflow/task-handler execution path (`runAgentTask` and the six concrete handlers) — the only way an agent has ever acted in this codebase, per decision §9.7. `AGENT_PROFILE`/`accountable_owner_id` are attribution/ownership metadata only.

## Out of scope

`invokeTool`'s own actor id becoming agent-attributed (would need a real per-agent membership grant, a separate, disclosed decision — see above). Any UI surfacing agent attribution (not named by this sprint's own backlog scope). Job role catalogue (Sprint 49).

## Acceptance

Full monorepo validation green (see DEVOS-298). Live-verified that a real agent-run action appears in `audit_records` under its own principal id, not a human's, with zero new authentication surface introduced.

## Actual results

Implemented as planned, plus real live end-to-end verification against a real running `apps/api`/`apps/worker` (this task's own required proof, folded into DEVOS-298's own broader validation — see that file for the full real pilot run and its cleanup). A real planning-path run (discovery → requirements → technical-design → planning, all four real `AGENT_TASK` nodes) was started for real against the real seeded project; every one of its four real published artifacts, and every one of its four real `context_manifest.created` audit records, was confirmed attributed to its own agent's real principal id:

```
 artifact_type        | created_by (== the real agent's own id)             | principal_type
 DISCOVERY_REPORT      | 00000000-0000-4000-8000-000000000006 (discovery)   | AGENT
 PRD                   | 00000000-0000-4000-8000-000000000008 (requirements)| AGENT
 TECHNICAL_DESIGN      | 00000000-0000-4000-8000-00000000000a (tech-design) | AGENT
 IMPLEMENTATION_PLAN   | 00000000-0000-4000-8000-00000000000c (planning)    | AGENT

 action                    | actor_type | actor_id (== the same real agent ids above)
 context_manifest.created  | AGENT      | (×4, one per real agent above)
 artifact.created          | AGENT      | (×4, one per real agent above)
```

All eight real audit records genuinely appear under their own agent's real principal id, not `seed-user`'s (the human who started the run) and not `devos-agent-runtime` (the generic system actor). All pilot test data (work item, run, tasks, artifacts, artifact versions, agent executions, context manifests, audit records, the real planning-approval `Approval` row this seeded workflow's own `policies` marker creates) was fully cleaned up afterward in correct FK order, confirmed zero remaining rows.
