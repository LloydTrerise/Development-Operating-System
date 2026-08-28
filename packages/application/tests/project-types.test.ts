import { randomUUID } from 'node:crypto';
import type { ProjectTypeId } from '@devos/contracts';
import type {
  ProjectType,
  ProjectTypeAgent,
  ProjectTypeAgentRepository,
  ProjectTypeRepository,
  ProjectTypeWorkflow,
  ProjectTypeWorkflowRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectTypeAgent } from '../src/project-types/create-project-type-agent.js';
import { createProjectTypeWorkflow } from '../src/project-types/create-project-type-workflow.js';
import { createProjectType } from '../src/project-types/create-project-type.js';
import type { ProjectTypeUseCaseDeps } from '../src/project-types/deps.js';
import { getProjectType } from '../src/project-types/get-project-type.js';
import { listProjectTypeAgents } from '../src/project-types/list-project-type-agents.js';
import { listProjectTypeWorkflows } from '../src/project-types/list-project-type-workflows.js';
import { listProjectTypes } from '../src/project-types/list-project-types.js';
import { updateProjectTypeAgent } from '../src/project-types/update-project-type-agent.js';
import { updateProjectTypeWorkflow } from '../src/project-types/update-project-type-workflow.js';
import { updateProjectType } from '../src/project-types/update-project-type.js';
import { NotFoundError, ValidationError } from '../src/errors.js';

const SAMPLE_GRAPH = {
  name: 'Sample Workflow',
  trigger: { type: 'WORK_ITEM_MANUAL' },
  inputs: [],
  nodes: [{ id: 'step-1', type: 'TASK', name: 'Step 1' }],
  edges: [],
  policies: [],
  outputs: [],
};

function createInMemoryDeps(): ProjectTypeUseCaseDeps {
  const projectTypes = new Map<string, ProjectType>();
  const workflows = new Map<string, ProjectTypeWorkflow>();
  const agents = new Map<string, ProjectTypeAgent>();

  const projectTypeRepository: ProjectTypeRepository = {
    getById: async (id) => projectTypes.get(id) ?? null,
    getByKey: async (key) => [...projectTypes.values()].find((p) => p.key === key) ?? null,
    list: async () => [...projectTypes.values()],
    create: async (projectType) => {
      projectTypes.set(projectType.id, projectType);
    },
    update: async (id, changes, updatedAt) => {
      const existing = projectTypes.get(id);
      if (!existing) return;
      projectTypes.set(id, { ...existing, ...changes, updatedAt });
    },
  };

  const projectTypeWorkflowRepository: ProjectTypeWorkflowRepository = {
    getById: async (id) => workflows.get(id) ?? null,
    getByProjectTypeAndKey: async (projectTypeId, key) =>
      [...workflows.values()].find(
        (w) => w.projectTypeId === projectTypeId && w.key === key,
      ) ?? null,
    listForProjectType: async (projectTypeId) =>
      [...workflows.values()].filter((w) => w.projectTypeId === projectTypeId),
    create: async (workflow) => {
      workflows.set(workflow.id, workflow);
    },
    update: async (id, changes, updatedAt) => {
      const existing = workflows.get(id);
      if (!existing) return;
      workflows.set(id, { ...existing, ...changes, updatedAt });
    },
  };

  const projectTypeAgentRepository: ProjectTypeAgentRepository = {
    getById: async (id) => agents.get(id) ?? null,
    getByProjectTypeAndKey: async (projectTypeId, key) =>
      [...agents.values()].find((a) => a.projectTypeId === projectTypeId && a.key === key) ?? null,
    listForProjectType: async (projectTypeId) =>
      [...agents.values()].filter((a) => a.projectTypeId === projectTypeId),
    create: async (agent) => {
      agents.set(agent.id, agent);
    },
    update: async (id, changes, updatedAt) => {
      const existing = agents.get(id);
      if (!existing) return;
      agents.set(id, { ...existing, ...changes, updatedAt });
    },
  };

  return {
    projectTypes: projectTypeRepository,
    projectTypeWorkflows: projectTypeWorkflowRepository,
    projectTypeAgents: projectTypeAgentRepository,
  };
}

