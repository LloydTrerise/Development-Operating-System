# DEVOS-099 — Pilot environment

**Priority:** P0 | **Estimate:** 1d
**Depends on:** DEVOS-093–098 (the hardening this sprint's own pilot will run against).

## Scope

"Isolated deployment and seeded integrations" (source, verbatim). No real cloud/hosting provider deployment exists anywhere in this codebase, by the same carried-forward scoping decision unchanged since Sprint 4 — "isolated deployment" here means a real, reproducible, isolated local environment: its own Postgres database, its own seed data, real local git repositories for integration-touching work, standable-up and tearable-down from a clean state.

## Grounding

`infrastructure/docker/docker-compose.yml` already provisions a real local Postgres. `packages/database/src/seed.ts` already seeds a reference project/workflow/agents. Neither has ever been packaged as a distinct, named "pilot" profile separate from the shared development database this session (and prior sessions) have used for every sprint's own live verification.

## Flagged gap

No spec names an actual target cloud/hosting environment for a real pilot deployment — fabricating one would violate AGENTS.md §7. This task stands up a genuinely separate, isolated local environment (a distinct Postgres database/schema, freshly migrated and seeded), proving the _process_ of standing up an isolated environment is real and repeatable, without claiming a cloud deployment that was never authorized or specified.

## Acceptance

A fresh, isolated Postgres database is created, migrated, and seeded from a clean state using only the repository's own existing scripts, confirmed independent of the shared development database, then torn down — demonstrated as a real, repeatable procedure.
