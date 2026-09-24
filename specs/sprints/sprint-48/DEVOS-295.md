# DEVOS-295 — `AGENT_PROFILE` + `PRINCIPAL` row per named agent

**Priority:** P1
**Depends on:** Sprint 46 (real `PRINCIPAL` rows), Sprint 47 (access-role scoping).
**Depended on by:** DEVOS-296 (`accountable_owner_id`), DEVOS-297 (agent-attributed audit records).

## Scope

One `PRINCIPAL` row per named `agents` row (decision §9.4), shared across that agent's own `agent_versions` history — publishing a new version is a config change, not a new identity.

## Implementation

Migration `0050_agent_profiles.ts` creates `agent_profiles` (`agent_id` uuid PK/FK→`agents.id` `ON DELETE CASCADE`; `principal_id` text NOT NULL FK→`principals.id`; `accountable_owner_id` text FK→`principals.id`, nullable; `created_at`/`updated_at`) and backfills it with two set-based SQL statements (not a per-row loop — this environment has 26,594 real `agents` rows):

1. `INSERT INTO principals (id, principal_type, ...) SELECT id::text, 'AGENT', ... FROM agents ON CONFLICT DO NOTHING` — one `AGENT`-typed principal per existing agent, id reused verbatim (decision §9.4: the principal id **is** the agent id, mirroring `HumanProfile.principalId`'s identical reuse convention from migration `0045`).
2. `INSERT INTO agent_profiles ... SELECT a.id, a.id::text, owner.id, ... FROM agents a LEFT JOIN LATERAL (agent's own earliest agent_versions.created_by) ... LEFT JOIN principals owner ON ... principal_type = 'HUMAN'` — DEVOS-296's own resolution, folded into the same migration since it operates on the same backfill pass (see `DEVOS-296.md`).

`packages/domain/src/agents/agent-profile.ts` defines `AgentProfile { agentId; principalId; accountableOwnerId?; createdAt; updatedAt }` and `AgentProfileRepository { getByAgentId; create }`. `packages/database/src/repositories/agent-profiles.ts` implements the repository against the real table, and additionally exports `ensureAgentPrincipal(db, agent, createdBy)` — the real, **ongoing** counterpart to the migration's one-time backfill, called from both real agent-creation chokepoints (`create-agent-draft.ts`'s `createAgentDraftCreator`, used by `createAgent`/`installAgentVersion`; `create-project-with-clones.ts`'s `createProjectWithClonesCreator`, used by the project-type-template clone pipeline) so a newly created agent gets a real `PRINCIPAL`/`AGENT_PROFILE` row the moment it exists, not only ones that already existed at migration time. Neither chokepoint needed its own repository interface widened — both already receive the new `Agent` and its first `AgentVersion.createdBy` as parameters — so all 19 existing `AgentRepository` test fakes stay valid unmodified.

## Out of scope

`accountable_owner_id`'s own resolution semantics (DEVOS-296's own job, though implemented in the same migration/chokepoint code for real reasons — see that task's own file). Wiring agent-attributed audit records (DEVOS-297).

## Acceptance

`pnpm --filter @devos/database typecheck build` clean. Real Postgres confirms the backfill: one `agent_profiles` row per existing `agents` row, `agent_id === principal_id` for every row, a matching `principals` row with `principal_type = 'AGENT'` for every one.

## Actual results

Implemented as planned. Live-verified against real Postgres after running the migration:

```
count(*) from agent_profiles: 26594
count(*) from principals where principal_type='AGENT': 26594
sample rows — agent_id === principal_id for every one checked, e.g.:
  00000000-0000-4000-8000-000000000006 | 00000000-0000-4000-8000-000000000006 | seed-user
  00000000-0000-4000-8000-000000000008 | 00000000-0000-4000-8000-000000000008 | seed-user
```

**One real bug found and fixed, not just disclosed**: `agent_profiles.agent_id`'s FK to `agents.id` originally had no `ON DELETE CASCADE`, which broke several real e2e pilot tests' own cleanup code (`DELETE FROM agents ...`) with a foreign-key violation — found while running this sprint's own required full `tests/e2e` suite (DEVOS-298). Fixed by adding `ON DELETE CASCADE` to the migration and applying the equivalent live `ALTER TABLE` to keep the already-migrated real database in sync; full details in `DEVOS-298.md` and the sprint `README.md`'s own "Real bugs found and fixed" section. `pnpm --filter @devos/database typecheck build` clean; full monorepo validation (see `DEVOS-298.md`) confirms zero regression.