describe('project type use cases', () => {
  let deps: ProjectTypeUseCaseDeps;

  beforeEach(() => {
    deps = createInMemoryDeps();
  });

  it('creates a project type and lists it', async () => {
    const projectType = await createProjectType(deps, {
      key: 'software-development',
      name: 'Software Development',
    });

    expect(projectType).toMatchObject({
      key: 'software-development',
      name: 'Software Development',
      status: 'ACTIVE',
    });

    const all = await listProjectTypes(deps);
    expect(all.map((p) => p.id)).toEqual([projectType.id]);
  });

  it('rejects an empty key or name', async () => {
    await expect(createProjectType(deps, { key: '', name: 'X' })).rejects.toThrow(ValidationError);
    await expect(createProjectType(deps, { key: 'x', name: '' })).rejects.toThrow(ValidationError);
  });

  it('rejects a duplicate key', async () => {
    await createProjectType(deps, { key: 'software-development', name: 'Software Development' });
    await expect(
      createProjectType(deps, { key: 'software-development', name: 'Duplicate' }),
    ).rejects.toThrow(ValidationError);
  });

  it('gets a project type by id and rejects a non-existent one', async () => {
    const projectType = await createProjectType(deps, { key: 'kind', name: 'Kind' });

    const fetched = await getProjectType(deps, projectType.id);
    expect(fetched.id).toBe(projectType.id);

    await expect(getProjectType(deps, randomUUID() as ProjectTypeId)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('updates a project type', async () => {
    const projectType = await createProjectType(deps, { key: 'kind', name: 'Kind' });

    const updated = await updateProjectType(deps, projectType.id, { name: 'Renamed Kind' });
    expect(updated.name).toBe('Renamed Kind');
  });

  it('creates, lists, and updates a workflow template under a project type', async () => {
    const projectType = await createProjectType(deps, { key: 'kind', name: 'Kind' });

    const workflow = await createProjectTypeWorkflow(deps, projectType.id, {
      key: 'planning-path',
      name: 'Planning Path',
      definition: SAMPLE_GRAPH,
    });

    const listed = await listProjectTypeWorkflows(deps, projectType.id);
    expect(listed.map((w) => w.id)).toEqual([workflow.id]);

    const updated = await updateProjectTypeWorkflow(deps, projectType.id, 'planning-path', {
      name: 'Renamed Planning Path',
    });
    expect(updated.name).toBe('Renamed Planning Path');
  });

  it('rejects an invalid workflow template graph', async () => {
    const projectType = await createProjectType(deps, { key: 'kind', name: 'Kind' });

    await expect(
      createProjectTypeWorkflow(deps, projectType.id, {
        key: 'bad',
        name: 'Bad',
        definition: { name: 'Bad' } as unknown as typeof SAMPLE_GRAPH,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a duplicate workflow template key under the same project type', async () => {
    const projectType = await createProjectType(deps, { key: 'kind', name: 'Kind' });
    await createProjectTypeWorkflow(deps, projectType.id, {
      key: 'planning-path',
      name: 'Planning Path',
      definition: SAMPLE_GRAPH,
    });

    await expect(
      createProjectTypeWorkflow(deps, projectType.id, {
        key: 'planning-path',
        name: 'Duplicate',
        definition: SAMPLE_GRAPH,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects creating a workflow template under a non-existent project type', async () => {
    await expect(
      createProjectTypeWorkflow(deps, randomUUID() as ProjectTypeId, {
        key: 'planning-path',
        name: 'Planning Path',
        definition: SAMPLE_GRAPH,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('creates, lists, and updates an agent template under a project type', async () => {
    const projectType = await createProjectType(deps, { key: 'kind', name: 'Kind' });

    const agent = await createProjectTypeAgent(deps, projectType.id, {
      key: 'discovery-agent',
      name: 'Discovery Agent',
      configuration: {
        role: 'DISCOVERY',
        provider: 'gemini',
        modelRef: 'gemini-3.6-flash',
        outputSchemaRef: 'discovery-report-v1',
        allowedCapabilities: [],
      },
      promptReference: 'discovery/v1',
    });

    const listed = await listProjectTypeAgents(deps, projectType.id);
    expect(listed.map((a) => a.id)).toEqual([agent.id]);

    const updated = await updateProjectTypeAgent(deps, projectType.id, 'discovery-agent', {
      name: 'Renamed Discovery Agent',
    });
    expect(updated.name).toBe('Renamed Discovery Agent');
  });

  it('rejects a duplicate agent template key under the same project type', async () => {
    const projectType = await createProjectType(deps, { key: 'kind', name: 'Kind' });
    const configuration = {
      role: 'DISCOVERY',
      provider: 'gemini',
      modelRef: 'gemini-3.6-flash',
      outputSchemaRef: 'discovery-report-v1',
      allowedCapabilities: [],
    };
    await createProjectTypeAgent(deps, projectType.id, {
      key: 'discovery-agent',
      name: 'Discovery Agent',
      configuration,
    });

    await expect(
      createProjectTypeAgent(deps, projectType.id, {
        key: 'discovery-agent',
        name: 'Duplicate',
        configuration,
      }),
    ).rejects.toThrow(ValidationError);
  });
});
