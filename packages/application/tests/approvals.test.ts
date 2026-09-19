import { createHash, randomUUID } from 'node:crypto';
import type {
  Approval,
  ApprovalDecisionRecord,
  ApprovalRepository,
  ArtifactVersion,
  ArtifactVersionRepository,
  Membership,
  MembershipRepository,
  OrganisationId,
  Policy,
  PolicyRepository,
  Project,
  ProjectRepository,
  WorkflowDefinition,
  WorkflowDefinitionRepository,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTaskRepository,
  WorkflowVersion,
  WorkflowVersionRepository,
  WorkItem,
  WorkItemRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { approveApproval, rejectApproval } from '../src/approval/decide-approval.js';
import type { ApprovalUseCaseDeps } from '../src/approval/deps.js';
import { getApprovalForPrincipal } from '../src/approval/get-approval.js';
import { listApprovalsForProject } from '../src/approval/list-approvals-for-project.js';
import { listApprovalsForRun } from '../src/approval/list-approvals-for-run.js';
import { requestApproval } from '../src/approval/request-approval.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/errors.js';

function createDeps(): {
  deps: ApprovalUseCaseDeps;
  run: WorkflowRun;
  artifactVersionId: string;
  addMember: (principalId: string, role: 'OWNER' | 'MEMBER') => void;
  transitionCalls: Array<{
    approvalId: string;
    workflowRunId: string;
    approvalType: string;
    decision: 'APPROVED' | 'REJECTED';
  }>;
} {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();
  const approvalsStore = new Map<string, Approval>();
  const decisionsStore: ApprovalDecisionRecord[] = [];
  const organisationId = randomUUID() as OrganisationId;

  const projectRepository: ProjectRepository = {
    getById: async (id) => projects.get(id) ?? null,
    listForOrganisation: async (orgId) =>
      [...projects.values()].filter((p) => p.organisationId === orgId),
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

  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId,
    name: 'Test Project',
    slug: 'test-project',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  projects.set(project.id, project);
  const ownerMembershipId = randomUUID() as Membership['id'];
  memberships.set(ownerMembershipId, {
    id: ownerMembershipId,
    organisationId,
    projectId: project.id,
    principalId: 'alice',
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const run: WorkflowRun = {
    id: randomUUID() as WorkflowRun['id'],
    projectId: project.id,
    workflowVersionId: randomUUID() as WorkflowRun['workflowVersionId'],
    workItemId: randomUUID() as WorkflowRun['workItemId'],
    status: 'AWAITING_APPROVAL',
    input: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const workflowRuns: WorkflowRunRepository = {
    getById: async (id) => (id === run.id ? run : null),
    getByVersionAndIdempotencyKey: async () => null,
    create: async () => {},
  };

  const artifactVersionId = randomUUID();
  const artifactVersion: ArtifactVersion = {
    id: artifactVersionId as ArtifactVersion['id'],
    artifactId: randomUUID() as ArtifactVersion['artifactId'],
    version: 1,
    contentType: 'application/json',
    contentUri: 'mem://x',
    contentHash: 'hash',
    createdBy: 'alice',
    createdAt: new Date().toISOString(),
  };
  const artifactVersions: ArtifactVersionRepository = {
    getById: async (id) => (id === artifactVersion.id ? artifactVersion : null),
    listForArtifact: async () => [artifactVersion],
    create: async () => {},
  };

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
    recordDecision: async (record) => {
      decisionsStore.push(record);
    },
    listDecisionsForApproval: async (approvalId) =>
      decisionsStore.filter((decision) => decision.approvalId === approvalId),
    expirePending: async (now) => {
      let count = 0;
      for (const [id, approval] of approvalsStore) {
        if (approval.status === 'PENDING' && approval.expiresAt && approval.expiresAt < now) {
          approvalsStore.set(id, { ...approval, status: 'EXPIRED' });
          count += 1;
        }
      }
      return count;
    },
  };

  // DEVOS-110: an empty published-policy set — evaluatePolicies() falls
  // through to its own global ALLOW default, matching every existing test
  // here's own pre-DEVOS-110 expectations unchanged. Policy-driven denial
  // gets its own dedicated test below.
  const policiesStore: Policy[] = [];
  const policyRepository: PolicyRepository = {
    getById: async (id) => policiesStore.find((p) => p.id === id) ?? null,
    getByProjectAndKeyAndVersion: async () => null,
    getLatestForProjectAndKey: async () => null,
    listForProject: async (projectId) => policiesStore.filter((p) => p.projectId === projectId),
    getLatestForOrganisationAndKey: async () => null,
    listForOrganisation: async () => [],
    create: async (policy) => {
      policiesStore.push(policy);
    },
    publish: async () => {},
  };

  const addMember = (principalId: string, role: 'OWNER' | 'MEMBER'): void => {
    const id = randomUUID() as Membership['id'];
    memberships.set(id, {
      id,
      organisationId,
      projectId: project.id,
      principalId,
      role,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const transitionCalls: Array<{
    approvalId: string;
    workflowRunId: string;
    approvalType: string;
    decision: 'APPROVED' | 'REJECTED';
  }> = [];

  return {
    deps: {
      projects: projectRepository,
      memberships: membershipRepository,
      workflowRuns,
      artifactVersions,
      approvals,
      policies: policyRepository,
      // DEVOS-111: the real composed function both decides the approval
      // (what the old `approvals.decide` fake call used to do on its own,
      // before decide-approval.ts called it directly) and transitions the
      // run, atomically — this fake replicates both effects so existing
      // assertions (including "rejects deciding an already-decided
      // approval", which depends on the persisted status) keep meaning the
      // same real thing.
      decideApprovalAndTransition: async (
        approvalId,
        workflowRunId,
        approvalType,
        decision,
        decidedBy,
        decisionReason,
        decidedAt,
      ) => {
        await approvals.decide(
          approvalId as Approval['id'],
          decision,
          decidedBy,
          decisionReason,
          decidedAt,
        );
        transitionCalls.push({ approvalId, workflowRunId, approvalType, decision });
      },
    },
    run,
    artifactVersionId,
    addMember,
    transitionCalls,
  };
}

describe('approval use cases', () => {
  let ctx: ReturnType<typeof createDeps>;

  beforeEach(() => {
    ctx = createDeps();
  });

  it('requests an approval bound to the supplied evidence', async () => {
    const { deps, run, artifactVersionId } = ctx;

    const approval = await requestApproval(deps, 'alice', run.projectId, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });

    expect(approval.status).toBe('PENDING');
    expect(approval.evidenceReference.artifactVersionIds).toEqual([artifactVersionId]);
    expect(approval.evidenceReference.scopeHash).toEqual(expect.any(String));
  });

  it('rejects a second pending request of the same type for the same run', async () => {
    const { deps, run, artifactVersionId } = ctx;
    await requestApproval(deps, 'alice', run.projectId, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });

    await expect(
      requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'PLANNING',
        artifactVersionIds: [artifactVersionId],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects evidence referencing a non-existent artifact version', async () => {
    const { deps, run } = ctx;

    await expect(
      requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'PLANNING',
        artifactVersionIds: [randomUUID()],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('approves with the correct scope hash, recording who and why', async () => {
    const { deps, run, artifactVersionId } = ctx;
    const requested = await requestApproval(deps, 'alice', run.projectId, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });

    const decided = await approveApproval(deps, 'alice', requested.id, {
      scopeHash: requested.evidenceReference.scopeHash,
      comment: 'Looks good.',
    });

    expect(decided.status).toBe('APPROVED');
    expect(decided.decidedBy).toBe('alice');
    expect(decided.decisionReason).toBe('Looks good.');
  });

  it('invokes the run transition hook with the correct decision after approving', async () => {
    const { deps, run, artifactVersionId, transitionCalls } = ctx;
    const requested = await requestApproval(deps, 'alice', run.projectId, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });

    await approveApproval(deps, 'alice', requested.id, {
      scopeHash: requested.evidenceReference.scopeHash,
    });

    expect(transitionCalls).toEqual([
      {
        approvalId: requested.id,
        workflowRunId: run.id,
        approvalType: 'PLANNING',
        decision: 'APPROVED',
      },
    ]);
  });

  it('DEVOS-110: a published policy denying this approvalType rejects the decision with a policy-attributed error', async () => {
    const { deps, run, artifactVersionId } = ctx;
    const requested = await requestApproval(deps, 'alice', run.projectId, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });

    await deps.policies.create({
      id: randomUUID() as Policy['id'],
      organisationId: (await deps.projects.getById(run.projectId))!.organisationId,
      projectId: run.projectId,
      key: 'devos-110-deny-planning-approvals',
      version: 1,
      status: 'PUBLISHED',
      definition: { rules: [{ action: 'PLANNING', effect: 'DENY' }] },
      createdBy: 'alice',
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    await expect(
      approveApproval(deps, 'alice', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      approveApproval(deps, 'alice', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      }),
    ).rejects.toThrow(/PLANNING/);
  });

  it('rejects a decision with a mismatched scope hash — the client cannot self-grant authority', async () => {
    const { deps, run, artifactVersionId } = ctx;
    const requested = await requestApproval(deps, 'alice', run.projectId, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });

    await expect(
      approveApproval(deps, 'alice', requested.id, { scopeHash: 'not-the-real-hash' }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a decision from a non-owner member', async () => {
    const { deps, run, artifactVersionId, addMember } = ctx;
    addMember('bob', 'MEMBER');
    const requested = await requestApproval(deps, 'alice', run.projectId, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });

    await expect(
      approveApproval(deps, 'bob', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects deciding an already-decided approval', async () => {
    const { deps, run, artifactVersionId } = ctx;
    const requested = await requestApproval(deps, 'alice', run.projectId, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });
    await approveApproval(deps, 'alice', requested.id, {
      scopeHash: requested.evidenceReference.scopeHash,
    });

    await expect(
      rejectApproval(deps, 'alice', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('lists approvals for a run and gets a single approval, denying non-members', async () => {
    const { deps, run, artifactVersionId } = ctx;
    const requested = await requestApproval(deps, 'alice', run.projectId, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });

    const list = await listApprovalsForRun(deps, 'alice', run.id);
    expect(list).toHaveLength(1);

    const projectList = await listApprovalsForProject(deps, 'alice', run.projectId);
    expect(projectList).toHaveLength(1);

    const fetched = await getApprovalForPrincipal(deps, 'alice', requested.id);
    expect(fetched.id).toBe(requested.id);

    await expect(listApprovalsForRun(deps, 'mallory', run.id)).rejects.toThrow(NotFoundError);
    await expect(getApprovalForPrincipal(deps, 'mallory', requested.id)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('DEVOS-049: a decision cannot be laundered against fabricated evidence that was never actually requested', async () => {
    const { deps, run, artifactVersionId } = ctx;
    const requested = await requestApproval(deps, 'alice', run.projectId, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });

    // An attacker who never saw the real evidence tries a plausible-looking
    // but fabricated hash (a real sha256 hex digest, just computed over
    // different, invented evidence) rather than an obviously malformed
    // string — the check must still fail on value, not merely on shape.
    const fabricatedHash = createHash('sha256')
      .update(JSON.stringify([randomUUID()]))
      .digest('hex');
    expect(fabricatedHash).not.toBe(requested.evidenceReference.scopeHash);

    await expect(
      approveApproval(deps, 'alice', requested.id, { scopeHash: fabricatedHash }),
    ).rejects.toThrow(ValidationError);
  });

  describe('DEVOS-143: multi-approver (N-of-M) approval support', () => {
    it('leaves a requiredApprovers=2 approval PENDING after the first APPROVED decision, without transitioning the run', async () => {
      const { deps, run, artifactVersionId, addMember, transitionCalls } = ctx;
      addMember('bob', 'OWNER');
      const requested = await requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'PLANNING',
        artifactVersionIds: [artifactVersionId],
      });
      await deps.approvals.create({ ...requested, requiredApprovers: 2 });

      const afterFirst = await approveApproval(deps, 'alice', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      });

      expect(afterFirst.status).toBe('PENDING');
      expect(transitionCalls).toHaveLength(0);
    });

    it('finalizes a requiredApprovers=2 approval once a second, distinct principal approves', async () => {
      const { deps, run, artifactVersionId, addMember, transitionCalls } = ctx;
      addMember('bob', 'OWNER');
      const requested = await requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'PLANNING',
        artifactVersionIds: [artifactVersionId],
      });
      await deps.approvals.create({ ...requested, requiredApprovers: 2 });

      await approveApproval(deps, 'alice', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      });
      const afterSecond = await approveApproval(deps, 'bob', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      });

      expect(afterSecond.status).toBe('APPROVED');
      expect(afterSecond.decidedBy).toBe('bob');
      expect(transitionCalls).toEqual([
        {
          approvalId: requested.id,
          workflowRunId: run.id,
          approvalType: 'PLANNING',
          decision: 'APPROVED',
        },
      ]);
    });

    it('rejects the same principal deciding a requiredApprovers=2 approval twice', async () => {
      const { deps, run, artifactVersionId } = ctx;
      const requested = await requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'PLANNING',
        artifactVersionIds: [artifactVersionId],
      });
      await deps.approvals.create({ ...requested, requiredApprovers: 2 });

      await approveApproval(deps, 'alice', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      });

      await expect(
        approveApproval(deps, 'alice', requested.id, {
          scopeHash: requested.evidenceReference.scopeHash,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('a REJECTED decision fails a requiredApprovers=2 approval immediately (fail-fast), even with zero APPROVED decisions yet', async () => {
      const { deps, run, artifactVersionId, transitionCalls } = ctx;
      const requested = await requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'RELEASE',
        artifactVersionIds: [artifactVersionId],
      });
      await deps.approvals.create({ ...requested, requiredApprovers: 2 });

      const decided = await rejectApproval(deps, 'alice', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      });

      expect(decided.status).toBe('REJECTED');
      expect(transitionCalls).toEqual([
        {
          approvalId: requested.id,
          workflowRunId: run.id,
          approvalType: 'RELEASE',
          decision: 'REJECTED',
        },
      ]);
    });
  });

  describe('Gap revisit: configurable requiredRejections (symmetric N-of-M rejection threshold)', () => {
    it('leaves a requiredRejections=2 approval PENDING after the first REJECTED decision, without transitioning the run', async () => {
      const { deps, run, artifactVersionId, addMember, transitionCalls } = ctx;
      addMember('bob', 'OWNER');
      const requested = await requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'RELEASE',
        artifactVersionIds: [artifactVersionId],
      });
      await deps.approvals.create({ ...requested, requiredRejections: 2 });

      const afterFirst = await rejectApproval(deps, 'alice', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      });

      expect(afterFirst.status).toBe('PENDING');
      expect(transitionCalls).toHaveLength(0);
    });

    it('finalizes a requiredRejections=2 approval once a second, distinct principal rejects', async () => {
      const { deps, run, artifactVersionId, addMember, transitionCalls } = ctx;
      addMember('bob', 'OWNER');
      const requested = await requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'RELEASE',
        artifactVersionIds: [artifactVersionId],
      });
      await deps.approvals.create({ ...requested, requiredRejections: 2 });

      await rejectApproval(deps, 'alice', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      });
      const afterSecond = await rejectApproval(deps, 'bob', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      });

      expect(afterSecond.status).toBe('REJECTED');
      expect(afterSecond.decidedBy).toBe('bob');
      expect(transitionCalls).toEqual([
        {
          approvalId: requested.id,
          workflowRunId: run.id,
          approvalType: 'RELEASE',
          decision: 'REJECTED',
        },
      ]);
    });

    it('an APPROVED decision still finalizes normally (at its own requiredApprovers) alongside a non-default requiredRejections', async () => {
      const { deps, run, artifactVersionId, transitionCalls } = ctx;
      const requested = await requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'RELEASE',
        artifactVersionIds: [artifactVersionId],
      });
      await deps.approvals.create({ ...requested, requiredRejections: 3 });

      const decided = await approveApproval(deps, 'alice', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      });

      expect(decided.status).toBe('APPROVED');
      expect(transitionCalls).toEqual([
        {
          approvalId: requested.id,
          workflowRunId: run.id,
          approvalType: 'RELEASE',
          decision: 'APPROVED',
        },
      ]);
    });
  });

  describe('Gap revisit: real ABAC context flows into an approval decision', () => {
    it('a published policy DENYing this riskClass rejects the decision, even though the approvalType alone matches no rule', async () => {
      const { deps, run, artifactVersionId } = ctx;
      const requested = await requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'remediation-gate',
        artifactVersionIds: [artifactVersionId],
      });
      await deps.approvals.create({ ...requested, riskClass: 'R4' });

      await deps.policies.create({
        id: randomUUID() as Policy['id'],
        organisationId: (await deps.projects.getById(run.projectId))!.organisationId,
        projectId: run.projectId,
        key: 'high-risk-approval-lockdown',
        version: 1,
        status: 'PUBLISHED',
        definition: {
          rules: [
            {
              action: 'remediation-gate',
              effect: 'DENY',
              condition: { riskClass: 'R4' },
            },
          ],
        },
        createdBy: 'alice',
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      await expect(
        approveApproval(deps, 'alice', requested.id, {
          scopeHash: requested.evidenceReference.scopeHash,
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('a policy rule scoped to a different riskClass does not affect this decision', async () => {
      const { deps, run, artifactVersionId } = ctx;
      const requested = await requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'remediation-gate',
        artifactVersionIds: [artifactVersionId],
      });
      await deps.approvals.create({ ...requested, riskClass: 'R1' });

      await deps.policies.create({
        id: randomUUID() as Policy['id'],
        organisationId: (await deps.projects.getById(run.projectId))!.organisationId,
        projectId: run.projectId,
        key: 'high-risk-approval-lockdown',
        version: 1,
        status: 'PUBLISHED',
        definition: {
          rules: [
            {
              action: 'remediation-gate',
              effect: 'DENY',
              condition: { riskClass: 'R4' },
            },
          ],
        },
        createdBy: 'alice',
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      const decided = await approveApproval(deps, 'alice', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      });

      expect(decided.status).toBe('APPROVED');
    });
  });

  describe('DEVOS-144: separation-of-duties enforcement', () => {
    it('rejects the requester deciding their own approval when enforceSeparationOfDuties is set', async () => {
      const { deps, run, artifactVersionId } = ctx;
      const requested = await requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'PLANNING',
        artifactVersionIds: [artifactVersionId],
      });
      await deps.approvals.create({ ...requested, enforceSeparationOfDuties: true });

      await expect(
        approveApproval(deps, 'alice', requested.id, {
          scopeHash: requested.evidenceReference.scopeHash,
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('allows a different principal to decide when enforceSeparationOfDuties is set', async () => {
      const { deps, run, artifactVersionId, addMember } = ctx;
      addMember('bob', 'OWNER');
      const requested = await requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'PLANNING',
        artifactVersionIds: [artifactVersionId],
      });
      await deps.approvals.create({ ...requested, enforceSeparationOfDuties: true });

      const decided = await approveApproval(deps, 'bob', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      });

      expect(decided.status).toBe('APPROVED');
    });

    it('allows the requester to decide their own approval when enforceSeparationOfDuties is not set (default)', async () => {
      const { deps, run, artifactVersionId } = ctx;
      const requested = await requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: run.id,
        approvalType: 'PLANNING',
        artifactVersionIds: [artifactVersionId],
      });

      const decided = await approveApproval(deps, 'alice', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      });

      expect(decided.status).toBe('APPROVED');
    });
  });
});

