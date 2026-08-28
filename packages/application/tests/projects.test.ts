import { randomUUID } from 'node:crypto';
import type { OrganisationId, ProjectId, ProjectTypeId } from '@devos/contracts';
import {
  SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type Agent,
  type AgentVersion,
  type AuditRecord,
  type AuditRecordRepository,
  type Membership,
  type MembershipRepository,
  type Project,
  type ProjectRepository,
  type ProjectType,
  type ProjectTypeAgent,
  type ProjectTypeAgentRepository,
  type ProjectTypeRepository,
  type ProjectTypeWorkflow,
  type ProjectTypeWorkflowRepository,
  type WorkflowDefinition,
  type WorkflowVersion,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { addMember } from '../src/projects/add-member.js';
import { changeMemberRole } from '../src/projects/change-member-role.js';
import { createProject } from '../src/projects/create-project.js';
import type { CreateProjectWithClones, ProjectUseCaseDeps } from '../src/projects/deps.js';
import { getProjectForPrincipal } from '../src/projects/get-project.js';
import { listMembers } from '../src/projects/list-members.js';
import { listProjectsForPrincipal } from '../src/projects/list-projects-for-principal.js';
import { removeMember } from '../src/projects/remove-member.js';
import { updateProject } from '../src/projects/update-project.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/errors.js';

interface ProjectTestDeps extends ProjectUseCaseDeps {
  clonedWorkflowDefinitions: Map<string, WorkflowDefinition>;
  clonedWorkflowVersions: Map<string, WorkflowVersion>;
  clonedAgents: Map<string, Agent>;
  clonedAgentVersions: Map<string, AgentVersion>;
}

function createInMemoryDeps(): ProjectTestDeps {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();

  const projectRepository: ProjectRepository = {
    getById: async (id) => projects.get(id) ?? null,
    listForOrganisation: async (organisationId) =>
      [...projects.values()].filter((project) => project.organisationId === organisationId),
    create: async (project) => {
      projects.set(project.id, project);
    },
    update: async (id, changes, updatedAt) => {
      const existing = projects.get(id);
      if (!existing) return;
      projects.set(id, { ...existing, ...changes, updatedAt });
    },
  };

  const membershipRepository: MembershipRepository = {
    getById: async (id) => memberships.get(id) ?? null,
    getForPrincipalAndProject: async (principalId, projectId) =>
      [...memberships.values()].find(
        (m) => m.principalId === principalId && m.projectId === projectId,
      ) ?? null,
    listForPrincipal: async (principalId) =>
      [...memberships.values()].filter((m) => m.principalId === principalId),
    listForProject: async (projectId) =>
      [...memberships.values()].filter((m) => m.projectId === projectId),
    create: async (membership) => {
      memberships.set(membership.id, membership);
    },
    updateRole: async (id, role, updatedAt) => {
      const existing = memberships.get(id);
      if (!existing) return;
      memberships.set(id, { ...existing, role, updatedAt });
    },
    remove: async (id) => {
      memberships.delete(id);
    },
  };

  const auditRecordsStore: AuditRecord[] = [];
  const auditRecords: AuditRecordRepository = {
    create: async (record) => {
      auditRecordsStore.push(record);
    },
    listForProject: async (projectId) => auditRecordsStore.filter((r) => r.projectId === projectId),
  };

  const now = new Date().toISOString();
  const projectTypes = new Map<string, ProjectType>([
    [
      SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
      {
        id: SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
        key: 'software-development',
        name: 'Software Development',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    ],
  ]);
  const projectTypeWorkflowsStore = new Map<string, ProjectTypeWorkflow>();
  const projectTypeAgentsStore = new Map<string, ProjectTypeAgent>();

  const projectTypes_: ProjectTypeRepository = {
    getById: async (id) => projectTypes.get(id) ?? null,
    getByKey: async (key) => [...projectTypes.values()].find((p) => p.key === key) ?? null,
    list: async () => [...projectTypes.values()],
    create: async (projectType) => {
      projectTypes.set(projectType.id, projectType);
    },
    update: async (id, changes, updatedAt) => {
      const existing = projectTypes.get(id);
      if (!existing) return;
      projectTypes.set(id, { ...existing, ...changes, updatedAt });
    },
  };

  const projectTypeWorkflows: ProjectTypeWorkflowRepository = {
    getById: async (id) => projectTypeWorkflowsStore.get(id) ?? null,
    getByProjectTypeAndKey: async (projectTypeId, key) =>
      [...projectTypeWorkflowsStore.values()].find(
        (w) => w.projectTypeId === projectTypeId && w.key === key,
      ) ?? null,
    listForProjectType: async (projectTypeId) =>
      [...projectTypeWorkflowsStore.values()].filter((w) => w.projectTypeId === projectTypeId),
    create: async (workflow) => {
      projectTypeWorkflowsStore.set(workflow.id, workflow);
    },
    update: async (id, changes, updatedAt) => {
      const existing = projectTypeWorkflowsStore.get(id);
      if (!existing) return;
      projectTypeWorkflowsStore.set(id, { ...existing, ...changes, updatedAt });
    },
  };

  const projectTypeAgents: ProjectTypeAgentRepository = {
    getById: async (id) => projectTypeAgentsStore.get(id) ?? null,
    getByProjectTypeAndKey: async (projectTypeId, key) =>
      [...projectTypeAgentsStore.values()].find(
        (a) => a.projectTypeId === projectTypeId && a.key === key,
      ) ?? null,
    listForProjectType: async (projectTypeId) =>
      [...projectTypeAgentsStore.values()].filter((a) => a.projectTypeId === projectTypeId),
    create: async (agent) => {
      projectTypeAgentsStore.set(agent.id, agent);
    },
    update: async (id, changes, updatedAt) => {
      const existing = projectTypeAgentsStore.get(id);
      if (!existing) return;
      projectTypeAgentsStore.set(id, { ...existing, ...changes, updatedAt });
    },
  };

  const workflowDefinitionsStore = new Map<string, WorkflowDefinition>();
  const workflowVersionsStore = new Map<string, WorkflowVersion>();
  const agentsStore = new Map<string, Agent>();
  const agentVersionsStore = new Map<string, AgentVersion>();

  const createProjectWithClones: CreateProjectWithClones = async (
    project,
    membership,
    workflows,
    agents,
  ) => {
    projects.set(project.id, project);
    memberships.set(membership.id, membership);
    for (const { definition, version } of workflows) {
      workflowDefinitionsStore.set(definition.id, definition);
      workflowVersionsStore.set(version.id, version);
    }
    for (const { agent, version } of agents) {
      agentsStore.set(agent.id, agent);
      agentVersionsStore.set(version.id, version);
    }
  };

  return {
    projects: projectRepository,
    memberships: membershipRepository,
    auditRecords,
    projectTypes: projectTypes_,
    projectTypeWorkflows,
    projectTypeAgents,
    createProjectWithClones,
    clonedWorkflowDefinitions: workflowDefinitionsStore,
    clonedWorkflowVersions: workflowVersionsStore,
    clonedAgents: agentsStore,
    clonedAgentVersions: agentVersionsStore,
  };
}

describe('project use cases', () => {
  let deps: ProjectTestDeps;
  const organisationId = randomUUID() as OrganisationId;

  beforeEach(() => {
    deps = createInMemoryDeps();
  });

  it('creates a project and makes the creator an OWNER', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'DevOS POC',
      slug: 'devos-poc',
    });

    const members = await listMembers(deps, 'alice', project.id);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ principalId: 'alice', role: 'OWNER' });
  });

  it('lists only projects the principal has access to', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });
    await createProject(deps, 'bob', {
      organisationId,
      name: 'Bob Project',
      slug: 'bob-project',
    });

    const aliceProjects = await listProjectsForPrincipal(deps, 'alice');
    expect(aliceProjects.map((p) => p.id)).toEqual([project.id]);
  });

  it('rejects getProjectForPrincipal for a non-member', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });

    await expect(getProjectForPrincipal(deps, 'mallory', project.id)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('rejects a non-existent project id', async () => {
    await expect(getProjectForPrincipal(deps, 'alice', randomUUID() as ProjectId)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('allows OWNER to update the project, denies MEMBER', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });
    await addMember(deps, 'alice', project.id, { principalId: 'bob', role: 'MEMBER' });

    const updated = await updateProject(deps, 'alice', project.id, { name: 'Renamed' });
    expect(updated.name).toBe('Renamed');

    await expect(updateProject(deps, 'bob', project.id, { name: 'Should fail' })).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('denies MEMBER from adding members', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });
    await addMember(deps, 'alice', project.id, { principalId: 'bob', role: 'MEMBER' });

    await expect(
      addMember(deps, 'bob', project.id, { principalId: 'carol', role: 'MEMBER' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects adding a principal who is already a member', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });

    await expect(
      addMember(deps, 'alice', project.id, { principalId: 'alice', role: 'MEMBER' }),
    ).rejects.toThrow(ValidationError);
  });

  it('prevents removing the last owner', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });
    const members = await listMembers(deps, 'alice', project.id);
    const ownerMembershipId = members[0]!.id;

    await expect(removeMember(deps, 'alice', project.id, ownerMembershipId)).rejects.toThrow(
      ValidationError,
    );
  });

  it('allows demoting an owner when another owner remains', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });
    const bobMembership = await addMember(deps, 'alice', project.id, {
      principalId: 'bob',
      role: 'OWNER',
    });

    const aliceMembership = (await listMembers(deps, 'alice', project.id)).find(
      (m) => m.principalId === 'alice',
    )!;

    const changed = await changeMemberRole(deps, 'bob', project.id, aliceMembership.id, 'MEMBER');
    expect(changed.role).toBe('MEMBER');
    expect(bobMembership.role).toBe('OWNER');
  });

  it('DEVOS-086: writes an audit record for membership add, role change, and remove', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Audited Project',
      slug: 'audited-project',
    });

    const bobMembership = await addMember(deps, 'alice', project.id, {
      principalId: 'bob',
      role: 'MEMBER',
    });
    await changeMemberRole(deps, 'alice', project.id, bobMembership.id, 'OWNER');
    await removeMember(deps, 'alice', project.id, bobMembership.id);

    const records = await deps.auditRecords.listForProject(project.id);
    expect(records).toContainEqual(
      expect.objectContaining({ action: 'membership.added', targetId: bobMembership.id }),
    );
    expect(records).toContainEqual(
      expect.objectContaining({ action: 'membership.role_changed', targetId: bobMembership.id }),
    );
    expect(records).toContainEqual(
      expect.objectContaining({ action: 'membership.removed', targetId: bobMembership.id }),
    );
  });

  it('clones the project type workflow and agent templates into the new project', async () => {
    const now = new Date().toISOString();
    const agentTemplate: ProjectTypeAgent = {
      id: randomUUID() as ProjectTypeAgent['id'],
      projectTypeId: SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
      key: 'discovery-agent',
      name: 'Discovery Agent',
      configuration: {
        role: 'DISCOVERY',
        provider: 'anthropic',
        modelRef: 'claude',
        allowedCapabilities: [],
      },
      createdAt: now,
      updatedAt: now,
    };
    await deps.projectTypeAgents.create(agentTemplate);

    const workflowTemplate: ProjectTypeWorkflow = {
      id: randomUUID() as ProjectTypeWorkflow['id'],
      projectTypeId: SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
      key: 'intake-to-artifact',
      name: 'Intake to Artifact',
      definition: {
        name: 'Intake to Artifact',
        trigger: {},
        inputs: [],
        nodes: [{ id: 'discovery', type: 'AGENT_TASK', agentRef: 'discovery-agent' }],
        edges: [],
        policies: [],
        outputs: [],
      },
      createdAt: now,
      updatedAt: now,
    };
    await deps.projectTypeWorkflows.create(workflowTemplate);

    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Cloned Project',
      slug: 'cloned-project',
    });

    const clonedAgents = [...deps.clonedAgents.values()].filter(
      (a) => a.projectId === project.id,
    );
    expect(clonedAgents).toHaveLength(1);
    expect(clonedAgents[0]).toMatchObject({ key: 'discovery-agent', name: 'Discovery Agent' });

    const clonedAgentVersions = [...deps.clonedAgentVersions.values()].filter(
      (v) => v.agentId === clonedAgents[0]!.id,
    );
    expect(clonedAgentVersions).toHaveLength(1);
    expect(clonedAgentVersions[0]).toMatchObject({
      status: 'PUBLISHED',
      configuration: agentTemplate.configuration,
    });

    const clonedDefinitions = [...deps.clonedWorkflowDefinitions.values()].filter(
      (d) => d.projectId === project.id,
    );
    expect(clonedDefinitions).toHaveLength(1);
    expect(clonedDefinitions[0]).toMatchObject({ key: 'intake-to-artifact' });

    const clonedVersions = [...deps.clonedWorkflowVersions.values()].filter(
      (v) => v.workflowDefinitionId === clonedDefinitions[0]!.id,
    );
    expect(clonedVersions).toHaveLength(1);
    expect(clonedVersions[0]).toMatchObject({
      status: 'PUBLISHED',
      definition: workflowTemplate.definition,
    });
  });

  it('rejects creating a project against a DISABLED project type', async () => {
    const disabledTypeId = randomUUID() as ProjectTypeId;
    await deps.projectTypes.create({
      id: disabledTypeId,
      key: 'disabled-type',
      name: 'Disabled Type',
      status: 'DISABLED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      createProject(deps, 'alice', {
        organisationId,
        projectTypeId: disabledTypeId,
        name: 'Should Fail',
        slug: 'should-fail',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects creating a project against a non-existent project type', async () => {
    await expect(
      createProject(deps, 'alice', {
        organisationId,
        projectTypeId: randomUUID() as ProjectTypeId,
        name: 'Should Fail',
        slug: 'should-fail-2',
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
