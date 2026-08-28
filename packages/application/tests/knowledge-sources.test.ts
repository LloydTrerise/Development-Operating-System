import { randomUUID } from 'node:crypto';
import {
  SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type KnowledgeSource,
  type KnowledgeSourceRepository,
  type Membership,
  type MembershipRepository,
  type OrganisationId,
  type Project,
  type ProjectRepository,
  type ProjectType,
  type ProjectTypeAgentRepository,
  type ProjectTypeRepository,
  type ProjectTypeWorkflowRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../src/projects/create-project.js';
import type { CreateProjectWithClones } from '../src/projects/deps.js';
import { createKnowledgeSource } from '../src/knowledge/create-knowledge-source.js';
import { getKnowledgeSourceForPrincipal } from '../src/knowledge/get-knowledge-source.js';
import { listKnowledgeSourcesForProject } from '../src/knowledge/list-knowledge-sources.js';
import { NotFoundError, ValidationError } from '../src/errors.js';

function createInMemoryDeps() {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();
  const sourcesStore = new Map<string, KnowledgeSource>();

  const projectRepository: ProjectRepository = {
    getById: async (id) => projects.get(id) ?? null,
    listForOrganisation: async (organisationId) =>
      [...projects.values()].filter((p) => p.organisationId === organisationId),
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

  const knowledgeSources: KnowledgeSourceRepository = {
    getById: async (id) => sourcesStore.get(id) ?? null,
    getByProjectAndKey: async (projectId, key) =>
      [...sourcesStore.values()].find((s) => s.projectId === projectId && s.key === key) ?? null,
    listForProject: async (projectId) =>
      [...sourcesStore.values()].filter((s) => s.projectId === projectId),
    create: async (source) => {
      sourcesStore.set(source.id, source);
    },
  };

  const now = new Date().toISOString();
  const projectTypesStore = new Map<string, ProjectType>([
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
  const projectTypes: ProjectTypeRepository = {
    getById: async (id) => projectTypesStore.get(id) ?? null,
    getByKey: async (key) => [...projectTypesStore.values()].find((p) => p.key === key) ?? null,
    list: async () => [...projectTypesStore.values()],
    create: async (projectType) => {
      projectTypesStore.set(projectType.id, projectType);
    },
    update: async (id, changes, updatedAt) => {
      const existing = projectTypesStore.get(id);
      if (!existing) return;
      projectTypesStore.set(id, { ...existing, ...changes, updatedAt });
    },
  };
  const projectTypeWorkflows: ProjectTypeWorkflowRepository = {
    getById: async () => null,
    getByProjectTypeAndKey: async () => null,
    listForProjectType: async () => [],
    create: async () => {},
    update: async () => {},
  };
  const projectTypeAgents: ProjectTypeAgentRepository = {
    getById: async () => null,
    getByProjectTypeAndKey: async () => null,
    listForProjectType: async () => [],
    create: async () => {},
    update: async () => {},
  };
  const createProjectWithClones: CreateProjectWithClones = async (project, membership) => {
    await projectRepository.create(project);
    await membershipRepository.create(membership);
  };

  return {
    projects: projectRepository,
    memberships: membershipRepository,
    knowledgeSources,
    projectTypes,
    projectTypeWorkflows,
    projectTypeAgents,
    createProjectWithClones,
  };
}

describe('knowledge source use cases', () => {
  let deps: ReturnType<typeof createInMemoryDeps>;
  let projectId: Project['id'];
  const organisationId = randomUUID() as OrganisationId;

  beforeEach(async () => {
    deps = createInMemoryDeps();
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Test Project',
      slug: 'test-project',
    });
    projectId = project.id;
  });

  it('creates an active knowledge source', async () => {
    const source = await createKnowledgeSource(deps, 'alice', projectId, {
      key: 'coding-standards',
      name: 'Coding Standards',
      sourceType: 'STANDARD',
      content: 'Prefer explicit types over inference at public boundaries.',
    });

    expect(source.key).toBe('coding-standards');
    expect(source.status).toBe('ACTIVE');
    expect(source.createdBy).toBe('alice');
  });

  it('rejects a duplicate key within the same project', async () => {
    await createKnowledgeSource(deps, 'alice', projectId, {
      key: 'dup',
      name: 'First',
      sourceType: 'STANDARD',
      content: 'a',
    });

    await expect(
      createKnowledgeSource(deps, 'alice', projectId, {
        key: 'dup',
        name: 'Second',
        sourceType: 'STANDARD',
        content: 'b',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects empty content', async () => {
    await expect(
      createKnowledgeSource(deps, 'alice', projectId, {
        key: 'empty',
        name: 'Empty',
        sourceType: 'STANDARD',
        content: '   ',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('lists knowledge sources for a project and rejects non-members', async () => {
    await createKnowledgeSource(deps, 'alice', projectId, {
      key: 'listed',
      name: 'Listed',
      sourceType: 'STANDARD',
      content: 'content',
    });

    const sources = await listKnowledgeSourcesForProject(deps, 'alice', projectId);
    expect(sources).toHaveLength(1);

    await expect(listKnowledgeSourcesForProject(deps, 'mallory', projectId)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('gets a single knowledge source by id for a member, and 404s for a non-member, and for a project isolated from it', async () => {
    const source = await createKnowledgeSource(deps, 'alice', projectId, {
      key: 'gettable',
      name: 'Gettable',
      sourceType: 'STANDARD',
      content: 'content',
    });

    const fetched = await getKnowledgeSourceForPrincipal(deps, 'alice', source.id);
    expect(fetched.id).toBe(source.id);

    await expect(getKnowledgeSourceForPrincipal(deps, 'mallory', source.id)).rejects.toThrow(
      NotFoundError,
    );

    const otherProject = await createProject(deps, 'bob', {
      organisationId: randomUUID() as OrganisationId,
      name: 'Other Project',
      slug: 'other-project',
    });
    const otherSources = await listKnowledgeSourcesForProject(deps, 'bob', otherProject.id);
    expect(otherSources).toHaveLength(0);
  });
});
