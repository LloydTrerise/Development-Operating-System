import type { AgentId } from '@devos/contracts';
import { computeAgentVersionQuality, type AgentVersionQuality } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { AgentUseCaseDeps } from './deps.js';

/**
 * DEVOS-174: the real per-agent-version quality signal — a review pass
 * rate derived directly from `REVIEW_EVIDENCE.decision`, joined back to
 * its developer `AgentVersion` via `CODE_CHANGE.metadata.agentVersionId`
 * (real data already captured, confirmed by direct inspection, not new
 * capture). Scoped to this one agent's own versions only.
 */
export async function getAgentQuality(
  deps: AgentUseCaseDeps,
  principalId: string,
  agentId: AgentId,
): Promise<AgentVersionQuality[]> {
  const agent = await deps.agents.getById(agentId);
  if (!agent) throw new NotFoundError('Agent');

  const project = await deps.projects.getById(agent.projectId);
  if (!project) throw new NotFoundError('Agent');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Agent');

  if (!deps.artifacts?.listEvidenceForProject) return [];

  const versions = await deps.agentVersions.listForAgent(agentId);
  const versionIds = new Set(versions.map((version) => version.id as string));

  const [reviewEvidence, codeChangeEvidence] = await Promise.all([
    deps.artifacts.listEvidenceForProject(agent.projectId, 'REVIEW_EVIDENCE'),
    deps.artifacts.listEvidenceForProject(agent.projectId, 'CODE_CHANGE'),
  ]);

  return computeAgentVersionQuality(reviewEvidence, codeChangeEvidence).filter((row) =>
    versionIds.has(row.agentVersionId),
  );
}
