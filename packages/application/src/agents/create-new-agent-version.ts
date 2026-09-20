import { randomUUID } from 'node:crypto';
import type { AgentId, AuditId } from '@devos/contracts';
import type { AgentVersion } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { AgentUseCaseDeps } from './deps.js';

/**
 * DEVOS-172 (Sprint 22): the missing primitive this codebase never needed
 * until a real agent needed a second version — mirrors
 * `createNewWorkflowVersion`'s (`packages/application/src/workflows/
 * create-new-workflow-version.ts`, DEVOS-136) already-proven "revise by
 * drafting a new version, never by mutating a published one" pattern
 * exactly, rather than inventing a new one. The new draft's own
 * `configuration` starts as a verbatim copy of the latest version's — a
 * real starting point to edit from, matching how an author actually
 * experiences "revising" an agent.
 */
export async function createNewAgentVersion(
  deps: AgentUseCaseDeps,
  principalId: string,
  agentId: AgentId,
): Promise<AgentVersion> {
  const agent = await deps.agents.getById(agentId);
  if (!agent) throw new NotFoundError('Agent');

  const project = await deps.projects.getById(agent.projectId);
  if (!project) throw new NotFoundError('Agent');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Agent');

  const latest = await deps.agentVersions.getLatestForAgent(agentId);
  if (!latest) throw new NotFoundError('Agent version');

  if (latest.status === 'DRAFT') {
    throw new ValidationError(
      `Agent "${agent.key}" already has an unpublished draft (version ${latest.version}); edit or publish it instead of creating another draft.`,
    );
  }

  const now = new Date().toISOString();
  const version: AgentVersion = {
    id: randomUUID() as AgentVersion['id'],
    agentId,
    version: latest.version + 1,
    status: 'DRAFT',
    configuration: latest.configuration,
    ...(latest.promptReference !== undefined ? { promptReference: latest.promptReference } : {}),
    createdBy: principalId,
    createdAt: now,
  };

  await deps.agentVersions.create(version);

  // DEVOS-115's own audit-coverage convention, extended to an agent's own
  // re-drafting (not just its initial creation), mirroring
  // `workflow.version.drafted`'s exact shape.
  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId: project.id,
    actorType: 'USER',
    actorId: principalId,
    action: 'agent_version.drafted',
    targetType: 'Agent',
    targetId: agent.id,
    outcome: 'SUCCESS',
    metadata: { key: agent.key, versionId: version.id, version: version.version },
    createdAt: now,
  });

  return version;
}