describe('DEVOS-112: the planning re-planning loop', () => {
  function buildReplanningScenario() {
    const organisationId = randomUUID() as OrganisationId;
    const now = new Date().toISOString();

    const project: Project = {
      id: randomUUID() as Project['id'],
      organisationId,
      name: 'Replanning Test Project',
      slug: 'replanning-test-project',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    const projectsStore = new Map<string, Project>([[project.id, project]]);
    const projects: ProjectRepository = {
      getById: async (id) => projectsStore.get(id) ?? null,
      listForOrganisation: async () => [project],
      create: async () => {},
      update: async () => {},
    };

    const membershipsStore = new Map<string, Membership>();
    const ownerMembershipId = randomUUID() as Membership['id'];
    membershipsStore.set(ownerMembershipId, {
      id: ownerMembershipId,
      organisationId,
      projectId: project.id,
      principalId: 'alice',
      role: 'OWNER',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    const memberships: MembershipRepository = {
      getById: async (id) => membershipsStore.get(id) ?? null,
      getForPrincipalAndProject: async (principalId, projectId) =>
        [...membershipsStore.values()].find(
          (m) => m.principalId === principalId && m.projectId === projectId,
        ) ?? null,
      listForPrincipal: async (principalId) =>
        [...membershipsStore.values()].filter((m) => m.principalId === principalId),
      listForProject: async (projectId) =>
        [...membershipsStore.values()].filter((m) => m.projectId === projectId),
      create: async (m) => {
        membershipsStore.set(m.id, m);
      },
      updateRole: async () => {},
      remove: async () => {},
    };

    let workItem: WorkItem = {
      id: randomUUID() as WorkItem['id'],
      projectId: project.id,
      title: 'Replanning test work item',
      type: 'GENERAL',
      status: 'OPEN',
      priority: 'MEDIUM',
      metadata: {},
      createdBy: 'alice',
      createdAt: now,
      updatedAt: now,
    };
    const workItems: WorkItemRepository = {
      getById: async (id) => (id === workItem.id ? workItem : null),
      listForProject: async () => [workItem],
      create: async () => {},
      update: async (id, changes, updatedAt) => {
        if (id !== workItem.id) return;
        workItem = { ...workItem, ...changes, updatedAt };
      },
    };

    const definitionId = randomUUID() as WorkflowDefinition['id'];
    const definition: WorkflowDefinition = {
      id: definitionId,
      projectId: project.id,
      key: 'planning-path',
      name: 'Planning Path',
      createdAt: now,
      updatedAt: now,
    };
    const workflowDefinitions: WorkflowDefinitionRepository = {
      getById: async (id) => (id === definition.id ? definition : null),
      getByProjectAndKey: async () => null,
      listForProject: async () => [definition],
      create: async () => {},
    };

    const version: WorkflowVersion = {
      id: randomUUID() as WorkflowVersion['id'],
      workflowDefinitionId: definitionId,
      version: 1,
      status: 'PUBLISHED',
      definition: {
        name: 'Planning Path',
        trigger: { type: 'WORK_ITEM_MANUAL' },
        inputs: [],
        nodes: [{ id: 'discovery', type: 'TASK' }],
        edges: [],
        policies: [],
        outputs: [],
      },
      publishedAt: now,
      createdBy: 'alice',
      createdAt: now,
    };
    const workflowVersions: WorkflowVersionRepository = {
      getById: async (id) => (id === version.id ? version : null),
      getByDefinitionAndVersion: async () => null,
      getLatestForDefinition: async () => version,
      listForDefinition: async () => [version],
      create: async () => {},
      updateDefinition: async () => {},
      publish: async () => {},
    };

    const runsStore = new Map<string, WorkflowRun>();
    const run: WorkflowRun = {
      id: randomUUID() as WorkflowRun['id'],
      projectId: project.id,
      workflowVersionId: version.id,
      workItemId: workItem.id,
      status: 'AWAITING_APPROVAL',
      input: { foo: 'bar' },
      createdAt: now,
      updatedAt: now,
    };
    runsStore.set(run.id, run);
    const workflowRuns: WorkflowRunRepository = {
      getById: async (id) => runsStore.get(id) ?? null,
      getByVersionAndIdempotencyKey: async () => null,
      create: async (r) => {
        runsStore.set(r.id, r);
      },
    };

    const workflowTasks: WorkflowTaskRepository = {
      getById: async () => null,
      listForRun: async () => [],
      create: async () => {},
    };

    const artifactVersionId = randomUUID();
    const artifactVersion: ArtifactVersion = {
      id: artifactVersionId as ArtifactVersion['id'],
      artifactId: randomUUID() as ArtifactVersion['artifactId'],
      version: 1,
      contentType: 'application/json',
      contentUri: 'mem://x',
      contentHash: 'hash',
      createdBy: 'alice',
      createdAt: now,
    };
    const artifactVersions: ArtifactVersionRepository = {
      getById: async (id) => (id === artifactVersion.id ? artifactVersion : null),
      listForArtifact: async () => [artifactVersion],
      create: async () => {},
    };

    const approvalsStore = new Map<string, Approval>();
    const decisionsStore: ApprovalDecisionRecord[] = [];
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
      create: async (a) => {
        approvalsStore.set(a.id, a);
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
      recordDecision: async (record) => {
        decisionsStore.push(record);
      },
      listDecisionsForApproval: async (approvalId) =>
        decisionsStore.filter((decision) => decision.approvalId === approvalId),
      expirePending: async (now) => {
        let count = 0;
        for (const [id, approval] of approvalsStore) {
          if (approval.status === 'PENDING' && approval.expiresAt && approval.expiresAt < now) {
            approvalsStore.set(id, { ...approval, status: 'EXPIRED' });
            count += 1;
          }
        }
        return count;
      },
    };

    const policies: PolicyRepository = {
      getById: async () => null,
      getByProjectAndKeyAndVersion: async () => null,
      getLatestForProjectAndKey: async () => null,
      listForProject: async () => [],
      getLatestForOrganisationAndKey: async () => null,
      listForOrganisation: async () => [],
      create: async () => {},
      publish: async () => {},
    };

    const startedRuns: Array<{ workItemId: string; idempotencyKey: string }> = [];
    const deps: ApprovalUseCaseDeps = {
      projects,
      memberships,
      workflowRuns,
      artifactVersions,
      approvals,
      policies,
      decideApprovalAndTransition: async (
        approvalId,
        _workflowRunId,
        _t,
        decision,
        decidedBy,
        decisionReason,
        decidedAt,
      ) => {
        await approvals.decide(
          approvalId as Approval['id'],
          decision,
          decidedBy,
          decisionReason,
          decidedAt,
        );
      },
      workItems,
      workflowDefinitions,
      workflowVersions,
      workflowTasks,
      createDraft: async () => {},
      startRun: async (r) => {
        runsStore.set(r.id, r);
        startedRuns.push({ workItemId: r.workItemId, idempotencyKey: r.idempotencyKey });
      },
    };

    return { deps, project, run, workItem: () => workItem, artifactVersionId, startedRuns };
  }

  it('a rejected PLANNING approval starts a genuinely new planning-path run for the same work item', async () => {
    const { deps, run, artifactVersionId, startedRuns, workItem } = buildReplanningScenario();
    const requested = await requestApproval(deps, 'alice', run.projectId, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });

    await rejectApproval(deps, 'alice', requested.id, {
      scopeHash: requested.evidenceReference.scopeHash,
      comment: 'Not quite right, please revise.',
    });

    expect(startedRuns).toHaveLength(1);
    expect(startedRuns[0]?.workItemId).toBe(run.workItemId);
    expect(workItem().metadata.planningReworkCount).toBe(1);
  });

  it('bounds the loop: after MAX_AUTOMATIC_REPLANNING_CYCLES rejections, no further run starts and the work item is marked REWORK_LIMIT_REACHED', async () => {
    const { deps, run, artifactVersionId, startedRuns, workItem } = buildReplanningScenario();

    // Two automatic re-plans are allowed; simulate rejecting each new
    // planning run's own approval in turn until the bound is hit.
    let currentRunId = run.id;
    for (let cycle = 1; cycle <= 3; cycle++) {
      const requested = await requestApproval(deps, 'alice', run.projectId, {
        workflowRunId: currentRunId,
        approvalType: 'PLANNING',
        artifactVersionIds: [artifactVersionId],
      });
      await rejectApproval(deps, 'alice', requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      });
      if (startedRuns.length > 0) {
        // The next cycle rejects the freshly-started replanning run's own
        // (fake) approval, driven against a new run id each time.
        currentRunId = randomUUID();
        (deps.workflowRuns as { create: (r: WorkflowRun) => Promise<void> }).create({
          id: currentRunId as WorkflowRun['id'],
          projectId: run.projectId,
          workflowVersionId: run.workflowVersionId,
          workItemId: run.workItemId,
          status: 'AWAITING_APPROVAL',
          input: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // 2 automatic replans (cycles 1-2), then the 3rd rejection hits the
    // bound instead of starting a 3rd automatic run.
    expect(startedRuns).toHaveLength(2);
    expect(workItem().status).toBe('REWORK_LIMIT_REACHED');
  });
});
