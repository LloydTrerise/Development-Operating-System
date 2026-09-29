# DEVOS-339 — Backfill every pre-existing organisation via a new, narrow exemption field

**Priority:** P1
**Depends on:** None directly (independent of DEVOS-337's own code, per the sprint README — they share only an agreed field shape). Must land, migrated and backfilled against real data, **before** DEVOS-338's route wiring is exposed to real traffic (see the sprint README's "real dependency order" disclosure).
**Depended on by:** DEVOS-337 (the guard reads this field); DEVOS-338 (real wiring is only safe once this task's backfill has run); DEVOS-340 (validation).

## ⚠ This task carries the sprint's disclosed backfill-mechanism decision — see the sprint README

The backlog's own DEVOS-339 assumes a stored `INITIALISED` value to backfill, mirroring `specs/sprints/sprint-50/DEVOS-305.md`'s literal `UPDATE`-a-column precedent. Sprint 58 persists no such value. The sprint README's own "⚠ Disclosed decision" section records the full reasoning for the option this task implements instead — re-read it before starting.

## Scope

Add a new, narrow, nullable field to `Organisation` recording only _whether this organisation is grandfathered out of the initialisation gate_, and backfill it for every organisation that exists as of this sprint's migration. This field is never consulted by `getOrganisationInitialisationStatus` (Sprint 58's own live computation stays completely unchanged) — it is consulted only by DEVOS-337's guard, as an up-front bypass.

## Implementation

Migration `0062_organisations_add_initialisation_enforcement_exempt.ts`:

- `ALTER TABLE organisations ADD COLUMN initialisation_enforcement_exempt_at timestamptz;` (nullable; no default — every row inserted after this migration, including every organisation `createOrganisation` creates from this point forward, leaves it `NULL`).
- A single, real, set-based backfill statement, mirroring migration `0055`'s own precedent exactly: `UPDATE organisations SET initialisation_enforcement_exempt_at = now() WHERE initialisation_enforcement_exempt_at IS NULL;` — every organisation that exists at the moment this migration runs is marked exempt in one statement, regardless of its real underlying `hasProjectType`/`hasLlmProvider`/`hasPolicy` status (the point is grandfathering, not judging them retroactively).
- `down()` is a deliberate no-op for the same reason migration `0055`'s own `down()` is: once run, there is no way to distinguish "exempted by this migration's own backfill" from "exempted by some later, legitimate process," if one is ever introduced. Confirm this reasoning still holds at implementation time (no such later process exists anywhere in this epic's own scope, so it is expected to hold).

`packages/domain/src/organisations/organisation.ts`'s `Organisation` interface gains:

```ts
export interface Organisation {
  // ...existing fields unchanged...
  /**
   * DEVOS-339: set once, by this sprint's own backfill migration, for every
   * organisation that existed before server-side initialisation enforcement
   * went live — never set for any organisation created afterward. Consulted
   * only by `requireOrganisationInitialised` (DEVOS-337) as an up-front
   * bypass; `getOrganisationInitialisationStatus` (Sprint 58) never reads
   * this field and its own live computation is completely unaffected by it.
   */
  initialisationEnforcementExemptAt?: string;
}
```

`OrganisationRepository` gains one new, narrow method, mirroring `setOwnerPrincipalId`'s own precedent (a distinct-semantics field gets its own method rather than folding into the generic `update()`):

```ts
export interface OrganisationRepository {
  // ...existing methods unchanged...
  /** DEVOS-339: used only by this sprint's own migration-adjacent backfill
   * path and, in principle, by any future explicit exemption grant — no
   * production use case in this sprint's own scope calls this directly
   * outside the migration itself, which writes the column via raw SQL. */
  markInitialisationEnforcementExempt?: (id: OrganisationId, exemptAt: string) => Promise<void>;
}
```

(Whether a repository method is actually needed — versus the migration's own raw SQL being sufficient, since nothing in this sprint's own use-case layer ever sets this field outside the one-time backfill — is confirmed/simplified at implementation time; the interface above is this task's best-grounded draft, disclosed as possibly unnecessary ceremony if the migration alone suffices.)

`packages/database/src/database.ts`'s generated table type for `organisations` gains the new nullable column; `packages/database/src/repositories/organisations.ts`'s `toDomain` mapping gains the new field (mirroring exactly how `ownerPrincipalId`'s own nullable column is already mapped).

## Out of scope

The guard that consults this field (DEVOS-337). Any UI. Any mechanism for granting this exemption to an organisation created _after_ this sprint ships — per backlog §4, there is none; every organisation created from this point forward is subject to genuine enforcement with no grandfathering path.

## Acceptance

`pnpm --filter @devos/domain build` clean with the widened `Organisation` interface compiling. `pnpm --filter @devos/database typecheck lint test build` clean. A fresh migration run against a test database creates the column and, given pre-existing seeded organisation rows, backfills every one of them with a non-null `initialisation_enforcement_exempt_at`. A new organisation created via `createOrganisation` after the migration has run has `initialisationEnforcementExemptAt: undefined`. Live-verified against real Postgres in DEVOS-340 that a genuinely pre-existing (pre-Sprint-59) organisation's mutating routes remain completely unaffected by DEVOS-338's new gate, while a newly created organisation is genuinely subject to it.
