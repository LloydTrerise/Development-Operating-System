import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEV_PRINCIPAL_ID,
  createOrganisation,
  createProjectTypeAgent,
  createProjectTypeWorkflow,
  getArtifactVersionById,
  getHealth,
  getOrganisation,
  listAuditRecordsForProject,
  listOrganisations,
  listPoliciesForProject,
  listProjectTypes,
  listProjects,
  startRun,
  updateOrganisation,
  updateProjectType,
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
});
