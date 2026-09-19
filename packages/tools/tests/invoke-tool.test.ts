import { randomUUID } from 'node:crypto';
import type { WorkflowTaskId } from '@devos/contracts';
import type {
  AgentVersion,
  AgentVersionRepository,
  Approval,
  ApprovalRepository,
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
  WorkflowTask,
  WorkflowTaskRepository,
  WorkflowVersion,
  WorkflowVersionRepository,
} from '@devos/domain';
import { NotFoundError } from '@devos/domain';
import type { PolicyDefinition } from '@devos/policy';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ToolGatewayDeps } from '../src/gateway/deps.js';
import { invokeTool } from '../src/gateway/invoke-tool.js';
import type { ProviderAdapter } from '../src/gateway/types.js';

const CAPABILITY_INPUT_SCHEMA = {
  type: 'object',
  properties: { branch: { type: 'string' }, message: { type: 'string' } },
  required: ['branch', 'message'],
};

function createInMemoryDeps(): {
  deps: ToolGatewayDeps;
  policiesStore: Map<string, Policy>;
  invocationsStore: Map<string, ToolInvocation>;
  auditRecordsStore: AuditRecord[];
  agentVersionsStore: Map<string, AgentVersion>;
  workflowVersionsStore: Map<string, WorkflowVersion>;
  approvalsStore: Map<string, Approval>;
  workflowTasksStore: Map<string, WorkflowTask>;
  // Not spread into `deps` above by default — every existing test keeps
  // exercising the "not wired" fallback path unchanged; tests that need the
  // real REQUIRE_APPROVAL flow spread these two into their own `deps` copy.
  approvals: ApprovalRepository;
  workflowTasks: WorkflowTaskRepository;
} {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();
  const capabilities = new Map<string, ToolCapability>();
  const policiesStore = new Map<string, Policy>();
  const invocationsStore = new Map<string, ToolInvocation>();
  const auditRecordsStore: AuditRecord[] = [];
  const agentVersionsStore = new Map<string, AgentVersion>();
  const workflowVersionsStore = new Map<string, WorkflowVersion>();

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
    getByProjectAndKeyAndVersion: async (projectId, key, version) =>
      [...policiesStore.values()].find(
        (p) => p.projectId === projectId && p.key === key && p.version === version,
      ) ?? null,
    getLatestForProjectAndKey: async (projectId, key) =>
      [...policiesStore.values()]
        .filter((p) => p.projectId === projectId && p.key === key)
        .sort((a, b) => b.version - a.version)[0] ?? null,
    listForProject: async (projectId) =>
      [...policiesStore.values()].filter((p) => p.projectId === projectId),
    getLatestForOrganisationAndKey: async (organisationId, key) =>
      [...policiesStore.values()]
        .filter(
          (p) => p.organisationId === organisationId && p.projectId === undefined && p.key === key,
        )
        .sort((a, b) => b.version - a.version)[0] ?? null,
    listForOrganisation: async (organisationId) =>
      [...policiesStore.values()].filter(
        (p) => p.organisationId === organisationId && p.projectId === undefined,
      ),
    create: async (policy) => {
      policiesStore.set(policy.id, policy);
    },
    publish: async (id, publishedAt) => {
      const existing = policiesStore.get(id);
      if (!existing) return;
      policiesStore.set(id, { ...existing, status: 'PUBLISHED', publishedAt });
    },
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

  const auditRecords: AuditRecordRepository = {
    create: async (record) => {
      auditRecordsStore.push(record);
    },
    listForProject: async (projectId) => auditRecordsStore.filter((r) => r.projectId === projectId),
    listForOrganisation: async (organisationId) =>
      auditRecordsStore.filter((r) => r.organisationId === organisationId),
  };

  const agentVersions: AgentVersionRepository = {
    getById: async (id) => agentVersionsStore.get(id) ?? null,
    getByAgentAndVersion: async (agentId, version) =>
      [...agentVersionsStore.values()].find(
        (v) => v.agentId === agentId && v.version === version,
      ) ?? null,
    getLatestForAgent: async (agentId) =>
      [...agentVersionsStore.values()]
        .filter((v) => v.agentId === agentId)
        .sort((a, b) => b.version - a.version)[0] ?? null,
    listForAgent: async (agentId) =>
      [...agentVersionsStore.values()].filter((v) => v.agentId === agentId),
    create: async (version) => {
      agentVersionsStore.set(version.id, version);
    },
    publish: async (id, publishedAt) => {
      const existing = agentVersionsStore.get(id);
      if (!existing) return;
      agentVersionsStore.set(id, { ...existing, status: 'PUBLISHED', publishedAt });
    },
  };

  const workflowVersions: WorkflowVersionRepository = {
    getById: async (id) => workflowVersionsStore.get(id) ?? null,
    getByDefinitionAndVersion: async (workflowDefinitionId, version) =>
      [...workflowVersionsStore.values()].find(
        (v) => v.workflowDefinitionId === workflowDefinitionId && v.version === version,
      ) ?? null,
    getLatestForDefinition: async (workflowDefinitionId) =>
      [...workflowVersionsStore.values()]
        .filter((v) => v.workflowDefinitionId === workflowDefinitionId)
        .sort((a, b) => b.version - a.version)[0] ?? null,
    listForDefinition: async (workflowDefinitionId) =>
      [...workflowVersionsStore.values()].filter(
        (v) => v.workflowDefinitionId === workflowDefinitionId,
      ),
    create: async (version) => {
      workflowVersionsStore.set(version.id, version);
    },
    updateDefinition: async (id, definition) => {
      const existing = workflowVersionsStore.get(id);
      if (!existing) return;
      workflowVersionsStore.set(id, { ...existing, definition });
    },
    publish: async (id, publishedAt) => {
      const existing = workflowVersionsStore.get(id);
      if (!existing) return;
      workflowVersionsStore.set(id, { ...existing, status: 'PUBLISHED', publishedAt });
    },
  };

  const approvalsStore = new Map<string, Approval>();
  const approvals: ApprovalRepository = {
    getById: async (id) => approvalsStore.get(id) ?? null,
    listForProject: async (projectId) =>
      [...approvalsStore.values()].filter((a) => a.projectId === projectId),
    listForRun: async (workflowRunId) =>
      [...approvalsStore.values()].filter((a) => a.workflowRunId === workflowRunId),
    getPendingForRunAndType: async (workflowRunId, approvalType) =>
      [...approvalsStore.values()].find(
        (a) =>
          a.workflowRunId === workflowRunId &&
          a.approvalType === approvalType &&
          a.status === 'PENDING',
      ) ?? null,
    create: async (approval) => {
      approvalsStore.set(approval.id, approval);
    },
    decide: async (id, status, decidedBy, decisionReason, decidedAt) => {
      const existing = approvalsStore.get(id);
      if (!existing) return;
      approvalsStore.set(id, {
        ...existing,
        status,
        decidedBy,
        ...(decisionReason !== undefined ? { decisionReason } : {}),
        decidedAt,
      });
    },
    recordDecision: async () => {},
    listDecisionsForApproval: async () => [],
    expirePending: async () => 0,
  };

  const workflowTasksStore = new Map<string, WorkflowTask>();
  const workflowTasks: WorkflowTaskRepository = {
    getById: async (id) => workflowTasksStore.get(id) ?? null,
    listForRun: async (workflowRunId) =>
      [...workflowTasksStore.values()].filter((t) => t.workflowRunId === workflowRunId),
    create: async (task) => {
      workflowTasksStore.set(task.id, task);
    },
  };

  return {
    deps: {
      projects: projectRepository,
      memberships: membershipRepository,
      policies,
      toolCapabilities,
      toolInvocations,
      auditRecords,
      agentVersions,
      workflowVersions,
      adapters: {},
    },
    policiesStore,
    invocationsStore,
    auditRecordsStore,
    agentVersionsStore,
    workflowVersionsStore,
    approvalsStore,
    workflowTasksStore,
    approvals,
    workflowTasks,
  };
}

