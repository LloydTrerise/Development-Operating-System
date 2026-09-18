import { randomUUID } from 'node:crypto';
import {
  SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type Agent,
  type AgentVersion,
  type CreateProjectInput,
  type Membership,
  type Project,
  type WorkflowDefinition,
  type WorkflowVersion,
} from '@devos/domain';
import type { AuditId } from '@devos/contracts';
import { NotFoundError, ValidationError } from '../errors.js';
import type { ProjectUseCaseDeps } from './deps.js';

export async function createProject(
  deps: ProjectUseCaseDeps,
  principalId: string,
  input: CreateProjectInput,
): Promise<Project> {
  if (input.name.trim().length === 0) throw new ValidationError('name is required.');
  if (input.slug.trim().length === 0) throw new ValidationError('slug is required.');

  const projectTypeId = input.projectTypeId ?? SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID;
  const projectType = await deps.projectTypes.getById(projectTypeId);
  if (!projectType) throw new NotFoundError('ProjectType');
  if (projectType.status !== 'ACTIVE') {
    throw new ValidationError('Project type is not active.');
  }

  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId: input.organisationId,
    projectTypeId,
    name: input.name,
    slug: input.slug,
    ...(input.description !== undefined ? { description: input.description } : {}),
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const membership: Membership = {
    id: randomUUID() as Membership['id'],
    organisationId: input.organisationId,
    projectId: project.id,
    principalId,
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  /**
   * specs/architecture/organisations-and-project-types.md §8 steps 4-6: clone
   * every workflow/agent template verbatim under the new project. Templates
   * keep their original agentRef strings and cloned agents keep the same
   * keys, so a cloned workflow's agentRef resolves correctly against the
   * cloned agents purely because the keys already match — no rewriting.
   */
  const templateWorkflows = await deps.projectTypeWorkflows.listForProjectType(projectTypeId);
  const workflows = templateWorkflows.map((template) => {
    const definition: WorkflowDefinition = {
      id: randomUUID() as WorkflowDefinition['id'],
      projectId: project.id,
      key: template.key,
      name: template.name,
      createdAt: now,
      updatedAt: now,
    };
    const version: WorkflowVersion = {
      id: randomUUID() as WorkflowVersion['id'],
      workflowDefinitionId: definition.id,
      version: 1,
      status: 'PUBLISHED',
      definition: template.definition,
      publishedAt: now,
      createdBy: principalId,
      createdAt: now,
    };
    return { definition, version };
  });

  const templateAgents = await deps.projectTypeAgents.listForProjectType(projectTypeId);
  const agents = templateAgents.map((template) => {
    const agent: Agent = {
      id: randomUUID() as Agent['id'],
      projectId: project.id,
      key: template.key,
      name: template.name,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    const version: AgentVersion = {
      id: randomUUID() as AgentVersion['id'],
      agentId: agent.id,
      version: 1,
      status: 'PUBLISHED',
      configuration: template.configuration,
      ...(template.promptReference !== undefined
        ? { promptReference: template.promptReference }
        : {}),
      createdBy: principalId,
      publishedAt: now,
      createdAt: now,
    };
    return { agent, version };
  });

  await deps.createProjectWithClones(project, membership, workflows, agents);

  // DEVOS-115: extends DEVOS-086's audit coverage to project creation — same
  // lighter-weight, non-transactional pattern (audited after the real state
  // change succeeds, not inside `createProjectWithClones`'s own transaction).
  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: input.organisationId,
    projectId: project.id,
    actorType: 'USER',
    actorId: principalId,
    action: 'project.created',
    targetType: 'Project',
    targetId: project.id,
    outcome: 'SUCCESS',
    metadata: { name: project.name, slug: project.slug, projectTypeId },
    createdAt: now,
  });

  return project;
}
