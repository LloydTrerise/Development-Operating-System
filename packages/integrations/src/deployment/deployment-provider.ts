/**
 * "Controlled staging deployment" (Stage 11 — Release,
 * specs/workflows/software-change-workflow.md §22; source description,
 * specs/sprints/sprint-06/DEVOS-074.md). No concrete deployment provider
 * contract exists anywhere in the spec corpus — this port exists so the
 * `deploy` capability (DEVOS-051-style registration, DEVOS-074) can be
 * wired to a real cloud/hosting provider without changing anything upstream
 * of it, exactly like `PullRequestProvider` (DEVOS-058). Sprints 6-8 built
 * and live-verified only a real-but-local implementation
 * (`createLocalStagingDeploymentProvider`), per that period's own scoping
 * decision.
 *
 * DEVOS-105 (Sprint 9) added a real one (`createRenderDeploymentProvider`)
 * behind this same port, and found `repositoryPath`/`deployedPath` are
 * local-filesystem semantics a real cloud target doesn't share (its own
 * flagged gap: "this is not a drop-in second implementation") — both are
 * now optional, populated only by the provider that actually uses them,
 * rather than widening `DeployRequest`/`DeploymentRecord` with fields most
 * providers would have to fake. `url` is the real-provider equivalent of
 * `deployedPath`: something real and inspectable about where the
 * deployment landed.
 */
export interface DeployRequest {
  environment: string;
  revision: string;
  /** Local-filesystem semantics — required only by `createLocalStagingDeploymentProvider`. */
  repositoryPath?: string;
}

export interface DeploymentRecord {
  id: string;
  environment: string;
  revision: string;
  /** A real on-disk checked-out path — populated only by `createLocalStagingDeploymentProvider`. */
  deployedPath?: string;
  /** A real inspectable URL/service reference — populated only by a real external provider (e.g. `createRenderDeploymentProvider`). */
  url?: string;
}

export interface DeploymentProvider {
  deploy: (request: DeployRequest) => Promise<DeploymentRecord>;
}
