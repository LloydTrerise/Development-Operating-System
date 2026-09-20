import type { OrganisationId } from '@devos/contracts';
import type { ArtifactEvidenceRow, ArtifactRepository } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveOrganisationMembership } from '../organisations/membership-access.js';
import {
  aggregateEngineeringEvidence,
  DEFAULT_DORA_PERIOD_DAYS,
  type QualityReport,
} from './aggregate-evidence.js';
import type { EngineeringIntelligenceUseCaseDeps } from './deps.js';

export interface OrganisationEngineeringReport extends QualityReport {
  organisationId: OrganisationId;
  projectCount: number;
}

async function evidenceFor(
  artifacts: ArtifactRepository,
  organisationId: OrganisationId,
  artifactType: string,
): Promise<ArtifactEvidenceRow[]> {
  return artifacts.listEvidenceForOrganisation
    ? artifacts.listEvidenceForOrganisation(organisationId, artifactType)
    : [];
}

/**
 * DEVOS-164: the organisation-scoped mirror of `getProjectEngineeringReport`
 * — reuses DEVOS-163's real organisation-join evidence queries, gated by
 * the same `resolveOrganisationMembership` check `getOrganisationCostReport`
 * (DEVOS-151) already establishes. Tenant isolation (ADR-SEC-005): this
 * never reaches across organisations. `countReworkCyclesForProject` has no
 * organisation-scoped equivalent yet — rework, unlike evidence artifacts,
 * has no real cross-project need identified in this sprint's own grounding,
 * so this report's `reworkCycleCount` is always `0` at organisation scope,
 * a real, disclosed limitation rather than a silently wrong number.
 */
export async function getOrganisationEngineeringReport(
  deps: EngineeringIntelligenceUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
  period?: { start: string; end: string },
): Promise<OrganisationEngineeringReport> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');

  const [review, test, securityScan, release, codeChange, projects] = await Promise.all([
    evidenceFor(deps.artifacts, organisationId, 'REVIEW_EVIDENCE'),
    evidenceFor(deps.artifacts, organisationId, 'TEST_EVIDENCE'),
    evidenceFor(deps.artifacts, organisationId, 'SECURITY_SCAN_EVIDENCE'),
    evidenceFor(deps.artifacts, organisationId, 'RELEASE_EVIDENCE'),
    evidenceFor(deps.artifacts, organisationId, 'CODE_CHANGE'),
    deps.projects.listForOrganisation(organisationId),
  ]);

  const resolvedPeriod = period ?? {
    start: new Date(Date.now() - DEFAULT_DORA_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  };

  return {
    organisationId,
    projectCount: projects.length,
    ...aggregateEngineeringEvidence(
      { review, test, securityScan, release, codeChange, reworkCycles: [] },
      resolvedPeriod,
    ),
  };
}
