# DEVOS-318 — Validation, documentation, and gap disclosure

**Priority:** P1
**Depends on:** DEVOS-314, DEVOS-315, DEVOS-316, DEVOS-317.

## Scope

Full monorepo validation; a real end-to-end proof that each registered provider is genuinely invoked when selected; explicit written confirmation of what changed and what didn't; disclosure of any real gaps found.

## Real gaps found and fixed during this sprint (not merely disclosed)

Recorded in full in `DEVOS-316.md`'s own "Real, disclosed test-fixture gap" section: 5 existing `@devos/application` test files supplied a `ProjectRepository` fake that always returned `null`, previously harmless (the old, conditional budget-check code path never actually called it in these files) but surfaced as a real failure by this sprint's own new, unconditional project lookup in `run-agent-task.ts`. Fixed by giving each scenario a real, matching `Project` object — not a change to any assertion, a previously-unexercised fake made real, mirroring the exact class of gap Sprint 48/49/50 each found in their own migrations (a real invariant a prior sprint's own tests never happened to exercise).

A second real finding, not a bug: neither a real `GEMINI_API_KEY` nor a real `ANTHROPIC_API_KEY` is configured in this development environment. `.env`'s own `GEMINI_API_KEY` line was confirmed, via a direct length check (`awk -F= '/^GEMINI_API_KEY=/{print length($2)}'`), to be a blank scaffold value (length 0) — not the real credential this sprint's initial position report assumed was present. Both providers' own real end-to-end proof below therefore uses a real local HTTP server standing in for each provider's own real API, mirroring Sprint 27's own identical "no live GitHub/GitLab credential exists in this environment" precedent for DEVOS-196's pilot.

## Validation

Package-scoped, run in dependency order:

- `pnpm --filter @devos/contracts build` — clean (unchanged).
- `pnpm --filter @devos/agents build`/`typecheck`/`lint`/`test` — clean; **54/54 tests** (up from 37 before this sprint: +9 `anthropic.test.ts`, +4 `registry.test.ts`, +3 `resolving-model-adapter.test.ts`, +1 `pricing.test.ts`).
- `pnpm --filter @devos/config build`/`typecheck`/`lint`/`test` — clean; **20/20 tests** (up from 18: +2 `DEVOS-315/316` cases).
- `pnpm --filter @devos/domain build` — clean (unchanged).
- `pnpm --filter @devos/application build`/`typecheck`/`test`/`lint` — clean; **389/389 tests**, matching Sprint 51's own baseline exactly (the 5 fixture fixes are corrections to existing tests, net zero new/removed test count).
- `pnpm --filter @devos/worker build`/`typecheck`/`lint`/`test` — clean; **49/49 tests** (unchanged).
- `pnpm --filter @devos/api build`/`typecheck`/`test`/`lint` — clean; **117/117 tests** (unchanged).

Full monorepo: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests' --force` **76/76 green** (forced/uncached), matching Sprint 52's own baseline exactly.

`prettier --write` applied to every file this sprint touched (26 files); re-verified clean via `prettier --check` — the only remaining formatting warnings belong to pre-existing files this sprint never touched (`fixture-model-adapter.ts`, `fixture-repository.ts`, `prompt-repository.ts`, `schema-repository.ts`, `validate-output.ts` and their tests, `config/src/index.ts`), disclosed as a pre-existing, out-of-scope condition, not introduced here.

## Real end-to-end proof (this task's own required scope)

Via a real, disposable script (`packages/agents/debug-devos318.mjs`, deleted immediately after use, per `DEVOS-311.md`'s own established convention for this class of throwaway verification), against the real, built `@devos/agents` package:

1. **Gemini, via a real local HTTP server**: a real `node:http` server, listening on a real loopback port, standing in for the real Gemini `generateContent` endpoint. `createResolvingModelAdapter({ defaultProvider: 'gemini', defaultCredential: 'fake-local-key', baseUrlsByProvider: { gemini: <real local server URL> } })` was invoked for real — the real request hit `/models/gemini-3.6-flash:generateContent` with a real `x-goog-api-key` header, and the real (locally-served) JSON response was correctly parsed into a `SUCCEEDED` result with the correct `usage` mapping.
2. **Anthropic, via a real local HTTP server**: the same pattern, standing in for the real Anthropic Messages API. The real request hit `/messages` with a real `x-api-key` header and the real `model: "claude-sonnet-5"` field in its body; the real (locally-served) JSON response was correctly parsed into a `SUCCEEDED` result with the correct `usage` mapping.
3. **Confirms the correct provider is genuinely selected**: switching `defaultProvider` between `'gemini'`/`'anthropic'` genuinely changed which real HTTP endpoint shape was constructed and hit (`/models/.../generateContent` with `x-goog-api-key` vs. `/messages` with `x-api-key`) — proving `createResolvingModelAdapter`'s real per-call registry lookup, not an assumption from code review alone.
4. **Cleanup**: both local servers closed; the script itself deleted immediately after use; confirmed via `git status` that no stray file was left behind.

## Zero-regression proof

Full monorepo validation (`76/76 green`, forced/uncached) and the full real `tests/e2e` suite (`pnpm --filter @devos/e2e-tests test`) both re-ran clean: **27/27 files, 52/52 tests green**, exactly matching Sprint 52's own baseline — confirming that widening `AgentInvocationRequest`, replacing the worker's boot-time adapter construction, and adding the new config fields changed zero existing route's, use case's, workflow's, or agent task's *observable* behavior end-to-end (the real, disclosed architectural change is internal to how the adapter gets constructed, not to what it produces for the still-single, still-default-provider path every existing test and pilot exercises).

## Gap disclosure

- No code path anywhere in this codebase yet reads `organisation_llm_providers` (Sprint 52's own dormant table) — `request.organisationId` is real and threaded through on every call, but genuinely unconsulted for provider selection. Sprint 54 is the first sprint that changes this.
- No access-role gating exists yet on which provider gets used — moot today (there is no UI or route to configure a per-organisation choice at all), but named here since Sprint 54 is what adds both the real selection logic and its own write-gate together.
- Neither provider has a real live credential configured in this development environment (see "Real gaps found" above) — this sprint's own live-provider proof is real (real HTTP, real TCP, real request/response parsing) but against local stand-in servers, not each provider's actual live API. A live smoke test against the real Gemini/Anthropic APIs, if desired, is a manual follow-up requiring real credentials, not part of this sprint's own automated or disposable-script evidence.
- The pre-existing, cross-cutting API `500` handler observability gap (disclosed in Sprints 49/50/51/52, declined for fixing multiple times already) remains unrelated and untouched — this sprint added no new route.

Per the user's own established governance, no further sprint begins automatically; awaiting explicit authorization before Sprint 54 (Ranked Fallback & Access Control UI).