function seedWorkflowVersion(
  workflowVersionsStore: Map<string, WorkflowVersion>,
  overrides: Partial<WorkflowVersion> = {},
): WorkflowVersion {
  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: randomUUID() as WorkflowVersion['workflowDefinitionId'],
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: 'Test Workflow',
      trigger: {},
      inputs: [],
      nodes: [],
      edges: [],
      policies: [],
      outputs: [],
    },
    createdBy: 'alice',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  workflowVersionsStore.set(version.id, version);
  return version;
}

function seedAgentVersion(
  agentVersionsStore: Map<string, AgentVersion>,
  allowedCapabilities: string[],
): AgentVersion {
  const version: AgentVersion = {
    id: randomUUID() as AgentVersion['id'],
    agentId: randomUUID() as AgentVersion['agentId'],
    version: 1,
    status: 'PUBLISHED',
    configuration: {
      role: 'DEVELOPMENT',
      provider: 'fake',
      modelRef: 'fake-model',
      outputSchemaRef: 'proposed-change-v1',
      allowedCapabilities,
    },
    createdBy: 'alice',
    createdAt: new Date().toISOString(),
  };
  agentVersionsStore.set(version.id, version);
  return version;
}

async function seedCapability(
  deps: ToolGatewayDeps,
  projectId: Project['id'],
  overrides: Partial<ToolCapability> = {},
): Promise<ToolCapability> {
  const capability: ToolCapability = {
    id: randomUUID() as ToolCapability['id'],
    projectId,
    key: 'git-commit',
    name: 'Create Git Commit',
    riskClass: 'R2',
    inputSchema: CAPABILITY_INPUT_SCHEMA,
    outputSchema: { type: 'object' },
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  await deps.toolCapabilities.create(capability);
  return capability;
}

function publishedPolicy(
  projectId: Project['id'],
  organisationId: OrganisationId,
  definition: PolicyDefinition,
): Policy {
  return {
    id: randomUUID() as Policy['id'],
    organisationId,
    projectId,
    key: 'tool-gateway-test-policy',
    version: 1,
    status: 'PUBLISHED',
    definition: definition as unknown as Record<string, unknown>,
    createdBy: 'alice',
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

const VALID_INPUT = {
  capabilityKey: 'git-commit',
  target: { repositoryId: 'repo-1' },
  parameters: { branch: 'feature/x', message: 'do the thing' },
  idempotencyKey: 'idem-1',
};

describe('invokeTool', () => {
  let deps: ToolGatewayDeps;
  let projectId: Project['id'];
  let workflowTaskId: WorkflowTaskId;
  let auditRecordsStore: AuditRecord[];
  let agentVersionsStore: Map<string, AgentVersion>;
  let workflowVersionsStore: Map<string, WorkflowVersion>;
  const organisationId = randomUUID() as OrganisationId;

  beforeEach(async () => {
    ({ deps, auditRecordsStore, agentVersionsStore, workflowVersionsStore } = createInMemoryDeps());
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
    workflowTaskId = randomUUID() as WorkflowTaskId;
  });

  it('invokes the registered adapter and records SUCCEEDED', async () => {
    await seedCapability(deps, projectId);
    const adapter: ProviderAdapter = {
      invoke: async () => ({
        outputMetadata: { commitSha: 'abc123' },
        providerReference: 'abc123',
      }),
    };
    deps.adapters['git-commit'] = adapter;

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);

    expect(invocation.status).toBe('SUCCEEDED');
    expect(invocation.outputMetadata).toEqual({ commitSha: 'abc123' });
    expect(invocation.providerReference).toBe('abc123');

    expect(auditRecordsStore).toHaveLength(1);
    expect(auditRecordsStore[0]).toMatchObject({
      actorId: 'alice',
      actorType: 'USER',
      targetType: 'ToolInvocation',
      targetId: invocation.id,
      outcome: 'SUCCESS',
    });
  });

  it('rejects and records when no adapter is registered', async () => {
    await seedCapability(deps, projectId);

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);

    expect(invocation.status).toBe('FAILED');
    expect(invocation.errorCode).toBe('DEVOS_NO_PROVIDER_ADAPTER');
  });

  it('records FAILED when the adapter throws', async () => {
    await seedCapability(deps, projectId);
    deps.adapters['git-commit'] = {
      invoke: async () => {
        throw new Error('provider unreachable');
      },
    };

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);

    expect(invocation.status).toBe('FAILED');
    expect(invocation.errorCode).toBe('provider unreachable');
  });

  it('rejects a capability disabled by its own status, without invoking the adapter', async () => {
    await seedCapability(deps, projectId, { status: 'DISABLED' });
    let invoked = false;
    deps.adapters['git-commit'] = {
      invoke: async () => {
        invoked = true;
        return { outputMetadata: {} };
      },
    };

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);

    expect(invocation.status).toBe('REJECTED');
    expect(invocation.errorCode).toBe('DEVOS_TOOL_CAPABILITY_DISABLED');
    expect(invoked).toBe(false);
  });

  it('rejects on a policy DENY, without invoking the adapter', async () => {
    await seedCapability(deps, projectId);
    const policy = publishedPolicy(projectId, organisationId, {
      rules: [{ action: 'git-commit', effect: 'DENY' }],
    });
    await deps.policies.create(policy);
    let invoked = false;
    deps.adapters['git-commit'] = {
      invoke: async () => {
        invoked = true;
        return { outputMetadata: {} };
      },
    };

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);

    expect(invocation.status).toBe('REJECTED');
    expect(invocation.errorCode).toBe('DEVOS_TOOL_POLICY_DENY');
    expect(invoked).toBe(false);
  });

  it('DEVOS-072: threads a string target.environment into policy evaluation, so an environment-conditioned rule is honoured', async () => {
    await seedCapability(deps, projectId, { key: 'deploy' });
    const policy = publishedPolicy(projectId, organisationId, {
      rules: [
        { action: 'deploy', effect: 'ALLOW', condition: { environment: 'staging' } },
        { action: 'deploy', effect: 'DENY', condition: { environment: 'production' } },
      ],
    });
    await deps.policies.create(policy);
    const invokedTargets: Array<Record<string, unknown>> = [];
    deps.adapters['deploy'] = {
      invoke: async (target) => {
        invokedTargets.push(target);
        return { outputMetadata: {} };
      },
    };

    const staging = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      capabilityKey: 'deploy',
      target: { environment: 'staging' },
      parameters: { branch: 'feature/x', message: 'deploy' },
      idempotencyKey: 'deploy-staging',
    });
    expect(staging.status).toBe('SUCCEEDED');

    const production = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      capabilityKey: 'deploy',
      target: { environment: 'production' },
      parameters: { branch: 'feature/x', message: 'deploy' },
      idempotencyKey: 'deploy-production',
    });
    expect(production.status).toBe('REJECTED');
    expect(production.errorCode).toBe('DEVOS_TOOL_POLICY_DENY');

    expect(invokedTargets).toEqual([{ environment: 'staging' }]);
  });

  it('rejects invalid input against the capability input schema', async () => {
    await seedCapability(deps, projectId);

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      ...VALID_INPUT,
      parameters: { branch: 'feature/x' },
    });

    expect(invocation.status).toBe('REJECTED');
    expect(invocation.errorCode).toBe('DEVOS_TOOL_INPUT_INVALID');
  });

  it('throws NotFoundError for an unknown capability key, without recording anything', async () => {
    await expect(
      invokeTool(deps, 'alice', projectId, workflowTaskId, {
        ...VALID_INPUT,
        capabilityKey: 'does-not-exist',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError for a non-member principal', async () => {
    await seedCapability(deps, projectId);

    await expect(
      invokeTool(deps, 'mallory', projectId, workflowTaskId, VALID_INPUT),
    ).rejects.toThrow(NotFoundError);
  });

  it('is idempotent: a retried request with the same key and same target/parameters returns the original invocation without invoking the adapter again', async () => {
    await seedCapability(deps, projectId);
    let invokeCount = 0;
    deps.adapters['git-commit'] = {
      invoke: async () => {
        invokeCount += 1;
        return { outputMetadata: { commitSha: 'abc123' }, providerReference: 'abc123' };
      },
    };

    const first = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);
    const second = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);

    expect(second.id).toBe(first.id);
    expect(invokeCount).toBe(1);
    // The replay is still audited, even though no new invocation is recorded.
    expect(auditRecordsStore.filter((r) => r.targetId === first.id)).toHaveLength(2);
  });

  it('is idempotent even when the persisted parameters have a different key order than the fresh request (a real Postgres jsonb round-trip does not preserve key order)', async () => {
    await seedCapability(deps, projectId);
    let invokeCount = 0;
    deps.adapters['git-commit'] = {
      invoke: async () => {
        invokeCount += 1;
        return { outputMetadata: { commitSha: 'abc123' }, providerReference: 'abc123' };
      },
    };

    const first = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);
    expect(first.status).toBe('SUCCEEDED');

    // Same logical target/parameters as VALID_INPUT, but with every key
    // reordered — exactly what a jsonb round-trip can produce.
    const reorderedParameters = Object.fromEntries(
      Object.entries(VALID_INPUT.parameters).reverse(),
    );
    const reorderedTarget = Object.fromEntries(Object.entries(VALID_INPUT.target).reverse());

    const second = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      ...VALID_INPUT,
      target: reorderedTarget,
      parameters: reorderedParameters,
    });

    expect(second.id).toBe(first.id);
    expect(second.status).toBe('SUCCEEDED');
    expect(invokeCount).toBe(1);
  });

  it('rejects a "branch binding" violation: the same idempotency key reused for different parameters, without invoking the adapter', async () => {
    await seedCapability(deps, projectId);
    let invoked = false;
    deps.adapters['git-commit'] = {
      invoke: async () => {
        invoked = true;
        return { outputMetadata: {}, providerReference: 'abc123' };
      },
    };

    const first = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);
    expect(first.status).toBe('SUCCEEDED');
    expect(invoked).toBe(true);
    invoked = false;

    const replayedWithDifferentBranch = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      ...VALID_INPUT,
      parameters: { ...VALID_INPUT.parameters, branch: 'feature/a-different-branch' },
    });

    expect(replayedWithDifferentBranch.id).not.toBe(first.id);
    expect(replayedWithDifferentBranch.status).toBe('REJECTED');
    expect(replayedWithDifferentBranch.errorCode).toBe('DEVOS_TOOL_BRANCH_BINDING_VIOLATION');
    expect(invoked).toBe(false);
  });

  it('DEVOS-085: rejects an invocation on behalf of an agent version whose allowedCapabilities excludes this capability, without invoking the adapter', async () => {
    await seedCapability(deps, projectId);
    const agentVersion = seedAgentVersion(agentVersionsStore, ['knowledge.read']);
    let invoked = false;
    deps.adapters['git-commit'] = {
      invoke: async () => {
        invoked = true;
        return { outputMetadata: {} };
      },
    };

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      ...VALID_INPUT,
      agentVersionId: agentVersion.id,
    });

    expect(invocation.status).toBe('REJECTED');
    expect(invocation.errorCode).toBe('DEVOS_AGENT_CAPABILITY_DENIED');
    expect(invoked).toBe(false);
  });

  it('DEVOS-085: allows an invocation on behalf of an agent version whose allowedCapabilities includes this capability', async () => {
    await seedCapability(deps, projectId);
    const agentVersion = seedAgentVersion(agentVersionsStore, ['git-commit']);
    deps.adapters['git-commit'] = {
      invoke: async () => ({
        outputMetadata: { commitSha: 'abc123' },
        providerReference: 'abc123',
      }),
    };

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      ...VALID_INPUT,
      agentVersionId: agentVersion.id,
    });

    expect(invocation.status).toBe('SUCCEEDED');
  });

  it('DEVOS-085: rejects when agentVersionId is supplied but does not resolve to any agent version', async () => {
    await seedCapability(deps, projectId);

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      ...VALID_INPUT,
      agentVersionId: randomUUID() as AgentVersion['id'],
    });

    expect(invocation.status).toBe('REJECTED');
    expect(invocation.errorCode).toBe('DEVOS_AGENT_CAPABILITY_DENIED');
  });

  it('DEVOS-139: an organisation-scoped DENY overrides a project-scoped ALLOW for the same action', async () => {
    await seedCapability(deps, projectId);
    const organisationDenyPolicy: Policy = {
      id: randomUUID() as Policy['id'],
      organisationId,
      key: 'org-lockdown',
      version: 1,
      status: 'PUBLISHED',
      definition: { rules: [{ action: 'git-commit', effect: 'DENY' }] } as unknown as Record<
        string,
        unknown
      >,
      createdBy: 'alice',
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await deps.policies.create(organisationDenyPolicy);
    const projectAllowPolicy = publishedPolicy(projectId, organisationId, {
      rules: [{ action: 'git-commit', effect: 'ALLOW' }],
    });
    await deps.policies.create(projectAllowPolicy);
    let invoked = false;
    deps.adapters['git-commit'] = {
      invoke: async () => {
        invoked = true;
        return { outputMetadata: {} };
      },
    };

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);

    expect(invocation.status).toBe('REJECTED');
    expect(invocation.errorCode).toBe('DEVOS_TOOL_POLICY_DENY');
    expect(invoked).toBe(false);
  });

  it('DEVOS-139: a project-scoped ALLOW still governs when no organisation policy addresses the action', async () => {
    await seedCapability(deps, projectId);
    const organisationUnrelatedPolicy: Policy = {
      id: randomUUID() as Policy['id'],
      organisationId,
      key: 'org-unrelated',
      version: 1,
      status: 'PUBLISHED',
      definition: { rules: [{ action: 'deploy', effect: 'DENY' }] } as unknown as Record<
        string,
        unknown
      >,
      createdBy: 'alice',
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await deps.policies.create(organisationUnrelatedPolicy);
    deps.adapters['git-commit'] = {
      invoke: async () => ({ outputMetadata: { commitSha: 'abc123' } }),
    };

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);

    expect(invocation.status).toBe('SUCCEEDED');
  });

  it('DEVOS-138: a policy keyed on riskClass governs a real tool invocation', async () => {
    await seedCapability(deps, projectId, { riskClass: 'R3' });
    const policy = publishedPolicy(projectId, organisationId, {
      rules: [{ action: 'git-commit', effect: 'DENY', condition: { riskClass: 'R3' } }],
    });
    await deps.policies.create(policy);
    let invoked = false;
    deps.adapters['git-commit'] = {
      invoke: async () => {
        invoked = true;
        return { outputMetadata: {} };
      },
    };

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);

    expect(invocation.status).toBe('REJECTED');
    expect(invocation.errorCode).toBe('DEVOS_TOOL_POLICY_DENY');
    expect(invoked).toBe(false);
  });

  it('DEVOS-138: a policy keyed on workflowId/workflowVersion governs a real tool invocation', async () => {
    await seedCapability(deps, projectId);
    const workflowVersion = seedWorkflowVersion(workflowVersionsStore);
    const policy = publishedPolicy(projectId, organisationId, {
      rules: [
        {
          action: 'git-commit',
          effect: 'DENY',
          condition: {
            workflowId: workflowVersion.workflowDefinitionId,
            workflowVersion: workflowVersion.version,
          },
        },
      ],
    });
    await deps.policies.create(policy);
    let invoked = false;
    deps.adapters['git-commit'] = {
      invoke: async () => {
        invoked = true;
        return { outputMetadata: {} };
      },
    };

    const governed = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      ...VALID_INPUT,
      workflowVersionId: workflowVersion.id,
    });
    expect(governed.status).toBe('REJECTED');
    expect(governed.errorCode).toBe('DEVOS_TOOL_POLICY_DENY');
    expect(invoked).toBe(false);

    const otherWorkflowVersion = seedWorkflowVersion(workflowVersionsStore);
    const ungoverned = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      ...VALID_INPUT,
      idempotencyKey: 'idem-2',
      workflowVersionId: otherWorkflowVersion.id,
    });
    expect(ungoverned.status).toBe('SUCCEEDED');
    expect(invoked).toBe(true);
  });

  it('DEVOS-088: records a supplied correlationId in both inputMetadata and the audit record', async () => {
    await seedCapability(deps, projectId);
    deps.adapters['git-commit'] = {
      invoke: async () => ({
        outputMetadata: { commitSha: 'abc123' },
        providerReference: 'abc123',
      }),
    };

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      ...VALID_INPUT,
      correlationId: 'trace-1234',
    });

    expect(invocation.inputMetadata).toMatchObject({ correlationId: 'trace-1234' });
    const record = auditRecordsStore.find((r) => r.targetId === invocation.id);
    expect(record?.correlationId).toBe('trace-1234');
  });

  it('DEVOS-088: omits correlationId from inputMetadata and the audit record when none is supplied', async () => {
    await seedCapability(deps, projectId);
    deps.adapters['git-commit'] = {
      invoke: async () => ({
        outputMetadata: { commitSha: 'abc123' },
        providerReference: 'abc123',
      }),
    };

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);

    expect(invocation.inputMetadata).not.toHaveProperty('correlationId');
    const record = auditRecordsStore.find((r) => r.targetId === invocation.id);
    expect(record?.correlationId).toBeUndefined();
  });

  it('DEVOS-116: records an allowed agentVersionId in both inputMetadata and the audit record metadata — a durable attribution trail, not just the transient gate check', async () => {
    await seedCapability(deps, projectId);
    const agentVersion = seedAgentVersion(agentVersionsStore, ['git-commit']);
    deps.adapters['git-commit'] = {
      invoke: async () => ({
        outputMetadata: { commitSha: 'abc123' },
        providerReference: 'abc123',
      }),
    };

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, {
      ...VALID_INPUT,
      agentVersionId: agentVersion.id,
    });

    expect(invocation.status).toBe('SUCCEEDED');
    expect(invocation.inputMetadata).toMatchObject({ agentVersionId: agentVersion.id });
    const record = auditRecordsStore.find((r) => r.targetId === invocation.id);
    expect(record?.metadata).toMatchObject({ agentVersionId: agentVersion.id });
  });

  it('DEVOS-116: omits agentVersionId from inputMetadata and the audit record metadata when the invocation is not carrying out any agent proposal', async () => {
    await seedCapability(deps, projectId);
    deps.adapters['git-commit'] = {
      invoke: async () => ({
        outputMetadata: { commitSha: 'abc123' },
        providerReference: 'abc123',
      }),
    };

    const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);

    expect(invocation.inputMetadata).not.toHaveProperty('agentVersionId');
    const record = auditRecordsStore.find((r) => r.targetId === invocation.id);
    expect(record?.metadata).not.toHaveProperty('agentVersionId');
  });

  describe('Gap revisit: a policy REQUIRE_APPROVAL decision creates and resolves a real Approval', () => {
    function seedWorkflowTask(
      workflowTasksStore: Map<string, WorkflowTask>,
      taskId: WorkflowTaskId,
    ): WorkflowTask {
      const now = new Date().toISOString();
      const task: WorkflowTask = {
        id: taskId,
        workflowRunId: randomUUID() as WorkflowTask['workflowRunId'],
        taskKey: 'release',
        taskType: 'TOOL_TASK',
        status: 'RUNNING',
        attempt: 1,
        input: {},
        createdAt: now,
        updatedAt: now,
      };
      workflowTasksStore.set(task.id, task);
      return task;
    }

    it('falls back to the old straight-rejection behaviour when approvals/workflowTasks are not wired', async () => {
      await seedCapability(deps, projectId);
      const policy = publishedPolicy(projectId, organisationId, {
        rules: [{ action: 'git-commit', effect: 'REQUIRE_APPROVAL' }],
      });
      await deps.policies.create(policy);

      const invocation = await invokeTool(deps, 'alice', projectId, workflowTaskId, VALID_INPUT);

      expect(invocation.status).toBe('REJECTED');
      expect(invocation.errorCode).toBe('DEVOS_TOOL_POLICY_REQUIRE_APPROVAL');
    });

    it('creates a real, PENDING Approval on the first invocation and rejects with a distinguishable "pending" code', async () => {
      const { approvals, workflowTasks, workflowTasksStore } = createInMemoryDeps();
      const fullDeps: ToolGatewayDeps = { ...deps, approvals, workflowTasks };
      await seedCapability(fullDeps, projectId);
      const task = seedWorkflowTask(workflowTasksStore, workflowTaskId);
      const policy = publishedPolicy(projectId, organisationId, {
        rules: [{ action: 'git-commit', effect: 'REQUIRE_APPROVAL' }],
      });
      await fullDeps.policies.create(policy);
      let invoked = false;
      fullDeps.adapters['git-commit'] = {
        invoke: async () => {
          invoked = true;
          return { outputMetadata: {} };
        },
      };

      const invocation = await invokeTool(fullDeps, 'alice', projectId, workflowTaskId, VALID_INPUT);

      expect(invocation.status).toBe('REJECTED');
      expect(invocation.errorCode).toBe('DEVOS_TOOL_POLICY_REQUIRE_APPROVAL_PENDING');
      expect(invoked).toBe(false);

      const created = await approvals.listForRun(task.workflowRunId);
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        status: 'PENDING',
        requestedBy: 'alice',
        riskClass: 'R2',
      });
    });

    it('resolves the same Approval (does not create a second) on a retried invocation with the same idempotencyKey', async () => {
      const { approvals, workflowTasks, workflowTasksStore } = createInMemoryDeps();
      const fullDeps: ToolGatewayDeps = { ...deps, approvals, workflowTasks };
      await seedCapability(fullDeps, projectId);
      const task = seedWorkflowTask(workflowTasksStore, workflowTaskId);
      const policy = publishedPolicy(projectId, organisationId, {
        rules: [{ action: 'git-commit', effect: 'REQUIRE_APPROVAL' }],
      });
      await fullDeps.policies.create(policy);

      await invokeTool(fullDeps, 'alice', projectId, workflowTaskId, VALID_INPUT);
      await invokeTool(fullDeps, 'alice', projectId, workflowTaskId, VALID_INPUT);

      const created = await approvals.listForRun(task.workflowRunId);
      expect(created).toHaveLength(1);
    });

    it('proceeds to invoke the real adapter once the real Approval is APPROVED', async () => {
      const { approvals, workflowTasks, workflowTasksStore } = createInMemoryDeps();
      const fullDeps: ToolGatewayDeps = { ...deps, approvals, workflowTasks };
      await seedCapability(fullDeps, projectId);
      const task = seedWorkflowTask(workflowTasksStore, workflowTaskId);
      const policy = publishedPolicy(projectId, organisationId, {
        rules: [{ action: 'git-commit', effect: 'REQUIRE_APPROVAL' }],
      });
      await fullDeps.policies.create(policy);
      fullDeps.adapters['git-commit'] = {
        invoke: async () => ({ outputMetadata: { commitSha: 'abc123' } }),
      };

      const first = await invokeTool(fullDeps, 'alice', projectId, workflowTaskId, VALID_INPUT);
      expect(first.status).toBe('REJECTED');

      const pending = (await approvals.listForRun(task.workflowRunId))[0]!;
      await approvals.decide(pending.id, 'APPROVED', 'bob', undefined, new Date().toISOString());

      // Same idempotencyKey as the first call — the realistic retry a task
      // handler's own WAIT-style polling would make, now that the dedup
      // check correctly does not replay a stale "still pending" rejection.
      const second = await invokeTool(fullDeps, 'alice', projectId, workflowTaskId, VALID_INPUT);

      expect(second.status).toBe('SUCCEEDED');
      expect(second.outputMetadata).toEqual({ commitSha: 'abc123' });
    });

    it('permanently rejects once the real Approval is REJECTED, without ever invoking the adapter', async () => {
      const { approvals, workflowTasks, workflowTasksStore } = createInMemoryDeps();
      const fullDeps: ToolGatewayDeps = { ...deps, approvals, workflowTasks };
      await seedCapability(fullDeps, projectId);
      const task = seedWorkflowTask(workflowTasksStore, workflowTaskId);
      const policy = publishedPolicy(projectId, organisationId, {
        rules: [{ action: 'git-commit', effect: 'REQUIRE_APPROVAL' }],
      });
      await fullDeps.policies.create(policy);
      let invoked = false;
      fullDeps.adapters['git-commit'] = {
        invoke: async () => {
          invoked = true;
          return { outputMetadata: {} };
        },
      };

      await invokeTool(fullDeps, 'alice', projectId, workflowTaskId, VALID_INPUT);
      const pending = (await approvals.listForRun(task.workflowRunId))[0]!;
      await approvals.decide(pending.id, 'REJECTED', 'bob', 'Too risky.', new Date().toISOString());

      // Same idempotencyKey as the first call — see the "APPROVED" test above.
      const second = await invokeTool(fullDeps, 'alice', projectId, workflowTaskId, VALID_INPUT);

      expect(second.status).toBe('REJECTED');
      expect(second.errorCode).toBe('DEVOS_TOOL_POLICY_REQUIRE_APPROVAL_REJECTED');
      expect(invoked).toBe(false);
    });

    it('carries the real agentId/agentVersion/workflowId/workflowVersion ABAC context on the created Approval', async () => {
      const {
        deps: freshDeps,
        approvals,
        workflowTasks,
        workflowTasksStore,
        agentVersionsStore,
        workflowVersionsStore: fullWorkflowVersionsStore,
      } = createInMemoryDeps();
      const fullDeps: ToolGatewayDeps = {
        ...deps,
        approvals,
        workflowTasks,
        agentVersions: freshDeps.agentVersions,
        workflowVersions: freshDeps.workflowVersions,
      };
      await seedCapability(fullDeps, projectId, { key: 'git-commit' });
      const task = seedWorkflowTask(workflowTasksStore, workflowTaskId);
      const agentVersion = seedAgentVersion(agentVersionsStore, ['git-commit']);
      const workflowVersion = seedWorkflowVersion(fullWorkflowVersionsStore);
      const policy = publishedPolicy(projectId, organisationId, {
        rules: [{ action: 'git-commit', effect: 'REQUIRE_APPROVAL' }],
      });
      await fullDeps.policies.create(policy);

      await invokeTool(fullDeps, 'alice', projectId, workflowTaskId, {
        ...VALID_INPUT,
        agentVersionId: agentVersion.id,
        workflowVersionId: workflowVersion.id,
      });

      const created = (await approvals.listForRun(task.workflowRunId))[0];
      expect(created).toMatchObject({
        agentId: agentVersion.agentId,
        agentVersion: agentVersion.version,
        workflowId: workflowVersion.workflowDefinitionId,
        workflowVersion: workflowVersion.version,
      });
    });
  });
});
