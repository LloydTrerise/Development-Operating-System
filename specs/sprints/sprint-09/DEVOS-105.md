# DEVOS-105 — Real `DeploymentProvider` adapter

**Priority:** P0 | **Estimate:** 3d
**Depends on:** None (Sprint 8 complete). Should land before `DEVOS-108`.

## Scope

Build a real `DeploymentProvider` (`packages/integrations/src/deployment/deployment-provider.ts`) implementation for one actual external target platform (a real container registry + orchestrator, or a PaaS API) — `createXDeploymentProvider`, alongside the existing `createLocalStagingDeploymentProvider`.

## Grounding

`Analysis/DevOS_POC_Architecture_and_Implementation_Plan_v1.0.docx` §49 ("Architecture Evolution After POC") and `DEVOS-PRODUCTION-READINESS-ROADMAP.md` A2. No target platform is named anywhere in the spec corpus — choosing one (and recording why) is this task's own decision, same as every prior "no spec-mandated design" flag in this codebase's history (e.g. `CredentialResolver`'s own doc comment).

## Flagged gap — this is not a drop-in second implementation

`DeployRequest` (`repositoryPath`, `environment`, `revision`) is local-filesystem semantics: `createLocalStagingDeploymentProvider` copies files from `repositoryPath` into a local staging directory. A real cloud/container target does not deploy from a filesystem path — it deploys a built artifact (a container image reference, a build output) to a named environment. This task must either:

- extend `DeployRequest` with whatever the real target actually needs (an image reference, most likely) while keeping `repositoryPath` meaningful for the existing local implementation, or
- introduce a distinct request shape behind the same `deploy(...)` port if the two providers' natural inputs cannot share one shape without one of them faking fields it doesn't use.

Whichever is chosen, update `createDeploymentProviderAdapters` (`packages/application/src/tasks/deployment-provider-adapters.ts`) and every existing test that constructs a `DeployRequest`/`DeploymentRecord` — do not leave the local implementation behind a stale contract the real one had to diverge from.

## Acceptance

A real release-path run deploys a real revision to the real chosen target platform; the resulting `DeploymentRecord` resolves to something inspectable on that real platform (a real URL, a real running container/service reference) — recorded in this task's decision-log entry. `createLocalStagingDeploymentProvider` and its existing tests still pass unchanged (or are updated deliberately, not incidentally broken).
