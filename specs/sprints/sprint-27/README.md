# Sprint 27 — Real Second Provider Adapter & Explicit Provider Selection

**Source:** `specs/DEVOS-AUTONOMY-INTEGRATION-BACKLOG.md` §6.1 (E27, Integration Adapter Expansion thread).
**Conversion date:** 2026-09-20
**Status:** Converted and authorized to begin, per explicit user approval ("proceed") of the backlog document.

## Goal

`packages/integrations`'s `PullRequestProvider`/`DeploymentProvider` ports were built provider-agnostic in Sprint 9 (DEVOS-104–108) but have had only one real implementation each (GitHub, Render) ever since. This sprint adds a second real `PullRequestProvider` implementation (GitLab), replaces the two task handlers' implicit binary inference ("does `.github` exist" / "does any `ACTIVE` Deployment integration exist") with an explicit provider-discriminator convention, and closes a real, pre-existing gap the backlog's own grounding found: there is no `apps/api` route for `Integration` CRUD at all today — `createIntegration`/`listIntegrations` exist and are tested but are only ever called from seed/e2e-test code, never through HTTP, for GitHub/Render integrations exactly as much as for any new one.

## Grounding (confirmed by direct code inspection before scoping — see the backlog document §2.2 for full citations)

- `PullRequestProvider` (`packages/integrations/src/pull-requests/pull-request-provider.ts:28-30`) and `DeploymentProvider` (`packages/integrations/src/deployment/deployment-provider.ts:40-42`) are both single-method, already provider-agnostic interfaces — no interface change is needed for a second implementation.
- Provider selection is a hardcoded two-branch if/else per task handler (`run-development-agent-task.ts`'s `resolveGitHubContext`/`github-context.ts`; `run-release-task.ts`'s `resolveReleaseTarget`), not an N-way registry — neither reads an explicit tag.
- No CI or Jira provider port exists anywhere in the codebase (confirmed absent by whole-repo grep) — building either would be a brand-new port, not an extension, and is explicitly out of scope for this sprint (backlog §9/§10 Decision 3).
- `packages/application/src/integrations/{create-integration,list-integrations,get-integration}.ts` exist and are unit-tested but have zero `apps/api` route — confirmed by grep across `apps/api/src` (zero matches for "Integration").

## Real design decisions this sprint's own grounding surfaced

1. **A discriminator, not a new interface.** `Integration.configuration` gains an explicit `provider` string field; both resolvers become a switch on that field with a fallback to today's exact inference when the field is absent — zero behaviour change for every already-configured integration.
2. **GitLab, not a new port.** The backlog document (§2.2, §9) found that extending an existing, already-provider-agnostic port is far more concretely scoped than building a brand-new CI or Jira port from nothing; GitLab is chosen as the second real `PullRequestProvider` implementation because it mirrors GitHub's own shape almost exactly (a real hosted Git platform with a REST merge-request API).
3. **The missing `Integration` route is this sprint's problem to fix, not defer**, because DEVOS-196's own pilot needs a real way to configure a second provider without reaching into application-layer code directly — the same "wire the missing route to an existing use case" pattern DEVOS-135/183 already each established.
4. **Only `POST`/`GET` routes, not full CRUD.** `PATCH`/`DELETE` and any web UI for integrations are explicitly deferred (backlog §9) — this sprint adds only what its own pilot requires.

## In scope

- **DEVOS-194** — Explicit provider discriminator + first-ever `Integration` API route.
- **DEVOS-195** — Real GitLab `PullRequestProvider` implementation.
- **DEVOS-196** — Real end-to-end pilot: GitHub and GitLab side by side.
- **DEVOS-197** — Validation, documentation, and gap disclosure.

## Out of scope

A brand-new CI or Jira provider port (backlog §9/§10 Decision 3 — a materially larger, un-derisked scope). A second real `DeploymentProvider` implementation. The remaining `PATCH`/`DELETE` half of `Integration` CRUD, or any web UI for integrations. Any part of Sprint 28 (the separate, independent Risk-Based Approval Gate Reduction thread of the same epic).

## Task index

| ID        | Story                                                                 | File           |
| --------- | ---------------------------------------------------------------------- | -------------- |
| DEVOS-194 | Explicit provider discriminator + first-ever `Integration` API route   | `DEVOS-194.md` |
| DEVOS-195 | Real GitLab `PullRequestProvider` implementation                       | `DEVOS-195.md` |
| DEVOS-196 | Real end-to-end pilot: GitHub and GitLab side by side                  | `DEVOS-196.md` |
| DEVOS-197 | Validation, documentation, and gap disclosure                          | `DEVOS-197.md` |
