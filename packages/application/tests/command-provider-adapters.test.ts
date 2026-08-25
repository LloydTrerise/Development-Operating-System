import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WorkflowTaskId } from '@devos/contracts';
import type {
  AuditRecord,
  AuditRecordRepository,
  Membership,
  MembershipRepository,
  OrganisationId,
  Policy,
  PolicyRepository,
  Project,
  ProjectRepository,
  ToolCapability,
  ToolCapabilityRepository,
  ToolInvocation,
  ToolInvocationRepository,
} from '@devos/domain';
import { invokeTool, type ToolGatewayDeps } from '@devos/tools';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCommandProviderAdapters } from '../src/tasks/command-provider-adapters.js';

function createInMemoryDeps(): ToolGatewayDeps {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();
  const capabilities = new Map<string, ToolCapability>();
  const policiesStore = new Map<string, Policy>();
  const invocationsStore = new Map<string, ToolInvocation>();

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

  const policies: PolicyRepository = {
    getById: async (id) => policiesStore.get(id) ?? null,
    getByProjectAndKeyAndVersion: async () => null,
    getLatestForProjectAndKey: async () => null,
    listForProject: async (projectId) =>
      [...policiesStore.values()].filter((p) => p.projectId === projectId),
    create: async (policy) => {
      policiesStore.set(policy.id, policy);
    },
    publish: async () => {},
  };

  const toolInvocations: ToolInvocationRepository = {
    getById: async (id) => invocationsStore.get(id) ?? null,
    getByCapabilityAndIdempotencyKey: async (toolCapabilityId, idempotencyKey) =>
      [...invocationsStore.values()].find(
        (i) => i.toolCapabilityId === toolCapabilityId && i.idempotencyKey === idempotencyKey,
      ) ?? null,
    listForTask: async (workflowTaskId) =>
      [...invocationsStore.values()].filter((i) => i.workflowTaskId === workflowTaskId),
    create: async (invocation) => {
      invocationsStore.set(invocation.id, invocation);
    },
  };

  const auditRecordsStore: AuditRecord[] = [];
  const auditRecords: AuditRecordRepository = {
    create: async (record) => {
      auditRecordsStore.push(record);
    },
    listForProject: async (projectId) => auditRecordsStore.filter((r) => r.projectId === projectId),
  };

  return {
    projects: projectRepository,
    memberships: membershipRepository,
    policies,
    toolCapabilities,
    toolInvocations,
    auditRecords,
    adapters: {},
  };
}

async function seedCapability(
  deps: ToolGatewayDeps,
  projectId: Project['id'],
  key: 'build-run' | 'test-run',
): Promise<void> {
  const capability: ToolCapability = {
    id: randomUUID() as ToolCapability['id'],
    projectId,
    key,
    name: key === 'build-run' ? 'Run Build' : 'Run Tests',
    riskClass: 'R2',
    inputSchema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
    outputSchema: { type: 'object' },
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };
  await deps.toolCapabilities.create(capability);
}

describe('build-run/test-run capabilities (real shell commands through the Tool Gateway)', () => {
  let workspacePath: string;
  let deps: ToolGatewayDeps;
  let projectId: Project['id'];
  let workflowTaskId: WorkflowTaskId;
  const organisationId = randomUUID() as OrganisationId;

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'devos-062-063-command-test-'));

    deps = createInMemoryDeps();
    deps.adapters = createCommandProviderAdapters({
      workflowTaskId: 'placeholder' as WorkflowTaskId,
      path: workspacePath,
    });

    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID() as Project['id'],
      organisationId,
      name: 'Test Project',
      slug: 'test-project',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    await deps.projects.create(project);
    const membership: Membership = {
      id: randomUUID() as Membership['id'],
      organisationId,
      projectId: project.id,
      principalId: 'alice',
      role: 'OWNER',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    await deps.memberships.create(membership);
    projectId = project.id;

    await seedCapability(deps, projectId, 'build-run');
    await seedCapability(deps, projectId, 'test-run');

    workflowTaskId = randomUUID() as WorkflowTaskId;
  });

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true });
  });

  it('runs a real successful build command and records its output', async () => {
    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      capabilityKey: 'build-run',
      target: { repositoryPath: workspacePath },
      parameters: { command: 'node -e "console.log(\'building\')"' },
      idempotencyKey: 'devos-062-build-1',
    });

    expect(invocation.status).toBe('SUCCEEDED');
    expect(invocation.outputMetadata?.exitCode).toBe(0);
    expect(invocation.outputMetadata?.stdout).toContain('building');
  });

  it('runs a real failing test command and still records SUCCEEDED (the invocation ran; the command failed)', async () => {
    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      capabilityKey: 'test-run',
      target: { repositoryPath: workspacePath },
      parameters: { command: 'node -e "console.error(\'boom\'); process.exit(1)"' },
      idempotencyKey: 'devos-063-test-1',
    });

    expect(invocation.status).toBe('SUCCEEDED');
    expect(invocation.outputMetadata?.exitCode).toBe(1);
    expect(invocation.outputMetadata?.stderr).toContain('boom');
  });

  it('actually runs the command in the given workspace directory', async () => {
    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      capabilityKey: 'build-run',
      target: { repositoryPath: workspacePath },
      parameters: { command: process.platform === 'win32' ? 'cd' : 'pwd' },
      idempotencyKey: 'devos-062-build-cwd',
    });

    expect(invocation.status).toBe('SUCCEEDED');
    const stdout = String(invocation.outputMetadata?.stdout).trim().toLowerCase();
    const basename = workspacePath.split(/[\\/]/).pop()!.toLowerCase();
    expect(stdout).toContain(basename);
  });
});
