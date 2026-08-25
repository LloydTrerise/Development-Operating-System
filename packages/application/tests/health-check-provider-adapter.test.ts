import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
import { createHealthCheckProviderAdapter } from '../src/tasks/health-check-provider-adapter.js';

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

async function seedHealthCheckCapability(
  deps: ToolGatewayDeps,
  projectId: Project['id'],
): Promise<void> {
  const capability: ToolCapability = {
    id: randomUUID() as ToolCapability['id'],
    projectId,
    key: 'health-check',
    name: 'Run Post-Release Health Check',
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

describe('health-check capability (real shell command against a real deployed directory, through the Tool Gateway)', () => {
  let deployedPath: string;
  let deps: ToolGatewayDeps;
  let projectId: Project['id'];
  let workflowTaskId: WorkflowTaskId;
  const organisationId = randomUUID() as OrganisationId;

  beforeEach(async () => {
    deployedPath = await mkdtemp(join(tmpdir(), 'devos-075-health-check-'));
    await writeFile(join(deployedPath, 'index.html'), '<h1>deployed</h1>\n', 'utf8');

    deps = createInMemoryDeps();
    deps.adapters = createHealthCheckProviderAdapter(deployedPath);

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

    await seedHealthCheckCapability(deps, projectId);
    workflowTaskId = randomUUID() as WorkflowTaskId;
  });

  afterEach(async () => {
    await rm(deployedPath, { recursive: true, force: true });
  });

  it('runs a real successful health check against the real deployed directory', async () => {
    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      capabilityKey: 'health-check',
      target: {},
      parameters: {
        command:
          process.platform === 'win32'
            ? "node -e \"if (!require('fs').existsSync('index.html')) process.exit(1)\""
            : 'test -f index.html',
      },
      idempotencyKey: 'devos-075-health-check-1',
    });

    expect(invocation.status).toBe('SUCCEEDED');
    expect(invocation.outputMetadata?.exitCode).toBe(0);
  });

  it('records a real failing health check as SUCCEEDED tool output with a non-zero exit code (data, not a task failure)', async () => {
    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      capabilityKey: 'health-check',
      target: {},
      parameters: { command: 'node -e "console.error(\'unhealthy\'); process.exit(1)"' },
      idempotencyKey: 'devos-075-health-check-2',
    });

    expect(invocation.status).toBe('SUCCEEDED');
    expect(invocation.outputMetadata?.exitCode).toBe(1);
    expect(invocation.outputMetadata?.stderr).toContain('unhealthy');
  });

  it('actually runs the command inside the real deployed directory', async () => {
    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      capabilityKey: 'health-check',
      target: {},
      parameters: { command: process.platform === 'win32' ? 'cd' : 'pwd' },
      idempotencyKey: 'devos-075-health-check-cwd',
    });

    expect(invocation.status).toBe('SUCCEEDED');
    const stdout = String(invocation.outputMetadata?.stdout).trim().toLowerCase();
    const basename = deployedPath.split(/[\\/]/).pop()!.toLowerCase();
    expect(stdout).toContain(basename);
  });
});
