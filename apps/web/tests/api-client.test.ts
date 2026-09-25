import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEV_PRINCIPAL_ID,
  addMember,
  addOrganisationMember,
  assignPrincipalJobRole,
  assignProjectMemberJobRole,
  changeMemberRole,
  createOrganisation,
  createOrganisationPolicy,
  createPolicy,
  createArtifact,
  createIntegration,
  createProjectTypeAgent,
  createProjectTypeWorkflow,
  getAgent,
  getArtifactForPrincipal,
  getArtifactProvenance,
  getArtifactVersionById,
  getHealth,
  getKnowledgeSource,
  getOrganisation,
  getOrganisationCostReport,
  getProjectCostSummary,
  getProjectJobRolesOverview,
  getProjectSystemHealth,
  getWorkItem,
  installAgentVersion,
  installKnowledgeSource,
  listApprovalsForRun,
  listArtifactVersions,
  listAuditRecordsForProject,
  listAuditRecordsForOrganisation,
  listIntegrations,
  listMembers,
  listNotifications,
  listOrganisationJobRoles,
  listOrganisationMembers,
  listOrganisations,
  listPoliciesForOrganisation,
  listPoliciesForProject,
  listProjectTypes,
  listProjects,
  listSharedAgentVersions,
  listSharedKnowledgeSources,
  listToolCapabilities,
  listWorkflowsForOrganisation,
  markNotificationRead,
  publishPolicy,
  removeMember,
  removeOrganisationMember,
  removePrincipalJobRole,
  removeProjectMemberJobRole,
  searchProject,
  setToolCapabilityStatus,
  shareAgentVersion,
  simulatePolicy,
  startRun,
  startRunFromVersion,
  transferOrganisationOwnership,
  updateOrganisation,
  updateProject,
  updateProjectType,
  updateWorkItem,
} from '../src/api-client.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns health data on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { data: { status: 'ok' }, meta: { requestId: 'req-1' } }),
        ),
    );

    const result = await getHealth();

    expect(result).toEqual({ ok: true, data: { status: 'ok' }, requestId: 'req-1' });
  });

  it('returns the standard error envelope when the API reports an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(500, {
          error: { code: 'DEVOS_INTERNAL_ERROR', message: 'boom' },
          meta: { requestId: 'req-2' },
        }),
      ),
    );

    const result = await getHealth();

    expect(result).toEqual({
      ok: false,
      error: { code: 'DEVOS_INTERNAL_ERROR', message: 'boom' },
      requestId: 'req-2',
    });
  });

  it('sends the dev principal as a bearer token on authenticated requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: [], meta: { requestId: 'req-3' } }));
    vi.stubGlobal('fetch', fetchMock);

    await listProjects();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${DEV_PRINCIPAL_ID}`,
    );
  });

  it('reports a network error without throwing when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    const result = await listProjects();

    expect(result).toEqual({
      ok: false,
      error: { code: 'DEVOS_NETWORK_ERROR', message: 'connection refused' },
      requestId: '',
    });
  });

  it('starts a run with the given work item and a generated idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'run-1', status: 'PENDING' },
        meta: { requestId: 'req-4' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await startRun('workflow-1', {
      workItemId: 'work-item-1',
      idempotencyKey: 'idem-1',
    });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/workflows/workflow-1/runs');
    expect(JSON.parse(init.body as string)).toEqual({
      inputs: {},
      workItemId: 'work-item-1',
      idempotencyKey: 'idem-1',
    });
  });

  it('DEVOS-090: lists policies for a project at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [{ id: 'policy-1', key: 'release-approval', version: 1, status: 'PUBLISHED' }],
        meta: { requestId: 'req-5' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listPoliciesForProject('project-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/policies');
  });

  it('DEVOS-140: creates a project-scoped policy by posting to the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        data: { id: 'policy-2', key: 'my-policy', version: 1, status: 'DRAFT' },
        meta: { requestId: 'req-5a' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createPolicy('project-1', {
      key: 'my-policy',
      definition: { rules: [{ action: 'deploy', effect: 'DENY' }] },
    });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/policies');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      key: 'my-policy',
      definition: { rules: [{ action: 'deploy', effect: 'DENY' }] },
    });
  });

  it('DEVOS-139/140: lists and creates organisation-scoped policies at the real routes', async () => {
    const listFetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [{ id: 'org-policy-1', key: 'org-lockdown', version: 1, status: 'PUBLISHED' }],
        meta: { requestId: 'req-5b' },
      }),
    );
    vi.stubGlobal('fetch', listFetchMock);

    const listResult = await listPoliciesForOrganisation('org-1');
    expect(listResult.ok).toBe(true);
    const [listUrl] = listFetchMock.mock.calls[0] as [string, RequestInit];
    expect(listUrl).toContain('/api/v1/organisations/org-1/policies');

    const createFetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        data: { id: 'org-policy-2', key: 'org-policy', version: 1, status: 'DRAFT' },
        meta: { requestId: 'req-5c' },
      }),
    );
    vi.stubGlobal('fetch', createFetchMock);

    const createResult = await createOrganisationPolicy('org-1', {
      key: 'org-policy',
      definition: { rules: [] },
    });
    expect(createResult.ok).toBe(true);
    const [createUrl, createInit] = createFetchMock.mock.calls[0] as [string, RequestInit];
    expect(createUrl).toContain('/api/v1/organisations/org-1/policies');
    expect(createInit.method).toBe('POST');
  });

  it('DEVOS-140: publishes a policy by posting to the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'policy-2', key: 'my-policy', version: 1, status: 'PUBLISHED' },
        meta: { requestId: 'req-5d' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await publishPolicy('policy-2');

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/policies/policy-2/publish');
    expect(init.method).toBe('POST');
  });

  it('DEVOS-141: simulates a policy against real historical requests at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [
          {
            auditRecordId: 'audit-1',
            action: 'deploy',
            actualOutcome: 'SUCCESS',
            decision: { decision: 'DENY', reason: 'Matched rule for action "deploy".' },
          },
        ],
        meta: { requestId: 'req-5e' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await simulatePolicy('policy-2');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/policies/policy-2/simulate');
  });

  it('DEVOS-147: lists audit records for an organisation at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [{ id: 'audit-1', action: 'policy.published', outcome: 'SUCCESS' }],
        meta: { requestId: 'req-5f' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listAuditRecordsForOrganisation('org-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/audit');
  });

  it('DEVOS-151: gets a project cost summary at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          projectId: 'project-1',
          totalUsd: 1.5,
          breakdownByRole: [{ key: 'DEVELOPER', totalUsd: 1.5 }],
          breakdownByWorkflow: [],
          breakdownByWorkItem: [],
        },
        meta: { requestId: 'req-cost-1' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getProjectCostSummary('project-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/cost');
  });

  it('DEVOS-151: gets an organisation cost report at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          organisationId: 'org-1',
          totalUsd: 4.0,
          projectCount: 2,
          breakdownByRole: [{ key: 'DEVELOPER', totalUsd: 4.0 }],
          breakdownByWorkflow: [],
          breakdownByWorkItem: [],
        },
        meta: { requestId: 'req-cost-2' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getOrganisationCostReport('org-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/cost-report');
  });

  it('DEVOS-090: lists audit records for a project at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [{ id: 'audit-1', action: 'tool_invocation.rejected', outcome: 'FAILURE' }],
        meta: { requestId: 'req-6' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listAuditRecordsForProject('project-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/audit');
  });

  it('DEVOS-095: resolves an artifact version by id at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'version-1',
          artifactName: 'Discovery Report',
          artifactType: 'DISCOVERY_REPORT',
        },
        meta: { requestId: 'req-7' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getArtifactVersionById('version-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/artifact-versions/version-1');
  });

  it('lists organisations at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [{ id: 'org-1', name: 'Acme', slug: 'acme', status: 'ACTIVE' }],
        meta: { requestId: 'req-8' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listOrganisations();

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations');
  });

  it('creates an organisation by posting to the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'org-1', name: 'Acme', slug: 'acme', status: 'ACTIVE' },
        meta: { requestId: 'req-9' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createOrganisation({ name: 'Acme', slug: 'acme' });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Acme', slug: 'acme' });
  });

  it('gets a single organisation at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'org-1', name: 'Acme', slug: 'acme', status: 'ACTIVE' },
        meta: { requestId: 'req-10' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getOrganisation('org-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1');
  });

  it('updates an organisation by patching to the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'org-1', name: 'Acme Renamed', slug: 'acme', status: 'ACTIVE' },
        meta: { requestId: 'req-11' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateOrganisation('org-1', { name: 'Acme Renamed' });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1');
    expect(init.method).toBe('PATCH');
  });

  it('lists project types at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [{ id: 'type-1', key: 'software-development', name: 'Software Development' }],
        meta: { requestId: 'req-12' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listProjectTypes();

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/project-types');
  });

  it('disables a project type by patching to the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'type-1', key: 'software-development', status: 'DISABLED' },
        meta: { requestId: 'req-13' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateProjectType('type-1', { status: 'DISABLED' });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/project-types/type-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'DISABLED' });
  });

  it('creates a project type workflow template by posting to the real route', async () => {
    const definition = {
      name: 'Intake',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [{ id: 'discovery', type: 'AGENT_TASK', agentRef: 'discovery-agent' }],
      edges: [],
      policies: [],
      outputs: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'wf-1', projectTypeId: 'type-1', key: 'intake', name: 'Intake', definition },
        meta: { requestId: 'req-14' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createProjectTypeWorkflow('type-1', {
      key: 'intake',
      name: 'Intake',
      definition,
    });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/project-types/type-1/workflows');
    expect(init.method).toBe('POST');
  });

  it('creates a project type agent template by posting to the real route', async () => {
    const configuration = {
      role: 'DISCOVERY',
      provider: 'gemini',
      modelRef: 'gemini-3.6-flash',
      allowedCapabilities: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'agent-1',
          projectTypeId: 'type-1',
          key: 'discovery-agent',
          name: 'Discovery Agent',
          configuration,
        },
        meta: { requestId: 'req-15' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createProjectTypeAgent('type-1', {
      key: 'discovery-agent',
      name: 'Discovery Agent',
      configuration,
    });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/project-types/type-1/agents');
    expect(init.method).toBe('POST');
  });

  // DEVOS-213/DEVOS-216: `getWorkItem`/`updateWorkItem` had no client
  // wrapper before Sprint 31, though the backend `GET`/`PATCH
  // /work-items/:workItemId` routes already existed — see
  // specs/sprints/sprint-31/DEVOS-213.md's own grounding.
  it('DEVOS-213: gets a single work item at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'work-item-1', title: 'Fix the thing', status: 'OPEN', priority: 'MEDIUM' },
        meta: { requestId: 'req-16' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getWorkItem('work-item-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/work-items/work-item-1');
  });

  it('DEVOS-213: updates a single work item by patching the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'work-item-1',
          title: 'Fix the thing',
          status: 'IN_PROGRESS',
          priority: 'MEDIUM',
        },
        meta: { requestId: 'req-17' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateWorkItem('work-item-1', { status: 'IN_PROGRESS' });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/work-items/work-item-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'IN_PROGRESS' });
  });

  // DEVOS-215/DEVOS-216: `listApprovalsForRun` had no client wrapper before
  // Sprint 31, though the backend `GET /runs/:runId/approvals` route
  // already existed — see specs/sprints/sprint-31/DEVOS-215.md's own
  // grounding.
  it("DEVOS-215: lists a run's own approvals at the real route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [{ id: 'approval-1', approvalType: 'PLANNING', status: 'PENDING' }],
        meta: { requestId: 'req-18' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listApprovalsForRun('run-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/runs/run-1/approvals');
  });

  // DEVOS-224: `POST /workflow-versions/:workflowVersionId/runs` and its
  // underlying `startWorkflowRunFromVersion` use case already existed,
  // unmodified, with zero client wrapper — see
  // specs/sprints/sprint-33/DEVOS-224.md's own grounding.
  it('DEVOS-224: starts a run against a specific workflow version at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'run-1', status: 'PENDING' },
        meta: { requestId: 'req-19' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await startRunFromVersion('version-1', {
      workItemId: 'work-item-1',
      idempotencyKey: 'idem-2',
    });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/workflow-versions/version-1/runs');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      inputs: {},
      workItemId: 'work-item-1',
      idempotencyKey: 'idem-2',
    });
  });

  // DEVOS-226: all 4 `/projects/:id/members` routes already existed,
  // unmodified, with zero client wrapper — see
  // specs/sprints/sprint-33/DEVOS-226.md's own grounding.
  it("DEVOS-226: lists a project's members at the real route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [{ id: 'membership-1', projectId: 'project-1', userId: 'user-1', role: 'OWNER' }],
        meta: { requestId: 'req-20' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listMembers('project-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/members');
  });

  it('DEVOS-226: adds a member by principal id at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'membership-2', projectId: 'project-1', userId: 'user-2', role: 'MEMBER' },
        meta: { requestId: 'req-21' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await addMember('project-1', { userId: 'user-2', role: 'MEMBER' });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/members');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ userId: 'user-2', role: 'MEMBER' });
  });

  it("DEVOS-226: changes a member's role at the real route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'membership-2', projectId: 'project-1', userId: 'user-2', role: 'OWNER' },
        meta: { requestId: 'req-22' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await changeMemberRole('project-1', 'user-2', 'OWNER');

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/members/user-2');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ role: 'OWNER' });
  });

  it('DEVOS-226: removes a member at the real route', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { data: { removed: true }, meta: { requestId: 'req-23' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await removeMember('project-1', 'user-2');

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/members/user-2');
    expect(init.method).toBe('DELETE');
  });

  // DEVOS-227: `PATCH /projects/:id` already existed, unmodified, with zero
  // client wrapper (unlike `updateOrganisation`, which already had one) —
  // see specs/sprints/sprint-33/DEVOS-227.md's own grounding.
  it('DEVOS-227: updates a project by patching the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'project-1', name: 'Renamed', slug: 'renamed', status: 'ACTIVE' },
        meta: { requestId: 'req-24' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateProject('project-1', { name: 'Renamed' });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Renamed' });
  });

  // DEVOS-230: `GET /agents/:agentId` already existed, unmodified, with zero
  // client wrapper — see specs/sprints/sprint-34/DEVOS-230.md's own
  // grounding.
  it('DEVOS-230: gets a single agent at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'agent-1',
          projectId: 'project-1',
          key: 'dev-agent',
          name: 'Dev Agent',
          status: 'ACTIVE',
        },
        meta: { requestId: 'req-25' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getAgent('agent-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/agents/agent-1');
  });

  // DEVOS-231: `GET /knowledge-sources/:knowledgeSourceId` already existed,
  // unmodified, with zero client wrapper — see
  // specs/sprints/sprint-34/DEVOS-231.md's own grounding.
  it('DEVOS-231: gets a single knowledge source at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'source-1',
          projectId: 'project-1',
          key: 'standard',
          name: 'Coding Standard',
          sourceType: 'STANDARD',
          content: 'Use tabs.',
          status: 'ACTIVE',
          createdBy: 'user-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          sharedAcrossOrganisation: false,
        },
        meta: { requestId: 'req-26' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getKnowledgeSource('source-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/knowledge-sources/source-1');
  });

  // DEVOS-249: `GET /organisations/:organisationId/shared-knowledge-sources`
  // already existed (DEVOS-189), unmodified, with zero client call site
  // until Sprint 38 wired it into `KnowledgeMarketplacePage.tsx`.
  it("DEVOS-249: lists an organisation's shared knowledge sources at the real route", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: [], meta: { requestId: 'req-45' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await listSharedKnowledgeSources('org-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/shared-knowledge-sources');
  });

  // DEVOS-249: `POST /organisations/:organisationId/shared-knowledge-sources/:knowledgeSourceId/install`
  // already existed (DEVOS-189), unmodified, with zero client call site
  // until Sprint 38 wired it into `KnowledgeMarketplacePage.tsx`.
  it('DEVOS-249: installs a shared knowledge source at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'source-2',
          projectId: 'project-2',
          key: 'standard',
          name: 'Coding Standard',
          sourceType: 'STANDARD',
          content: 'Use tabs.',
          status: 'ACTIVE',
          createdBy: 'user-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          sharedAcrossOrganisation: false,
        },
        meta: { requestId: 'req-46' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await installKnowledgeSource('org-1', 'source-1', 'project-2');

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/shared-knowledge-sources/source-1/install');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ targetProjectId: 'project-2' });
  });

  // DEVOS-234: `GET /artifacts/:artifactId` already existed, unmodified,
  // with zero client wrapper — see specs/sprints/sprint-35/DEVOS-234.md's
  // own grounding.
  it('DEVOS-234: gets a single artifact at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'artifact-1',
          projectId: 'project-1',
          type: 'CODE_CHANGE',
          name: 'Change',
          status: 'GENERATED',
          provenance: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        meta: { requestId: 'req-27' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getArtifactForPrincipal('artifact-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/artifacts/artifact-1');
  });

  // DEVOS-234: `GET /artifacts/:artifactId/versions` already existed,
  // unmodified, with zero client wrapper.
  it("DEVOS-234: lists an artifact's versions at the real route", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: [], meta: { requestId: 'req-28' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await listArtifactVersions('artifact-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/artifacts/artifact-1/versions');
  });

  // DEVOS-234: `POST /projects/:projectId/artifacts` already existed,
  // unmodified, with zero client wrapper. The route returns only the
  // created Artifact, not `{ artifact, version }` — confirmed by direct
  // read of apps/api/src/routes/artifacts.ts.
  it('DEVOS-234: creates an artifact at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        data: {
          id: 'artifact-2',
          projectId: 'project-1',
          type: 'PRD',
          name: 'New artifact',
          status: 'GENERATED',
          provenance: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        meta: { requestId: 'req-29' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createArtifact('project-1', {
      artifactType: 'PRD',
      name: 'New artifact',
      content: 'Some content',
    });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/artifacts');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      artifactType: 'PRD',
      name: 'New artifact',
      content: 'Some content',
    });
  });

  // DEVOS-234: `GET /artifacts/:artifactId/provenance` already existed,
  // unmodified, with zero client wrapper.
  it("DEVOS-234: gets an artifact's provenance at the real route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { workflowRunId: 'run-1', workflowTaskId: 'task-1' },
        meta: { requestId: 'req-30' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getArtifactProvenance('artifact-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/artifacts/artifact-1/provenance');
  });

  // DEVOS-240: `GET /projects/:projectId/integrations` already existed
  // (DEVOS-194), unmodified, with zero client wrapper.
  it("DEVOS-240: lists a project's integrations at the real route", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: [], meta: { requestId: 'req-31' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await listIntegrations('project-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/integrations');
  });

  // DEVOS-240: `POST /projects/:projectId/integrations` already existed
  // (DEVOS-194), unmodified, with zero client wrapper.
  it('DEVOS-240: creates an integration at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'integration-1',
          projectId: 'project-1',
          type: 'Git',
          provider: 'github',
          name: 'Pilot GitHub integration',
          status: 'ACTIVE',
          credentialReference: 'github/devos-pilot-test-pat',
          configuration: { github: { owner: 'devos-org', repo: 'devos-pilot' } },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        meta: { requestId: 'req-32' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createIntegration('project-1', {
      type: 'Git',
      provider: 'github',
      name: 'Pilot GitHub integration',
      credentialReference: 'github/devos-pilot-test-pat',
      configuration: { github: { owner: 'devos-org', repo: 'devos-pilot' } },
    });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/integrations');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      type: 'Git',
      provider: 'github',
      name: 'Pilot GitHub integration',
      credentialReference: 'github/devos-pilot-test-pat',
      configuration: { github: { owner: 'devos-org', repo: 'devos-pilot' } },
    });
  });

  // DEVOS-244: `POST /agents/:agentId/versions/:version/share` already
  // existed (DEVOS-177), unmodified, with zero client wrapper.
  it('DEVOS-244: shares an agent version at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'agent-version-1',
          agentId: 'agent-1',
          version: 1,
          status: 'PUBLISHED',
          configuration: {
            role: 'DEVELOPMENT',
            provider: 'anthropic',
            modelRef: 'claude-sonnet-5',
          },
          createdBy: 'seed-user',
          createdAt: '2026-01-01T00:00:00.000Z',
          sharedAcrossOrganisation: true,
        },
        meta: { requestId: 'req-33' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await shareAgentVersion('agent-1', 1, true);

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/agents/agent-1/versions/1/share');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ shared: true });
  });

  // DEVOS-244: `GET /organisations/:organisationId/shared-agents` already
  // existed (DEVOS-178), unmodified, with zero client wrapper.
  it("DEVOS-244: lists an organisation's shared agent versions at the real route", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: [], meta: { requestId: 'req-34' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await listSharedAgentVersions('org-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/shared-agents');
  });

  // DEVOS-244: `POST /organisations/:organisationId/shared-agents/:agentVersionId/install`
  // already existed (DEVOS-178), unmodified, with zero client wrapper.
  it('DEVOS-244: installs a shared agent version at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'agent-2',
          projectId: 'project-2',
          key: 'dev-agent',
          name: 'Dev Agent',
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          version: {
            id: 'agent-version-2',
            agentId: 'agent-2',
            version: 1,
            status: 'PUBLISHED',
            configuration: {
              role: 'DEVELOPMENT',
              provider: 'anthropic',
              modelRef: 'claude-sonnet-5',
            },
            createdBy: 'seed-user',
            createdAt: '2026-01-01T00:00:00.000Z',
            sharedAcrossOrganisation: false,
          },
        },
        meta: { requestId: 'req-35' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await installAgentVersion('org-1', 'agent-version-1', 'project-2');

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/shared-agents/agent-version-1/install');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ targetProjectId: 'project-2' });
  });

  // DEVOS-254/255: the four organisation-scoped equivalents of the
  // project-scoped members routes DEVOS-226 already wrapped.
  it("DEVOS-255: lists an organisation's members at the real route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [
          { id: 'membership-1', projectId: null, userId: 'user-1', role: 'ORGANISATION_ADMIN' },
        ],
        meta: { requestId: 'req-36' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listOrganisationMembers('org-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/members');
  });

  it('DEVOS-255/DEVOS-290: adds an organisation member by principal id at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { id: 'membership-2', projectId: null, userId: 'user-2', role: 'ORGANISATION_ADMIN' },
        meta: { requestId: 'req-37' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await addOrganisationMember('org-1', {
      userId: 'user-2',
      role: 'ORGANISATION_ADMIN',
    });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/members');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      userId: 'user-2',
      role: 'ORGANISATION_ADMIN',
    });
  });

  it('DEVOS-290/293: transfers organisation ownership at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'org-1',
          name: 'Acme',
          slug: 'acme',
          status: 'ACTIVE',
          ownerPrincipalId: 'user-2',
        },
        meta: { requestId: 'req-38' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await transferOrganisationOwnership('org-1', 'user-2');

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/transfer-ownership');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ principalId: 'user-2' });
  });

  it('DEVOS-255: removes an organisation member at the real route', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { data: { removed: true }, meta: { requestId: 'req-39' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await removeOrganisationMember('org-1', 'user-2');

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/members/user-2');
    expect(init.method).toBe('DELETE');
  });

  // DEVOS-299/300/301: the six job-role wrappers (Sprint 49).
  it('DEVOS-299: lists an organisation job-role catalogue at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [
          {
            id: 'org-1:DEV',
            organisationId: 'org-1',
            key: 'DEV',
            name: 'Developer',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        meta: { requestId: 'req-jr1' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listOrganisationJobRoles('org-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/job-roles');
  });

  it('DEVOS-299/301: grants a principal a job role at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'org-1:DEV',
          organisationId: 'org-1',
          key: 'DEV',
          name: 'Developer',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        meta: { requestId: 'req-jr2' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await assignPrincipalJobRole('org-1', 'dev-alice', 'org-1:DEV');

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/principals/dev-alice/job-roles');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ jobRoleId: 'org-1:DEV' });
  });

  it('DEVOS-299/301: revokes a job role from a principal at the real route', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { data: { removed: true }, meta: { requestId: 'req-jr3' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await removePrincipalJobRole('org-1', 'dev-alice', 'org-1:DEV');

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/principals/dev-alice/job-roles/org-1:DEV');
    expect(init.method).toBe('DELETE');
  });

  it('DEVOS-300/301: gets the project job-roles overview at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          catalogue: [
            {
              id: 'org-1:DEV',
              organisationId: 'org-1',
              key: 'DEV',
              name: 'Developer',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          members: [
            { principalId: 'dev-alice', heldJobRoleIds: ['org-1:DEV'], activeJobRoleIds: [] },
          ],
        },
        meta: { requestId: 'req-jr4' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getProjectJobRolesOverview('project-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/job-roles');
  });

  it('DEVOS-300/301: activates a job role for a project member at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { projectId: 'project-1', principalId: 'dev-alice', jobRoleId: 'org-1:DEV' },
        meta: { requestId: 'req-jr5' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await assignProjectMemberJobRole('project-1', 'dev-alice', 'org-1:DEV');

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/members/dev-alice/job-roles');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ jobRoleId: 'org-1:DEV' });
  });

  it('DEVOS-300/301: deactivates a job role for a project member at the real route', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { data: { removed: true }, meta: { requestId: 'req-jr6' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await removeProjectMemberJobRole('project-1', 'dev-alice', 'org-1:DEV');

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/members/dev-alice/job-roles/org-1:DEV');
    expect(init.method).toBe('DELETE');
  });

  // DEVOS-256/257: the first-ever wrappers for the new tool-capability routes.
  it("DEVOS-257: lists a project's tool capabilities at the real route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [
          {
            id: 'capability-1',
            projectId: 'project-1',
            key: 'repo-read',
            name: 'Read Repository File',
            riskClass: 'R0',
            status: 'ACTIVE',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        meta: { requestId: 'req-40' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listToolCapabilities('project-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/tool-capabilities');
  });

  it('DEVOS-257: toggles a tool capability status at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'capability-1',
          projectId: 'project-1',
          key: 'repo-read',
          name: 'Read Repository File',
          riskClass: 'R0',
          status: 'DISABLED',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        meta: { requestId: 'req-41' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await setToolCapabilityStatus('project-1', 'capability-1', 'DISABLED');

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/tool-capabilities/capability-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'DISABLED' });
  });

  // DEVOS-258/259: the first-ever wrapper for the new system-health route.
  it("DEVOS-259: fetches a project's aggregated system health at the real route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          projectId: 'project-1',
          database: 'ok',
          integrations: { total: 4, active: 3 },
          capabilities: { total: 12, active: 12 },
        },
        meta: { requestId: 'req-42' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getProjectSystemHealth('project-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/system-health');
  });

  // DEVOS-264: the first-ever wrapper for the real Sprint 40 search route,
  // deliberately deferred by that sprint's own backend-only scope.
  it('DEVOS-264: searches a project at the real cross-entity search route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          projectId: 'project-1',
          query: 'dash board',
          workItems: [],
          artifacts: [],
          workflows: [],
          agents: [],
        },
        meta: { requestId: 'req-43' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchProject('project-1', 'dash board');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/project-1/search?q=dash%20board');
  });

  // Sprint 41 gap closure: the real, org-scoped aggregate route replacing
  // WorkflowLibraryPage.tsx's own former per-project fan-out.
  it('fetches the org-scoped workflow library at the real aggregate route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [
          {
            id: 'workflow-1',
            projectId: 'project-1',
            key: 'wf-one',
            name: 'Workflow One',
            latestVersionStatus: 'PUBLISHED',
            versionCount: 2,
            runStatusCounts: { COMPLETED: 3, FAILED: 1 },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        meta: { requestId: 'req-44' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listWorkflowsForOrganisation('org-1');

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/organisations/org-1/workflow-library');
  });

  // DEVOS-271: the first-ever wrappers for the real Sprint 42 notification
  // routes, deliberately deferred by that sprint's own backend-only scope.
  it("DEVOS-271: lists the current principal's own notifications at the real route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [
          {
            id: 'notification-1',
            recipientPrincipalId: 'seed-user',
            type: 'ApprovalRequested',
            referenceType: 'Approval',
            referenceId: 'approval-1',
            read: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            readAt: null,
          },
        ],
        meta: { requestId: 'req-45' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listNotifications();

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/notifications');
  });

  it('DEVOS-271: marks a notification read at the real route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'notification-1',
          recipientPrincipalId: 'seed-user',
          type: 'ApprovalRequested',
          referenceType: 'Approval',
          referenceId: 'approval-1',
          read: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          readAt: '2026-01-01T01:00:00.000Z',
        },
        meta: { requestId: 'req-46' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await markNotificationRead('notification-1');

    expect(result.ok).toBe(true);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/notifications/notification-1/read');
    expect(options.method).toBe('PATCH');
  });
});
