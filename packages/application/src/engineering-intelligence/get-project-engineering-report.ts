import type { ProjectId } from '@devos/contracts';
import type {
  ArtifactEvidenceRow,
  ArtifactRepository,
  RecoveryProxySummary,
  WorkItemReworkCount,
} from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import {
  aggregateEngineeringEvidence,
  DEFAULT_DORA_PERIOD_DAYS,
  type QualityReport,
} from './aggregate-evidence.js';
import { computeIncidentRecoveryProxyForProject } from './compute-incident-recovery-proxy.js';
import type { EngineeringIntelligenceUseCaseDeps } from './deps.js';

export interface ProjectEngineeringReport extends QualityReport {
  projectId: ProjectId;
  /** DEVOS-169: present only for a project whose `ProjectType` is the seeded Incident Response type — see `computeIncidentRecoveryProxyForProject`'s own doc comment. */
  incidentRecoveryProxy?: RecoveryProxySummary;
}

async function evidenceFor(
  artifacts: ArtifactRepository,
  projectId: ProjectId,
  artifactType: string,
): Promise<ArtifactEvidenceRow[]> {
  return artifacts.listEvidenceForProject
    ? artifacts.listEvidenceForProject(projectId, artifactType)
    : [];
}

/**
 * DEVOS-164: the real project-scoped engineering-intelligence report —
 * pre-aggregated (mirroring `OrganisationCostReport`'s own report shape,
 * not a bare filtered artifact array like `listArtifactsForProject`).
 * Gated by the same membership check `getProjectCostSummary` already
 * establishes. Every new repository method is optional (only the real
 * Postgres repository implements them); a fake lacking one simply reports
 * an empty evidence set rather than throwing, matching
 * `getProjectCostSummary`'s own established no-op-when-absent convention.
 */
export async function getProjectEngineeringReport(
  deps: EngineeringIntelligenceUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
  period?: { start: string; end: string },
): Promise<ProjectEngineeringReport> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  const [review, test, securityScan, release, codeChange, reworkCycles, incidentRecoveryProxy] =
    await Promise.all([
      evidenceFor(deps.artifacts, projectId, 'REVIEW_EVIDENCE'),
      evidenceFor(deps.artifacts, projectId, 'TEST_EVIDENCE'),
      evidenceFor(deps.artifacts, projectId, 'SECURITY_SCAN_EVIDENCE'),
      evidenceFor(deps.artifacts, projectId, 'RELEASE_EVIDENCE'),
      evidenceFor(deps.artifacts, projectId, 'CODE_CHANGE'),
      deps.workItems.countReworkCyclesForProject
        ? deps.workItems.countReworkCyclesForProject(projectId)
        : Promise.resolve<WorkItemReworkCount[]>([]),
      computeIncidentRecoveryProxyForProject(deps, projectId),
    ]);

  const resolvedPeriod = period ?? {
    start: new Date(Date.now() - DEFAULT_DORA_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  };

  return {
    projectId,
    ...(incidentRecoveryProxy !== undefined ? { incidentRecoveryProxy } : {}),
    ...aggregateEngineeringEvidence(
      { review, test, securityScan, release, codeChange, reworkCycles },
      resolvedPeriod,
    ),
  };
}
