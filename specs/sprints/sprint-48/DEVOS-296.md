# DEVOS-296 — `accountable_owner_id` backfill

**Priority:** P1
**Depends on:** DEVOS-295 (`agent_profiles` table).
**Depended on by:** DEVOS-298 (validation/disclosure).

## Scope

Every existing agent resolves a real, active human owner where possible; any agent whose creator does not resolve to one is flagged in this task's own disclosure, not silently defaulted.

## Implementation

`agents` (migration `0015`) has no `created_by` column of its own — only `agent_versions.created_by` does, a real, pre-existing, disclosed asymmetry (DEVOS-025's own task report; no spec documents either shape). `accountable_owner_id` therefore resolves from each agent's own **earliest** (`MIN(version)`) `agent_versions.created_by` — the only creator-attribution field that exists for an agent anywhere in this schema.

Folded into migration `0050`'s own set-based backfill (`DEVOS-295.md`) rather than a separate migration, since both operate on the exact same per-agent join: a `LEFT JOIN LATERAL` resolves each agent's earliest version's `created_by`, then a second `LEFT JOIN principals owner ON owner.id = earliest_version.created_by AND owner.principal_type = 'HUMAN'` accepts that id only when it actually names an already-backfilled human principal (Sprint 46's own DEVOS-284 backfill, which ran before this migration in the migration sequence). When it doesn't resolve, `owner.id` is `NULL` via the `LEFT JOIN`, and `accountable_owner_id` is written `NULL` — left absent, not fabricated, matching this codebase's own established "disclose the gap, don't invent data" convention (e.g. migration `0048`'s identical treatment of an unresolvable organisation owner).

The real, ongoing counterpart (`ensureAgentPrincipal()`, DEVOS-295's own chokepoint wiring) applies the identical resolution rule for every agent created going forward: `accountableOwnerId` is set only when the creating principal (`version.createdBy`) already resolves to a real `HUMAN` principal via `principals.getById()`.

## Out of scope

The `agent_profiles` table's own existence/shape (DEVOS-295). Any UI surfacing an agent's owner — not named by this sprint's own backlog scope (§6.3 has no UI story, unlike Sprint 47's DEVOS-293); a candidate for a future sprint, not fabricated here.

## Acceptance

Full monorepo validation green (see DEVOS-298). Real Postgres confirms every real agent's `accountable_owner_id` either resolves to a real `HUMAN` principal or is genuinely `NULL`, disclosed with a real count either way — not defaulted to a placeholder value.

## Actual results

Implemented as planned. Live-verified against real Postgres:

```
select count(*) from agent_versions v
where not exists (
  select 1 from principals p where p.id = v.created_by and p.principal_type = 'HUMAN'
);
→ 0
```

Every one of this environment's 26,594 real `agent_versions.created_by` values already resolves to a real, already-backfilled `HUMAN` principal — zero unresolvable owners in this environment, confirmed **before** writing the migration (a live query, not an assumption) and re-confirmed after: `select count(*) from agent_profiles where accountable_owner_id is null` → `0`. This is a real, disclosed fact about this specific environment's own accumulated data, not a claim that the resolution logic can never produce `NULL` — the migration's own `LEFT JOIN` and `ensureAgentPrincipal()`'s own `creator?.principalType === 'HUMAN'` check both still correctly produce an absent `accountableOwnerId` wherever the creator doesn't resolve, verified by code inspection since no real case exists in this environment to exercise it against. `seed.ts`'s own six seeded agents (a real, separate gap found and fixed — see `DEVOS-295.md`/`README.md`) all resolve `accountable_owner_id: SEED_PRINCIPAL_ID` for the same real reason: every seeded `agent_versions.created_by` already uses that same seeded human principal.
