# DEVOS-118 — Move rate limiting to a shared store

**Priority:** P1 | **Estimate:** 1d
**Depends on:** None (Sprint 8 complete).

## Scope

The real in-process rate limiter (`apps/api/src/http/rate-limiter.ts`, DEVOS-091) does not survive a restart and does not coordinate across multiple API instances. Move it to a shared store (e.g. Redis) so both hold true before any real horizontal scaling of `apps/api`.

## Grounding

`DEVOS-PRODUCTION-READINESS-ROADMAP.md` B2, Sprint 7 (DEVOS-091) — "a single-process deployment model was the only one ever authorized for this POC."

## Flagged gap

Confirm `createRateLimiter`'s existing call sites (`apps/api/src/app.ts`, and its overridable-for-tests pattern in `apps/api/tests/app.test.ts`/`rate-limiter.test.ts`) continue to work with a swapped-in shared-store implementation without changing their own shape — mirror the same "swap the backing implementation behind an unchanged interface" pattern this sprint's other tasks already use.

## Acceptance

Two real `apps/api` processes sharing one real Redis instance correctly enforce one combined rate limit across both — verified by a real test that starts two processes and confirms the limit is shared, not per-process.
