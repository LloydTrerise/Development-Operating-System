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
import {
  createBranch,
  createCommit,
  createLocalPullRequestProvider,
  openRepository,
  runGit,
  writeFileChange,
} from '@devos/integrations';
import { invokeTool, type ToolGatewayDeps } from '@devos/tools';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPullRequestProviderAdapter } from '../src/tasks/pull-request-provider-adapter.js';

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

describe('pull-request-create capability (real branch/commit, fake/local PR provider)', () => {
  let repositoryPath: string;
  let deps: ToolGatewayDeps;
  let projectId: Project['id'];
  let workflowTaskId: WorkflowTaskId;
  const organisationId = randomUUID() as OrganisationId;

  beforeEach(async () => {
    repositoryPath = await mkdtemp(join(tmpdir(), 'devos-058-pr-test-'));
    await runGit(['init'], repositoryPath);
    await runGit(['config', 'user.email', 'devos-test@example.com'], repositoryPath);
    await runGit(['config', 'user.name', 'DevOS Test'], repositoryPath);

    const workspace = await openRepository(repositoryPath);
    // openRepository requires an existing git dir but not necessarily a
    // commit yet — make an initial one so branching from it is valid.
    await writeFileChange(workspace, 'README.md', '# devos-058\n');
    await createCommit(workspace, 'initial commit');
    await createBranch(workspace, 'feature/devos-058');
    await writeFileChange(workspace, 'FEATURE.md', 'a real feature\n');
    await createCommit(workspace, 'Add a real feature');

    deps = createInMemoryDeps();
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

    const capability: ToolCapability = {
      id: randomUUID() as ToolCapability['id'],
      projectId,
      key: 'pull-request-create',
      name: 'Create Pull Request',
      riskClass: 'R3',
      inputSchema: {
        type: 'object',
        properties: {
          sourceBranch: { type: 'string' },
          targetBranch: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['sourceBranch', 'targetBranch', 'title'],
      },
      outputSchema: { type: 'object' },
      status: 'ACTIVE',
      createdAt: now,
    };
    await deps.toolCapabilities.create(capability);

    workflowTaskId = randomUUID() as WorkflowTaskId;
  });

  afterEach(async () => {
    await rm(repositoryPath, { recursive: true, force: true });
  });

  it('creates a pull-request record through the Tool Gateway for a real branch with real commits', async () => {
    deps.adapters = createPullRequestProviderAdapter(createLocalPullRequestProvider());

    const { stdout: log } = await runGit(['log', 'feature/devos-058', '--oneline'], repositoryPath);
    expect(log).toContain('Add a real feature');

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      capabilityKey: 'pull-request-create',
      target: { repositoryPath },
      parameters: {
        sourceBranch: 'feature/devos-058',
        targetBranch: 'master',
        title: 'Add a real feature',
        description: 'Implements a real feature over a real commit.',
        idempotencyKey: 'devos-058-pr-1',
      },
      idempotencyKey: 'devos-058-pr-1',
    });

    expect(invocation.status).toBe('SUCCEEDED');
    expect(invocation.outputMetadata?.pullRequestReference).toBeTruthy();
    expect(invocation.providerReference).toBeTruthy();
  });

  it('is idempotent end-to-end: a repeated request returns the same underlying PR reference', async () => {
    deps.adapters = createPullRequestProviderAdapter(createLocalPullRequestProvider());

    const input = {
      capabilityKey: 'pull-request-create',
      target: { repositoryPath },
      parameters: {
        sourceBranch: 'feature/devos-058',
        targetBranch: 'master',
        title: 'Add a real feature',
        idempotencyKey: 'devos-058-pr-2',
      },
      idempotencyKey: 'devos-058-pr-2',
    };

    const first = await invokeTool(deps, 'alice', projectId, workflowTaskId, input);
    const second = await invokeTool(deps, 'alice', projectId, workflowTaskId, input);

    expect(first.providerReference).toBe(second.providerReference);
    // DEVOS-059: the gateway itself now recognizes the exact replay (same
    // capability + idempotency key + target/parameters) and returns the
    // original invocation rather than recording a second one.
    expect(first.id).toBe(second.id);
  });
});
