import { randomUUID } from 'node:crypto';
import {
  SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type AuditRecord,
  type AuditRecordRepository,
  type Membership,
  type MembershipRepository,
  type OrganisationId,
  type Project,
  type ProjectRepository,
  type ProjectType,
  type ProjectTypeAgentRepository,
  type ProjectTypeRepository,
  type ProjectTypeWorkflowRepository,
  type ToolCapability,
  type ToolCapabilityRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../src/projects/create-project.js';
import type { CreateProjectWithClones } from '../src/projects/deps.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/errors.js';
import { getCapabilityForPrincipal } from '../src/tools/get-capability.js';
import { listCapabilitiesForProject } from '../src/tools/list-capabilities.js';
import { registerAllCapabilities } from '../src/tools/register-all-capabilities.js';
import { registerCapability } from '../src/tools/register-capability.js';
import { setToolCapabilityStatus } from '../src/tools/set-tool-capability-status.js';

function createInMemoryDeps() {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();
  const capabilities = new Map<string, ToolCapability>();

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

  const toolCapabilities: ToolCapabilityRepository = {
    getById: async (id) => capabilities.get(id) ?? null,
    getByProjectAndKey: async (projectId, key) =>
      [...capabilities.values()].find((c) => c.projectId === projectId && c.key === key) ?? null,
    listForProject: async (projectId) =>
      [...capabilities.values()].filter((c) => c.projectId === projectId),
    create: async (capability) => {
      capabilities.set(capability.id, capability);
    },
    updateStatus: async (id, status) => {
      const existing = capabilities.get(id);
      if (!existing) return;
      capabilities.set(id, { ...existing, status });
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
    toolCapabilities,
    projectTypes,
    projectTypeWorkflows,
    projectTypeAgents,
    createProjectWithClones,
    auditRecords,
  };
}

const VALID_INPUT = {
  key: 'repo-read',
  name: 'Read Repository File',
  riskClass: 'R0' as const,
  inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  outputSchema: { type: 'object', properties: { content: { type: 'string' } } },
};

describe('tool capability use cases', () => {
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

  it('registers a new capability as ACTIVE', async () => {
    const capability = await registerCapability(deps, 'alice', projectId, VALID_INPUT);

    expect(capability.status).toBe('ACTIVE');
    expect(capability.projectId).toBe(projectId);
    expect(capability.key).toBe('repo-read');
    expect(capability.riskClass).toBe('R0');
  });

  it('is idempotent: registering the same key twice returns the existing row', async () => {
    const first = await registerCapability(deps, 'alice', projectId, VALID_INPUT);
    const second = await registerCapability(deps, 'alice', projectId, VALID_INPUT);

    expect(second.id).toBe(first.id);

    const listed = await listCapabilitiesForProject(deps, 'alice', projectId);
    expect(listed).toHaveLength(1);
  });

  it('rejects an unknown risk class', async () => {
    await expect(
      registerCapability(deps, 'alice', projectId, {
        ...VALID_INPUT,
        riskClass: 'R9' as unknown as (typeof VALID_INPUT)['riskClass'],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects an empty key or name', async () => {
    await expect(
      registerCapability(deps, 'alice', projectId, { ...VALID_INPUT, key: '  ' }),
    ).rejects.toThrow(ValidationError);
    await expect(
      registerCapability(deps, 'alice', projectId, { ...VALID_INPUT, name: '  ' }),
    ).rejects.toThrow(ValidationError);
  });

  it('lists capabilities for a project and rejects non-members', async () => {
    await registerCapability(deps, 'alice', projectId, VALID_INPUT);

    const listed = await listCapabilitiesForProject(deps, 'alice', projectId);
    expect(listed).toHaveLength(1);

    await expect(listCapabilitiesForProject(deps, 'mallory', projectId)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('gets a single capability by id for a member, and 404s for a non-member', async () => {
    const capability = await registerCapability(deps, 'alice', projectId, VALID_INPUT);

    const fetched = await getCapabilityForPrincipal(deps, 'alice', capability.id);
    expect(fetched.id).toBe(capability.id);

    await expect(getCapabilityForPrincipal(deps, 'mallory', capability.id)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('registers all capability definitions against a project, idempotently', async () => {
    const first = await registerAllCapabilities(deps, 'alice', projectId);
    expect(first).toHaveLength(9);
    expect(first.every((c) => c.status === 'ACTIVE')).toBe(true);

    const second = await registerAllCapabilities(deps, 'alice', projectId);
    expect(second.map((c) => c.id).sort()).toEqual(first.map((c) => c.id).sort());
  });

  describe('setToolCapabilityStatus (DEVOS-256)', () => {
    it('lets an OWNER disable and re-enable a capability, and audits each change', async () => {
      const capability = await registerCapability(deps, 'alice', projectId, VALID_INPUT);

      const disabled = await setToolCapabilityStatus(
        deps,
        'alice',
        projectId,
        capability.id,
        'DISABLED',
      );
      expect(disabled.status).toBe('DISABLED');
      const stored = await deps.toolCapabilities.getById(capability.id);
      expect(stored?.status).toBe('DISABLED');

      const reenabled = await setToolCapabilityStatus(
        deps,
        'alice',
        projectId,
        capability.id,
        'ACTIVE',
      );
      expect(reenabled.status).toBe('ACTIVE');

      const audit = await deps.auditRecords.listForProject(projectId);
      const statusChanges = audit.filter((r) => r.action === 'tool_capability.status_changed');
      expect(statusChanges).toHaveLength(2);
      expect(statusChanges[0]?.metadata).toMatchObject({
        previousStatus: 'ACTIVE',
        status: 'DISABLED',
      });
      expect(statusChanges[1]?.metadata).toMatchObject({
        previousStatus: 'DISABLED',
        status: 'ACTIVE',
      });
    });

    it('is a no-op audit-wise when the status does not actually change', async () => {
      const capability = await registerCapability(deps, 'alice', projectId, VALID_INPUT);

      await setToolCapabilityStatus(deps, 'alice', projectId, capability.id, 'ACTIVE');

      const audit = await deps.auditRecords.listForProject(projectId);
      expect(audit.filter((r) => r.action === 'tool_capability.status_changed')).toHaveLength(0);
    });

    it('denies a project MEMBER (non-OWNER) from toggling capability status', async () => {
      const capability = await registerCapability(deps, 'alice', projectId, VALID_INPUT);
      await deps.memberships.create({
        id: randomUUID() as Membership['id'],
        organisationId,
        projectId,
        principalId: 'erin',
        role: 'MEMBER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await expect(
        setToolCapabilityStatus(deps, 'erin', projectId, capability.id, 'DISABLED'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('404s a non-member, and a capability that belongs to a different project', async () => {
      const capability = await registerCapability(deps, 'alice', projectId, VALID_INPUT);

      await expect(
        setToolCapabilityStatus(deps, 'mallory', projectId, capability.id, 'DISABLED'),
      ).rejects.toThrow(NotFoundError);

      const otherProject = await createProject(deps, 'bob', {
        organisationId,
        name: 'Other Project',
        slug: 'other-project',
      });
      await expect(
        setToolCapabilityStatus(deps, 'bob', otherProject.id, capability.id, 'DISABLED'),
      ).rejects.toThrow(NotFoundError);
    });

    it('rejects an invalid status value', async () => {
      const capability = await registerCapability(deps, 'alice', projectId, VALID_INPUT);

      await expect(
        setToolCapabilityStatus(
          deps,
          'alice',
          projectId,
          capability.id,
          'BOGUS' as unknown as 'ACTIVE',
        ),
      ).rejects.toThrow(ValidationError);
    });
  });
});
