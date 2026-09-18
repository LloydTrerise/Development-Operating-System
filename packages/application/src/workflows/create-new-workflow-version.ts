import { randomUUID } from 'node:crypto';
import type { AuditId, WorkflowId } from '@devos/contracts';
import type { WorkflowVersion } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { CreateWorkflowDefinitionDeps } from './deps.js';

/**
 * DEVOS-136 (Sprint 14): the missing primitive this codebase never needed
 * until a real project's own already-`PUBLISHED` `WorkflowDefinition`
 * needed to become editable again — mirrors `createPolicy`'s
 * (`packages/application/src/policy/create-policy.ts`) already-proven
 * "revise by drafting a new version, never by mutating a published one"
 * pattern exactly, rather than inventing a new one. The new draft's own
 * `definition` starts as a verbatim copy of the latest version's graph (a
 * real starting point to edit from, matching how an author actually
 * experiences "revising" a workflow — not a blank graph).
 */
export async function createNewWorkflowVersion(
  deps: CreateWorkflowDefinitionDeps,
  principalId: string,
  workflowId: WorkflowId,
): Promise<WorkflowVersion> {
  const definition = await deps.workflowDefinitions.getById(workflowId);
  if (!definition) throw new NotFoundError('Workflow');

  const project = await deps.projects.getById(definition.projectId);
  if (!project) throw new NotFoundError('Workflow');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Workflow');

  const latest = await deps.workflowVersions.getLatestForDefinition(workflowId);
  if (!latest) throw new NotFoundError('Workflow version');

  if (latest.status === 'DRAFT') {
    throw new ValidationError(
      `Workflow "${definition.key}" already has an unpublished draft (version ${latest.version}); edit or publish it instead of creating another draft.`,
    );
  }

  const now = new Date().toISOString();
  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: workflowId,
    version: latest.version + 1,
    status: 'DRAFT',
    definition: latest.definition,
    createdBy: principalId,
    createdAt: now,
  };

  await deps.workflowVersions.create(version);

  // DEVOS-115's own audit-coverage convention, extended to a workflow's
  // own re-drafting (not just its initial creation).
  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId: project.id,
    actorType: 'USER',
    actorId: principalId,
    action: 'workflow.version.drafted',
    targetType: 'WorkflowDefinition',
    targetId: definition.id,
    outcome: 'SUCCESS',
    metadata: { key: definition.key, versionId: version.id, version: version.version },
    createdAt: now,
  });

  return version;
}
