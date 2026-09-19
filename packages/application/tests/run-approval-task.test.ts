import { randomUUID } from 'node:crypto';
import type { OrganisationId } from '@devos/contracts';
import type {
  Approval,
  ApprovalRepository,
  ArtifactVersion,
  ArtifactVersionRepository,
  Policy,
  PolicyRepository,
  Project,
  ProjectRepository,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkflowTaskRepository,
  WorkflowVersionRepository,
} from '@devos/domain';
import { describe, expect, it } from 'vitest';
import type { ApprovalTaskHandlerDeps } from '../src/tasks/run-approval-task.js';
import { runApprovalTask } from '../src/tasks/run-approval-task.js';

const now = new Date(0).toISOString();

function makeRun(): WorkflowRun {
  return {
    id: randomUUID() as WorkflowRun['id'],
    projectId: randomUUID() as WorkflowRun['projectId'],
    workflowVersionId: randomUUID() as WorkflowRun['workflowVersionId'],
    workItemId: randomUUID() as WorkflowRun['workItemId'],
    status: 'PENDING',
    input: {},
    createdAt: now,
    updatedAt: now,
  };
}

function makeTask(
  run: WorkflowRun,
  taskKey: string,
  output?: Record<string, unknown>,
): WorkflowTask {
  return {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey,
    taskType: 'APPROVAL',
    status: 'RUNNING',
    attempt: 1,
    input: {},
    ...(output !== undefined ? { output } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

function makeDeps(
  run: WorkflowRun,
  nodeConfig: Record<string, unknown> | undefined,
  options: {
    siblingTasks?: WorkflowTask[];
    artifactVersions?: ArtifactVersion[];
    approvals?: Approval[];
    organisationId?: OrganisationId;
    organisationPolicies?: Policy[];
  } = {},
): ApprovalTaskHandlerDeps & { createdApprovals: Approval[] } {
  const siblingTasks = options.siblingTasks ?? [];
  const artifactVersions = options.artifactVersions ?? [];
  const approvals = [...(options.approvals ?? [])];
  const createdApprovals: Approval[] = [];

  const workflowRuns: WorkflowRunRepository = {
    getById: async (id) => (id === run.id ? run : null),
    getByVersionAndIdempotencyKey: async () => null,
    listForWorkItem: async () => [],
    create: async () => {},
  };

  const workflowVersions: WorkflowVersionRepository = {
    getById: async (id) =>
      id === run.workflowVersionId
        ? {
            id: run.workflowVersionId,
            workflowDefinitionId: randomUUID() as never,
            version: 1,
            status: 'PUBLISHED',
            definition: {
              name: 'Approval Test Workflow',
              trigger: { type: 'WORK_ITEM_MANUAL' },
              inputs: [],
              nodes: [
                {
                  id: 'gate',
                  type: 'APPROVAL',
                  ...(nodeConfig !== undefined ? { config: nodeConfig } : {}),
                },
              ],
              edges: [],
              policies: [],
              outputs: [],
            },
            createdBy: 'test',
            createdAt: now,
          }
        : null,
    getByDefinitionAndVersion: async () => null,
    getLatestForDefinition: async () => null,
    listForDefinition: async () => [],
    create: async () => {},
    updateDefinition: async () => {},
    publish: async () => {},
  };

  const workflowTasks: WorkflowTaskRepository = {
    getById: async (id) => siblingTasks.find((task) => task.id === id) ?? null,
    listForRun: async () => siblingTasks,
    create: async () => {},
  };

  const artifactVersionRepo: ArtifactVersionRepository = {
    getById: async (id) => artifactVersions.find((version) => version.id === id) ?? null,
    listForArtifact: async (artifactId) =>
      artifactVersions.filter((version) => version.artifactId === artifactId),
    create: async () => {},
  };

  const approvalRepo: ApprovalRepository = {
    getById: async (id) => approvals.find((approval) => approval.id === id) ?? null,
    listForProject: async () => [],
    listForRun: async (workflowRunId) =>
      approvals.filter((approval) => approval.workflowRunId === workflowRunId),
    getPendingForRunAndType: async () => null,
    create: async (approval) => {
      approvals.push(approval);
      createdApprovals.push(approval);
    },
    decide: async () => {},
    recordDecision: async () => {},
    listDecisionsForApproval: async () => [],
    expirePending: async () => 0,
  };

  const projects: ProjectRepository | undefined = options.organisationId
    ? {
        getById: async (id) =>
          id === run.projectId
            ? ({
                id: run.projectId,
                organisationId: options.organisationId,
                projectTypeId: randomUUID() as Project['projectTypeId'],
                name: 'Test Project',
                slug: 'test-project',
                status: 'ACTIVE',
                createdAt: now,
                updatedAt: now,
              } as Project)
            : null,
        listForOrganisation: async () => [],
        create: async () => {},
        update: async () => {},
      }
    : undefined;

  const policies: PolicyRepository | undefined = options.organisationPolicies
    ? {
        getById: async () => null,
        getByProjectAndKeyAndVersion: async () => null,
        getLatestForProjectAndKey: async () => null,
        listForProject: async () => [],
        getLatestForOrganisationAndKey: async () => null,
        listForOrganisation: async () => options.organisationPolicies ?? [],
        create: async () => {},
        publish: async () => {},
      }
    : undefined;

  return {
    workflowRuns,
    workflowVersions,
    workflowTasks,
    artifactVersions: artifactVersionRepo,
    approvals: approvalRepo,
    ...(projects ? { projects } : {}),
    ...(policies ? { policies } : {}),
    createdApprovals,
  };
}

describe('runApprovalTask', () => {
  describe('Gap revisit: a created approval carries real ABAC context', () => {
    it('populates workflowId/workflowVersion from the run\'s own real workflow version on every created approval', async () => {
      const run = makeRun();
      const task = makeTask(run, 'gate');
      const deps = makeDeps(run, undefined);

      await runApprovalTask(deps, task);

      const created = deps.createdApprovals[0];
      expect(created?.workflowVersion).toBe(1);
      expect(typeof created?.workflowId).toBe('string');
      expect(created?.riskClass).toBeUndefined();
    });

    it('populates riskClass on the created approval when the node configures one', async () => {
      const run = makeRun();
      const task = makeTask(run, 'gate');
      const deps = makeDeps(run, { riskClass: 'R2' });

      await runApprovalTask(deps, task);

      expect(deps.createdApprovals[0]?.riskClass).toBe('R2');
    });
  });

  describe('DEVOS-146: risk-tiered approval routing', () => {
    it('uses a matching organisation policy rule to set requiredApprovers/enforceSeparationOfDuties', async () => {
      const run = makeRun();
      const organisationId = randomUUID() as OrganisationId;
      const task = makeTask(run, 'gate');
      const policy: Policy = {
        id: randomUUID() as Policy['id'],
        organisationId,
        key: 'risk-tiered-approvals',
        version: 1,
        status: 'PUBLISHED',
        definition: {
          rules: [
            {
              action: 'remediation-approval:gate',
              effect: 'REQUIRE_APPROVAL',
              condition: { riskClass: 'R3' },
              requiredApprovers: 2,
              enforceSeparationOfDuties: true,
            },
          ],
        },
        createdBy: 'alice',
        publishedAt: now,
        createdAt: now,
      };
      const deps = makeDeps(
        run,
        { approvalType: 'remediation-approval', riskClass: 'R3' },
        { organisationId, organisationPolicies: [policy] },
      );

      await runApprovalTask(deps, task);

      expect(deps.createdApprovals[0]).toMatchObject({
        requiredApprovers: 2,
        enforceSeparationOfDuties: true,
      });
    });

    it('uses the default requiredApprovers=1/enforceSeparationOfDuties=false when no policy rule matches the riskClass', async () => {
      const run = makeRun();
      const organisationId = randomUUID() as OrganisationId;
      const task = makeTask(run, 'gate');
      const policy: Policy = {
        id: randomUUID() as Policy['id'],
        organisationId,
        key: 'risk-tiered-approvals',
        version: 1,
        status: 'PUBLISHED',
        definition: {
          rules: [
            {
              action: 'remediation-approval:gate',
              effect: 'REQUIRE_APPROVAL',
              condition: { riskClass: 'R3' },
              requiredApprovers: 2,
              enforceSeparationOfDuties: true,
            },
          ],
        },
        createdBy: 'alice',
        publishedAt: now,
        createdAt: now,
      };
      const deps = makeDeps(
        run,
        { approvalType: 'remediation-approval', riskClass: 'R1' },
        { organisationId, organisationPolicies: [policy] },
      );

      await runApprovalTask(deps, task);

      expect(deps.createdApprovals[0]).toMatchObject({
        requiredApprovers: 1,
        enforceSeparationOfDuties: false,
      });
    });

    it('uses the defaults when the node has no riskClass configured at all', async () => {
      const run = makeRun();
      const organisationId = randomUUID() as OrganisationId;
      const task = makeTask(run, 'gate');
      const deps = makeDeps(run, { approvalType: 'remediation-approval' }, { organisationId });

      await runApprovalTask(deps, task);

      expect(deps.createdApprovals[0]).toMatchObject({
        requiredApprovers: 1,
        enforceSeparationOfDuties: false,
      });
    });
  });

  it('creates a pending approval and reports waitUntil on its first call', async () => {
    const run = makeRun();
    const task = makeTask(run, 'gate');
    const deps = makeDeps(run, undefined);

    const output = await runApprovalTask(deps, task);

    expect(deps.createdApprovals).toHaveLength(1);
    const created = deps.createdApprovals[0];
    expect(created).toBeDefined();
    expect(created?.status).toBe('PENDING');
    expect(created?.approvalType).toBe('gate');
    expect(output.approvalId).toBe(created?.id);
    expect(typeof output.waitUntil).toBe('string');
  });

  it('namespaces approvalType with the node key when config.approvalType is set', async () => {
    const run = makeRun();
    const task = makeTask(run, 'gate');
    const deps = makeDeps(run, { approvalType: 'MID_BRANCH' });

    await runApprovalTask(deps, task);

    expect(deps.createdApprovals[0]?.approvalType).toBe('MID_BRANCH:gate');
  });

  it('binds evidence to the latest artifact version produced by a prior task in the run', async () => {
    const run = makeRun();
    const task = makeTask(run, 'gate');
    const artifactId = randomUUID();
    const producer = makeTask(run, 'produce', { artifactId });
    const olderVersion: ArtifactVersion = {
      id: randomUUID() as ArtifactVersion['id'],
      artifactId: artifactId as ArtifactVersion['artifactId'],
      version: 1,
      contentType: 'text/plain',
      contentUri: 'file:///old',
      contentHash: 'old',
      createdBy: 'test',
      createdAt: now,
    };
    const latestVersion: ArtifactVersion = {
      ...olderVersion,
      id: randomUUID() as ArtifactVersion['id'],
      version: 2,
      contentUri: 'file:///latest',
      contentHash: 'latest',
    };
    const deps = makeDeps(run, undefined, {
      siblingTasks: [producer],
      artifactVersions: [olderVersion, latestVersion],
    });

    await runApprovalTask(deps, task);

    expect(deps.createdApprovals[0]?.evidenceReference.artifactVersionIds).toEqual([
      latestVersion.id,
    ]);
  });

  it('reports another waitUntil while the approval is still pending', async () => {
    const run = makeRun();
    const approvalId = randomUUID() as Approval['id'];
    const pending: Approval = {
      id: approvalId,
      projectId: run.projectId,
      workflowRunId: run.id,
      approvalType: 'gate',
      status: 'PENDING',
      requestedBy: 'devos-worker',
      evidenceReference: { artifactVersionIds: [], scopeHash: 'hash' },
      requestedAt: now,
      requiredApprovers: 1,
      enforceSeparationOfDuties: false,
    };
    const task = makeTask(run, 'gate');
    const deps = makeDeps(run, undefined, { approvals: [pending] });

    const output = await runApprovalTask(deps, task);

    expect(deps.createdApprovals).toHaveLength(0);
    expect(output.approvalId).toBe(approvalId);
    expect(typeof output.waitUntil).toBe('string');
  });

  it('completes once the approval is APPROVED', async () => {
    const run = makeRun();
    const approvalId = randomUUID() as Approval['id'];
    const approved: Approval = {
      id: approvalId,
      projectId: run.projectId,
      workflowRunId: run.id,
      approvalType: 'gate',
      status: 'APPROVED',
      requestedBy: 'devos-worker',
      decidedBy: 'owner@example.com',
      evidenceReference: { artifactVersionIds: [], scopeHash: 'hash' },
      requestedAt: now,
      decidedAt: now,
      requiredApprovers: 1,
      enforceSeparationOfDuties: false,
    };
    const task = makeTask(run, 'gate');
    const deps = makeDeps(run, undefined, { approvals: [approved] });

    const output = await runApprovalTask(deps, task);

    expect(output).toMatchObject({
      status: 'SUCCEEDED',
      approvalId,
      decidedBy: 'owner@example.com',
    });
  });

  it('throws a non-retryable error once the approval is REJECTED', async () => {
    const run = makeRun();
    const approvalId = randomUUID() as Approval['id'];
    const rejected: Approval = {
      id: approvalId,
      projectId: run.projectId,
      workflowRunId: run.id,
      approvalType: 'gate',
      status: 'REJECTED',
      requestedBy: 'devos-worker',
      decidedBy: 'owner@example.com',
      decisionReason: 'Not ready.',
      evidenceReference: { artifactVersionIds: [], scopeHash: 'hash' },
      requestedAt: now,
      decidedAt: now,
      requiredApprovers: 1,
      enforceSeparationOfDuties: false,
    };
    const task = makeTask(run, 'gate');
    const deps = makeDeps(run, undefined, { approvals: [rejected] });

    await expect(runApprovalTask(deps, task)).rejects.toThrow('Not ready.');
  });

  it('throws when the run cannot be found', async () => {
    const run = makeRun();
    const task = makeTask(run, 'gate');
    const deps = makeDeps(run, undefined);
    const missingTask = { ...task, workflowRunId: randomUUID() as WorkflowTask['workflowRunId'] };

    await expect(runApprovalTask(deps, missingTask)).rejects.toThrow('not found');
  });
});
