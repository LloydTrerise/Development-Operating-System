# DEVOS-284 — `PRINCIPAL` + `HUMAN_PROFILE` tables, human backfill

**Priority:** P1
**Depends on:** none.
**Depended on by:** DEVOS-285, DEVOS-286.

## Scope

New `principals`/`human_profiles` tables (migration `0045_principals.ts`). One `PRINCIPAL`+`HUMAN_PROFILE` row backfilled for every distinct human actor id currently referenced by `memberships.principal_id`/`audit_records.actor_id`, keyed by email where resolvable. Zero change to any existing route's behavior.

## Implementation

- `principals.id` is `text`, deliberately identical to the existing bare actor-id string this codebase already writes (an OIDC `sub` claim, or a dev-mode bearer token) — not a freshly-minted UUID. No existing membership/audit lookup changes; they gain a real row to resolve through.
- `principal_type` is `'HUMAN'` for every row this sprint writes (`'AGENT'` exists for Sprint 48).
- Backfill excludes `'devos-agent-runtime'` (the one known system actor, seeded by DEVOS-052) by literal value — Sprint 46 is human identity only.
- `human_profiles.email`/`display_name` are nullable — no email is resolvable from any pre-existing data.
- `packages/domain/src/principals/principal.ts` — `Principal`, `PrincipalType`, `PrincipalRepository`, `HumanProfile`, `HumanProfileRepository`.
- `packages/database/src/repositories/principals.ts`/`human-profiles.ts` — real Postgres-backed implementations.
- `packages/database/src/seed.ts` — seeds the same invariant for `SEED_PRINCIPAL_ID` ('seed-user') directly, since `seed.ts` inserts memberships via raw SQL, bypassing the repository this sprint's migration/DEVOS-286 both rely on; a fresh (migrate + seed, no prior history) database would otherwise never backfill it, since migration `0045`'s own backfill only sees data that already exists at migration time.

## Out of scope

Agent principals (Sprint 48). Any hard foreign-key constraint from `memberships.principal_id`/`audit_records.actor_id` to `principals.id` — not every existing actor id (`devos-agent-runtime`) is backed by one yet, so such a constraint would break real seeded data.

## Acceptance

`pnpm --filter @devos/database typecheck build` clean. Migration runs clean against real Postgres. Every distinct pre-existing human actor id in `memberships`/`audit_records` gets exactly one `principals`+`human_profiles` row; `devos-agent-runtime` gets none.

## Actual results

Implemented as planned, with one real, live-verified bug found and fixed during implementation: `devos-agent-runtime`'s own `audit_records` rows are not consistently stamped `actor_type: 'SYSTEM'` — some carry `'USER'` instead (a pre-existing inconsistency in whatever code paths write those records, out of this task's own scope to correct). The migration's original backfill query only excluded `devos-agent-runtime` from its `memberships`-sourced branch; running it for real against this environment's own accumulated Postgres data showed the `audit_records`-sourced branch re-admitted it as a false "human" (confirmed via direct query: `principals` contained `devos-agent-runtime` with `principal_type: 'HUMAN'` after the first run). Fixed by excluding the literal actor id from both source queries in the migration, then correcting the one incorrectly-created row directly against the already-migrated database (`delete from human_profiles/principals where id = 'devos-agent-runtime'`) so live state matches what the corrected migration produces — the same "found a real bug during live verification, fixed it, and corrected any already-applied side effect" precedent this codebase has used since Sprint 27.

Live-verified against real Postgres (the environment's own accumulated dev database, populated by every prior sprint's own e2e/pilot runs): the backfill created exactly 231 real `principals`/`human_profiles` rows (232 before the `devos-agent-runtime` correction) for genuinely distinct actor ids accumulated across this codebase's entire build history (e.g. `devos-115-e2e-*`, `devos-118-e2e-*`), `seed-user` included, `devos-agent-runtime` excluded, zero `memberships.principal_id` left without a backing `principals` row, and zero `human_profiles.email` populated (confirmed — no email has ever been stored anywhere in this codebase's pre-existing data, disclosed rather than fabricated). `pnpm --filter @devos/database typecheck lint test build` clean.
