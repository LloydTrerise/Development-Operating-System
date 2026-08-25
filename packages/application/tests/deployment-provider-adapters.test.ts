import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
import {
  createCommit,
  createLocalStagingDeploymentProvider,
  runGit,
  writeFileChange,
} from '@devos/integrations';
import { invokeTool, type ToolGatewayDeps } from '@devos/tools';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDeploymentProviderAdapters } from '../src/tasks/deployment-provider-adapters.js';

async function readFileNormalized(path: string): Promise<string> {
  return (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
}

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

async function seedDeployCapability(
  deps: ToolGatewayDeps,
  projectId: Project['id'],
): Promise<void> {
  const capability: ToolCapability = {
    id: randomUUID() as ToolCapability['id'],
    projectId,
    key: 'deploy',
    name: 'Deploy to Environment',
    riskClass: 'R3',
    inputSchema: {
      type: 'object',
      properties: { revision: { type: 'string' } },
      required: ['revision'],
    },
    outputSchema: { type: 'object' },
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };
  await deps.toolCapabilities.create(capability);
}

describe('deploy capability (real local git repository + real staging directory, through the Tool Gateway)', () => {
  let repositoryPath: string;
  let stagingRoot: string;
  let firstRevision: string;
  let deps: ToolGatewayDeps;
  let projectId: Project['id'];
  let workflowTaskId: WorkflowTaskId;
  const organisationId = randomUUID() as OrganisationId;

  beforeEach(async () => {
    repositoryPath = await mkdtemp(join(tmpdir(), 'devos-074-deploy-repo-'));
    stagingRoot = await mkdtemp(join(tmpdir(), 'devos-074-deploy-staging-'));
    await runGit(['init'], repositoryPath);
    await runGit(['config', 'user.email', 'devos-test@example.com'], repositoryPath);
    await runGit(['config', 'user.name', 'DevOS Test'], repositoryPath);
    await writeFileChange({ repositoryPath }, 'index.html', '<h1>v1</h1>\n');
    firstRevision = await createCommit({ repositoryPath }, 'v1');

    deps = createInMemoryDeps();
    deps.adapters = createDeploymentProviderAdapters(
      createLocalStagingDeploymentProvider(stagingRoot),
    );

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

    await seedDeployCapability(deps, projectId);
    workflowTaskId = randomUUID() as WorkflowTaskId;
  });

  afterEach(async () => {
    await rm(repositoryPath, { recursive: true, force: true });
    await rm(stagingRoot, { recursive: true, force: true });
  });

  it('deploys a real revision through the Tool Gateway and records real output', async () => {
    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      capabilityKey: 'deploy',
      target: { repositoryPath, environment: 'staging' },
      parameters: { revision: firstRevision },
      idempotencyKey: 'devos-074-deploy-1',
    });

    expect(invocation.status).toBe('SUCCEEDED');
    expect(invocation.outputMetadata?.revision).toBe(firstRevision);
    expect(invocation.outputMetadata?.deployedPath).toBe(join(stagingRoot, 'staging'));

    const content = await readFileNormalized(
      join(String(invocation.outputMetadata?.deployedPath), 'index.html'),
    );
    expect(content).toBe('<h1>v1</h1>\n');
  });

  it('is idempotent: a retried request with the same key returns the original invocation without deploying again', async () => {
    const first = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      capabilityKey: 'deploy',
      target: { repositoryPath, environment: 'staging' },
      parameters: { revision: firstRevision },
      idempotencyKey: 'devos-074-deploy-idempotent',
    });
    const second = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      capabilityKey: 'deploy',
      target: { repositoryPath, environment: 'staging' },
      parameters: { revision: firstRevision },
      idempotencyKey: 'devos-074-deploy-idempotent',
    });

    expect(second.id).toBe(first.id);
    expect(second.outputMetadata?.deploymentId).toBe(first.outputMetadata?.deploymentId);
  });

  it('rejects deploying to a policy-denied environment before the adapter ever runs', async () => {
    const policy: Policy = {
      id: randomUUID() as Policy['id'],
      organisationId,
      projectId,
      key: 'release-policy',
      version: 1,
      status: 'PUBLISHED',
      definition: {
        rules: [{ action: 'deploy', effect: 'DENY', condition: { environment: 'production' } }],
      },
      createdBy: 'alice',
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await deps.policies.create(policy);

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      capabilityKey: 'deploy',
      target: { repositoryPath, environment: 'production' },
      parameters: { revision: firstRevision },
      idempotencyKey: 'devos-074-deploy-denied',
    });

    expect(invocation.status).toBe('REJECTED');
    expect(invocation.errorCode).toBe('DEVOS_TOOL_POLICY_DENY');
  });
});
