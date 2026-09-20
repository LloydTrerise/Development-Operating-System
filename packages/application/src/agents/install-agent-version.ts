import { randomUUID } from 'node:crypto';
import type { AgentVersionId, AuditId, OrganisationId, ProjectId } from '@devos/contracts';
import type { Agent, AgentVersion } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { AgentUseCaseDeps } from './deps.js';

/**
 * DEVOS-178 (Sprint 23): a real, organisation-scoped "install" — clones a
 * real, shared `AgentVersion`'s `configuration` into a brand-new
 * `Agent`/`AgentVersion` (`PUBLISHED` immediately) under a different
 * project in the **same organisation only** (ADR-SEC-005), mirroring
 * `create-project.ts`'s own `ProjectTypeAgent` → `Agent` template-clone
 * precedent exactly — a real, independent copy, never a live/linked
 * reference. `resolveOrganisationMembership` (`organisations/
 * membership-access.ts`) isn't reused here because its own declared
 * `OrganisationUseCaseDeps` parameter type requires an `organisations`
 * repository this module has no other use for — the equivalent real
 * tenant-isolation check (source and target project share one real
 * `organisationId`) is inlined directly instead, reading only
 * `deps.projects`, already present.
 */
export async function installAgentVersion(
  deps: AgentUseCaseDeps,
  principalId: string,
  sourceAgentVersionId: AgentVersionId,
  targetProjectId: ProjectId,
): Promise<{ agent: Agent; version: AgentVersion }> {
  const sourceVersion = await deps.agentVersions.getById(sourceAgentVersionId);
  if (!sourceVersion) throw new NotFoundError('Agent version');
  if (sourceVersion.sharedAcrossOrganisation !== true) {
    throw new ValidationError('This agent version has not been shared with its organisation.');
  }

  const sourceAgent = await deps.agents.getById(sourceVersion.agentId);
  if (!sourceAgent) throw new NotFoundError('Agent version');

  const sourceProject = await deps.projects.getById(sourceAgent.projectId);
  if (!sourceProject) throw new NotFoundError('Agent version');

  const targetProject = await deps.projects.getById(targetProjectId);
  if (!targetProject) throw new NotFoundError('Project');

  // Real tenant isolation (ADR-SEC-005): a mismatch reports the same
  // `NotFoundError` every other org-scoped route already uses for a
  // cross-tenant attempt — never a distinguishable "forbidden, but it
  // exists" response.
  if (targetProject.organisationId !== sourceProject.organisationId) {
    throw new NotFoundError('Agent version');
  }

  const membership = await resolveMembership(deps, principalId, targetProject);
  if (!membership) throw new NotFoundError('Project');

  const now = new Date().toISOString();
  const newAgent: Agent = {
    id: randomUUID() as Agent['id'],
    projectId: targetProjectId,
    key: sourceAgent.key,
    name: sourceAgent.name,
    ...(sourceAgent.description !== undefined ? { description: sourceAgent.description } : {}),
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  const newVersion: AgentVersion = {
    id: randomUUID() as AgentVersion['id'],
    agentId: newAgent.id,
    version: 1,
    status: 'PUBLISHED',
    configuration: sourceVersion.configuration,
    ...(sourceVersion.promptReference !== undefined
      ? { promptReference: sourceVersion.promptReference }
      : {}),
    createdBy: principalId,
    publishedAt: now,
    createdAt: now,
  };
  await deps.createDraft(newAgent, newVersion);
  await deps.agentVersions.publish(newVersion.id, now);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: targetProject.organisationId as OrganisationId,
    projectId: targetProjectId,
    actorType: 'USER',
    actorId: principalId,
    action: 'agent.installed',
    targetType: 'Agent',
    targetId: newAgent.id,
    outcome: 'SUCCESS',
    metadata: {
      sourceAgentId: sourceAgent.id,
      sourceAgentVersionId: sourceVersion.id,
      sourceProjectId: sourceProject.id,
    },
    createdAt: now,
  });

  return { agent: newAgent, version: { ...newVersion, status: 'PUBLISHED', publishedAt: now } };
}
