# DEVOS-196 — Real end-to-end pilot: GitHub and GitLab side by side

**Priority:** P0 | **Estimate:** 1.5d
**Depends on:** DEVOS-194, DEVOS-195.
**Depended on by:** DEVOS-197.

## Scope

Live, independent confirmation that a project can be configured — entirely through DEVOS-194's new real API — to open a pull request against a real GitHub repository, and a second, separate project can be configured the same way to open a real merge request against a real GitLab repository, using the exact same unchanged `pull-request-create` capability and Tool Gateway path for both.

## Pilot procedure

1. A real project's Git integration is created via `POST /projects/:projectId/integrations` with `provider: 'github'` and a real `configuration.github.{owner,repo}` target against a real (test) GitHub repository — reusing this codebase's own already-established real-GitHub pilot precedent (Sprint 9's `devos-pilot-test`).
2. A real development-agent workflow task runs against that project; the resulting real GitHub pull request is confirmed via a direct, real GitHub API call (not code inspection) — the exact same confirmation shape Sprint 9's own pilot already used.
3. A second real project's Git integration is created via the same real API route with `provider: 'gitlab'` and a real `configuration.gitlab.{projectId}` target against a real (test) GitLab project.
4. An equivalent real development-agent workflow task runs against that second project; the resulting real GitLab merge request is confirmed via a direct, real GitLab API call.
5. Both real pull/merge requests, and both `Integration` rows, are cleaned up (closed/deleted) afterward — this codebase's own established "clean up after a real pilot" convention (every prior epic's own final pilot story).

## Out of scope

Any change to the development agent's own prompt, plan, or code-change logic — this pilot exercises only the provider-selection and PR/MR-creation path, which is provider-agnostic by design (§2.2 of the backlog document).

## Acceptance

Both pull/merge requests are independently confirmed real (via each provider's own API, not application logs or database rows alone). The GitHub path is confirmed byte-for-byte unchanged in behaviour from before this sprint (same request shape, same resulting PR). Test data (both PRs/MRs, both Integration rows, and their credentials) cleaned up afterward, confirmed by a follow-up real API call showing neither remains open.

## Real deviation from this task's own original pilot procedure (disclosed, not silently substituted)

No live GitHub or GitLab account/credential is available in this environment
— confirmed empty `.env`/shell env, and this session deliberately does not
speculatively enumerate Vault's stored secrets to go looking for one (a
security-conscious guard, not an oversight). Presented with this, the user
explicitly chose a real local HTTP server substitute over providing live
credentials or skipping the pilot.

What was actually built and run, in
`packages/application/tests/run-development-agent-task.test.ts`'s own new
`describe('DEVOS-196: real local HTTP server pilot — GitHub and GitLab side
by side', ...)`:

- Two real `http.createServer` instances (real TCP sockets, real ephemeral
  ports via `.listen(0)`), one shaped like GitHub's `pulls` REST endpoint,
  one like GitLab's `merge_requests` endpoint — each stateful across calls
  (a real idempotency check against a real server, not a scripted mock
  response queue, unlike the two `vi.stubGlobal`-mocked tests directly
  above this block).
- `fetch` is stubbed only to rewrite `api.github.com`/`gitlab.com` to
  `127.0.0.1:<real ephemeral port>`, then forwards to the real, unstubbed
  `fetch` — every other part of the request (method, path, query params,
  headers, body) reaches the real local server completely unmodified.
- Both scenarios run through the real, complete `runDevelopmentAgentTask`
  handler end to end — real git branch/commit against a real local
  repository, the real Tool Gateway's `pull-request-create` capability,
  real credential resolution — exactly the same code path a live pilot
  would exercise, with only the external HTTP endpoint substituted.
- Each result is independently confirmed via a second, real HTTP `GET` to
  the local server (not a return value or database row), and a repeated
  task run is confirmed genuinely idempotent (one real `POST` total across
  two real task executions) against the real server's own real state.

**What this does not prove**: genuine compatibility with GitHub.com's or
GitLab.com's real production API (rate limiting, auth-token validation,
real response-shape edge cases, TLS). That gap is real and open — closing
it requires either a real GitHub PAT + test repo and a real GitLab PAT +
test project (mirroring Sprint 9's own `devos-pilot-test` precedent), or an
explicit decision to accept this substitute as sufficient ongoing
verification. Recorded here, not silently presented as a live pilot.
