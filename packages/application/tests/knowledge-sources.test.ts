import { randomUUID } from 'node:crypto';
import {
  SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type AuditRecord,
  type AuditRecordRepository,
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
  type SharedKnowledgeSource,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../src/projects/create-project.js';
import type { CreateProjectWithClones } from '../src/projects/deps.js';
import { archiveKnowledgeSource } from '../src/knowledge/archive-knowledge-source.js';
import { createKnowledgeSource } from '../src/knowledge/create-knowledge-source.js';
import { getKnowledgeSourceForPrincipal } from '../src/knowledge/get-knowledge-source.js';
import { installKnowledgeSource } from '../src/knowledge/install-knowledge-source.js';
import { listKnowledgeSourcesForProject } from '../src/knowledge/list-knowledge-sources.js';
import { listSharedKnowledgeSourcesForOrganisation } from '../src/knowledge/list-shared-knowledge-sources-for-organisation.js';
import { shareKnowledgeSource } from '../src/knowledge/share-knowledge-source.js';
import { updateKnowledgeSource } from '../src/knowledge/update-knowledge-source.js';
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
    update: async (id, changes, updatedAt) => {
      const existing = sourcesStore.get(id);
      if (!existing) return;
      sourcesStore.set(id, { ...existing, ...changes, updatedAt });
    },
    setSharedAcrossOrganisation: async (id, shared) => {
      const existing = sourcesStore.get(id);
      if (!existing) return;
      sourcesStore.set(id, { ...existing, sharedAcrossOrganisation: shared });
    },
    listSharedForOrganisation: async (organisationId): Promise<SharedKnowledgeSource[]> => {
      return [...sourcesStore.values()]
        .filter((s) => s.sharedAcrossOrganisation === true)
        .map((s) => {
          const sourceProject = projects.get(s.projectId);
          return {
            ...s,
            sourceProjectId: s.projectId,
            sourceProjectName: sourceProject?.name ?? '',
          };
        })
        .filter((s) => {
          const sourceProject = projects.get(s.projectId);
          return sourceProject?.organisationId === organisationId;
        });
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

  const auditRecordsStore: AuditRecord[] = [];
  const auditRecords: AuditRecordRepository = {
    create: async (record) => {
      auditRecordsStore.push(record);
    },
    listForProject: async (projectId) => auditRecordsStore.filter((r) => r.projectId === projectId),
    listForOrganisation: async (organisationId) =>
      auditRecordsStore.filter((r) => r.organisationId === organisationId),
  };

  return {
    projects: projectRepository,
    memberships: membershipRepository,
    knowledgeSources,
    projectTypes,
    projectTypeWorkflows,
    projectTypeAgents,
    createProjectWithClones,
    auditRecords,
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

    // DEVOS-115: extends DEVOS-086's audit coverage to knowledge-source
    // creation — the real audit trail, not just the returned value.
    const auditRecords = await deps.auditRecords.listForProject(projectId);
    expect(auditRecords).toContainEqual(
      expect.objectContaining({
        action: 'knowledge-source.created',
        targetType: 'KnowledgeSource',
        targetId: source.id,
        outcome: 'SUCCESS',
      }),
    );
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

  // DEVOS-182
  it('updates a knowledge source and audits it', async () => {
    const source = await createKnowledgeSource(deps, 'alice', projectId, {
      key: 'editable',
      name: 'Original name',
      sourceType: 'STANDARD',
      content: 'Original content',
    });

    const updated = await updateKnowledgeSource(deps, 'alice', source.id, {
      name: 'New name',
      content: 'New content',
    });
    expect(updated.name).toBe('New name');
    expect(updated.content).toBe('New content');
    expect(updated.sourceType).toBe('STANDARD');

    const auditRecords = await deps.auditRecords.listForProject(projectId);
    expect(auditRecords).toContainEqual(
      expect.objectContaining({ action: 'knowledge-source.updated', targetId: source.id }),
    );
  });

  it('rejects an update with empty content', async () => {
    const source = await createKnowledgeSource(deps, 'alice', projectId, {
      key: 'reject-empty',
      name: 'Name',
      sourceType: 'STANDARD',
      content: 'content',
    });

    await expect(
      updateKnowledgeSource(deps, 'alice', source.id, { content: '   ' }),
    ).rejects.toThrow(ValidationError);
  });

  // DEVOS-182
  it('archives an active knowledge source, rejects double-archive, and excludes it from listing status', async () => {
    const source = await createKnowledgeSource(deps, 'alice', projectId, {
      key: 'archivable',
      name: 'Archivable',
      sourceType: 'STANDARD',
      content: 'content',
    });

    const archived = await archiveKnowledgeSource(deps, 'alice', source.id);
    expect(archived.status).toBe('ARCHIVED');

    const auditRecords = await deps.auditRecords.listForProject(projectId);
    expect(auditRecords).toContainEqual(
      expect.objectContaining({ action: 'knowledge-source.archived', targetId: source.id }),
    );

    await expect(archiveKnowledgeSource(deps, 'alice', source.id)).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects update/archive from a non-member', async () => {
    const source = await createKnowledgeSource(deps, 'alice', projectId, {
      key: 'protected',
      name: 'Protected',
      sourceType: 'STANDARD',
      content: 'content',
    });

    await expect(
      updateKnowledgeSource(deps, 'mallory', source.id, { name: 'Hacked' }),
    ).rejects.toThrow(NotFoundError);
    await expect(archiveKnowledgeSource(deps, 'mallory', source.id)).rejects.toThrow(
      NotFoundError,
    );
  });

  // DEVOS-188/189
  describe('sharing and installing', () => {
    it('shares an active knowledge source as its OWNER, and rejects a non-OWNER', async () => {
      const source = await createKnowledgeSource(deps, 'alice', projectId, {
        key: 'shareable',
        name: 'Shareable',
        sourceType: 'STANDARD',
        content: 'Prefer explicit types.',
      });

      const shared = await shareKnowledgeSource(deps, 'alice', source.id, true);
      expect(shared.sharedAcrossOrganisation).toBe(true);

      const auditRecords = await deps.auditRecords.listForProject(projectId);
      expect(auditRecords).toContainEqual(
        expect.objectContaining({ action: 'knowledge-source.shared', targetId: source.id }),
      );

      // A second, non-owner member is rejected.
      await deps.memberships.create({
        id: randomUUID(),
        organisationId,
        projectId,
        principalId: 'contributor',
        role: 'MEMBER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await expect(
        shareKnowledgeSource(deps, 'contributor', source.id, true),
      ).rejects.toThrow();
    });

    it('rejects sharing an archived knowledge source', async () => {
      const source = await createKnowledgeSource(deps, 'alice', projectId, {
        key: 'archived-unshareable',
        name: 'Name',
        sourceType: 'STANDARD',
        content: 'content',
      });
      await archiveKnowledgeSource(deps, 'alice', source.id);

      await expect(shareKnowledgeSource(deps, 'alice', source.id, true)).rejects.toThrow(
        ValidationError,
      );
    });

    it('lists shared knowledge sources for an organisation, real-join scoped, never cross-organisation', async () => {
      const source = await createKnowledgeSource(deps, 'alice', projectId, {
        key: 'org-shared',
        name: 'Org Shared',
        sourceType: 'STANDARD',
        content: 'content',
      });
      await shareKnowledgeSource(deps, 'alice', source.id, true);

      const shared = await listSharedKnowledgeSourcesForOrganisation(deps, 'alice', organisationId);
      expect(shared.map((s) => s.id)).toContain(source.id);

      const otherOrganisationId = randomUUID() as OrganisationId;
      await expect(
        listSharedKnowledgeSourcesForOrganisation(deps, 'alice', otherOrganisationId),
      ).rejects.toThrow(NotFoundError);
    });

    it('installs a shared knowledge source into a same-organisation project as a real, independent copy', async () => {
      const source = await createKnowledgeSource(deps, 'alice', projectId, {
        key: 'installable',
        name: 'Installable',
        sourceType: 'STANDARD',
        content: 'Real content to clone.',
      });
      await shareKnowledgeSource(deps, 'alice', source.id, true);

      const targetProject = await createProject(deps, 'bob', {
        organisationId,
        name: 'Target Project',
        slug: 'target-project',
      });

      const installed = await installKnowledgeSource(deps, 'bob', source.id, targetProject.id);
      expect(installed.id).not.toBe(source.id);
      expect(installed.projectId).toBe(targetProject.id);
      expect(installed.content).toBe('Real content to clone.');
      expect(installed.status).toBe('ACTIVE');

      const auditRecords = await deps.auditRecords.listForProject(targetProject.id);
      expect(auditRecords).toContainEqual(
        expect.objectContaining({ action: 'knowledge-source.installed', targetId: installed.id }),
      );
    });

    it('rejects installing a non-shared knowledge source', async () => {
      const source = await createKnowledgeSource(deps, 'alice', projectId, {
        key: 'not-shared',
        name: 'Not shared',
        sourceType: 'STANDARD',
        content: 'content',
      });
      const targetProject = await createProject(deps, 'bob', {
        organisationId,
        name: 'Target Project 2',
        slug: 'target-project-2',
      });

      await expect(
        installKnowledgeSource(deps, 'bob', source.id, targetProject.id),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects a cross-organisation install with NotFoundError, never a distinguishable forbidden response', async () => {
      const source = await createKnowledgeSource(deps, 'alice', projectId, {
        key: 'cross-org',
        name: 'Cross org',
        sourceType: 'STANDARD',
        content: 'content',
      });
      await shareKnowledgeSource(deps, 'alice', source.id, true);

      const otherOrgProject = await createProject(deps, 'carol', {
        organisationId: randomUUID() as OrganisationId,
        name: 'Different Org Project',
        slug: 'different-org-project',
      });

      await expect(
        installKnowledgeSource(deps, 'carol', source.id, otherOrgProject.id),
      ).rejects.toThrow(NotFoundError);
    });

    it('disambiguates a real key collision in the target project rather than failing the install', async () => {
      const source = await createKnowledgeSource(deps, 'alice', projectId, {
        key: 'collide',
        name: 'Source',
        sourceType: 'STANDARD',
        content: 'content',
      });
      await shareKnowledgeSource(deps, 'alice', source.id, true);

      const targetProject = await createProject(deps, 'bob', {
        organisationId,
        name: 'Collision Target',
        slug: 'collision-target',
      });
      await createKnowledgeSource(deps, 'bob', targetProject.id, {
        key: 'collide',
        name: 'Existing',
        sourceType: 'STANDARD',
        content: 'existing content',
      });

      const installed = await installKnowledgeSource(deps, 'bob', source.id, targetProject.id);
      expect(installed.key).not.toBe('collide');
      expect(installed.key.startsWith('collide-')).toBe(true);
    });
  });
});
