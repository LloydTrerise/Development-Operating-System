import { randomUUID } from 'node:crypto';
import type {
  Membership,
  MembershipRepository,
  OrganisationId,
  Project,
  ProjectRepository,
  ToolCapability,
  ToolCapabilityRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../src/projects/create-project.js';
import { NotFoundError, ValidationError } from '../src/errors.js';
import type { ToolUseCaseDeps } from '../src/tools/deps.js';
import { getCapabilityForPrincipal } from '../src/tools/get-capability.js';
import { listCapabilitiesForProject } from '../src/tools/list-capabilities.js';
import { registerAllCapabilities } from '../src/tools/register-all-capabilities.js';
import { registerCapability } from '../src/tools/register-capability.js';

function createInMemoryDeps(): ToolUseCaseDeps {
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
  };

  return { projects: projectRepository, memberships: membershipRepository, toolCapabilities };
}

const VALID_INPUT = {
  key: 'repo-read',
  name: 'Read Repository File',
  riskClass: 'R0' as const,
  inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  outputSchema: { type: 'object', properties: { content: { type: 'string' } } },
};

describe('tool capability use cases', () => {
  let deps: ToolUseCaseDeps;
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
    expect(first).toHaveLength(8);
    expect(first.every((c) => c.status === 'ACTIVE')).toBe(true);

    const second = await registerAllCapabilities(deps, 'alice', projectId);
    expect(second.map((c) => c.id).sort()).toEqual(first.map((c) => c.id).sort());
  });
});
