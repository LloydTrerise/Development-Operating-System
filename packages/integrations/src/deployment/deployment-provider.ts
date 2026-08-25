/**
 * "Controlled staging deployment" (Stage 11 — Release,
 * specs/workflows/software-change-workflow.md §22; source description,
 * specs/sprints/sprint-06/DEVOS-074.md). No concrete deployment provider
 * contract exists anywhere in the spec corpus — this port exists so the
 * `deploy` capability (DEVOS-051-style registration, DEVOS-074) can be
 * wired to a real cloud/hosting provider later without changing anything
 * upstream of it, exactly like `PullRequestProvider` (DEVOS-058). Per this
 * sprint's user-authorized scoping decision (no real external deployment
 * provider — staging only, real-but-local), only
 * `createLocalStagingDeploymentProvider` is built and live-verified this
 * sprint.
 */
export interface DeployRequest {
  repositoryPath: string;
  environment: string;
  revision: string;
}

export interface DeploymentRecord {
  id: string;
  environment: string;
  revision: string;
  deployedPath: string;
}

export interface DeploymentProvider {
  deploy: (request: DeployRequest) => Promise<DeploymentRecord>;
}
