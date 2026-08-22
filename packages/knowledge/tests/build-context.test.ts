import { randomUUID } from 'node:crypto';
import type {
  Artifact,
  ArtifactRepository,
  ArtifactVersion,
  ArtifactVersionRepository,
  KnowledgeSource,
  KnowledgeSourceRepository,
  Project,
  ProjectRepository,
} from '@devos/domain';
import type { OrganisationId, ProjectId, WorkflowRunId } from '@devos/contracts';
import { describe, expect, it } from 'vitest';
import type { RetrievalDeps } from '../src/retrieval/deps.js';
import { buildContext } from '../src/context/build-context.js';

function createDeps(): {
  deps: RetrievalDeps;
  project: Project;
  addKnowledgeSource: (overrides: Partial<KnowledgeSource>) => KnowledgeSource;
  addArtifact: (
    overrides: Partial<Artifact>,
    versions: Array<Partial<ArtifactVersion>>,
  ) => Artifact;
} {
  const project: Project = {
    id: randomUUID() as ProjectId,
    organisationId: randomUUID() as OrganisationId,
    name: 'Test Project',
    slug: 'test-project',
    description: 'A project for context-builder tests.',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const projects: ProjectRepository = {
    getById: async (id) => (id === project.id ? project : null),
    listForOrganisation: async () => [project],
    create: async () => {},
    update: async () => {},
  };

  const knowledgeSourcesStore = new Map<string, KnowledgeSource>();
  const knowledgeSources: KnowledgeSourceRepository = {
    getById: async (id) => knowledgeSourcesStore.get(id) ?? null,
    getByProjectAndKey: async (projectId, key) =>
      [...knowledgeSourcesStore.values()].find((s) => s.projectId === projectId && s.key === key) ??
      null,
    listForProject: async (projectId) =>
      [...knowledgeSourcesStore.values()].filter((s) => s.projectId === projectId),
    create: async (source) => {
      knowledgeSourcesStore.set(source.id, source);
    },
  };

  const artifactsStore = new Map<string, Artifact>();
  const artifacts: ArtifactRepository = {
    getById: async (id) => artifactsStore.get(id) ?? null,
    listForProject: async (projectId) =>
      [...artifactsStore.values()].filter((a) => a.projectId === projectId),
    create: async (artifact) => {
      artifactsStore.set(artifact.id, artifact);
    },
  };

  const versionsStore = new Map<string, ArtifactVersion[]>();
  const artifactVersions: ArtifactVersionRepository = {
    getById: async (id) => [...versionsStore.values()].flat().find((v) => v.id === id) ?? null,
    listForArtifact: async (artifactId) => versionsStore.get(artifactId) ?? [],
    create: async (version) => {
      const existing = versionsStore.get(version.artifactId) ?? [];
      versionsStore.set(version.artifactId, [...existing, version]);
    },
  };

  const deps: RetrievalDeps = { projects, knowledgeSources, artifacts, artifactVersions };

  const addKnowledgeSource = (overrides: Partial<KnowledgeSource>): KnowledgeSource => {
    const now = new Date().toISOString();
    const source: KnowledgeSource = {
      id: randomUUID() as KnowledgeSource['id'],
      projectId: project.id,
      key: 'source',
      name: 'Source',
      sourceType: 'STANDARD',
      content: 'content',
      status: 'ACTIVE',
      createdBy: 'alice',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
    knowledgeSourcesStore.set(source.id, source);
    return source;
  };

  const addArtifact = (
    overrides: Partial<Artifact>,
    versionOverrides: Array<Partial<ArtifactVersion>>,
  ): Artifact => {
    const now = new Date().toISOString();
    const artifact: Artifact = {
      id: randomUUID() as Artifact['id'],
      projectId: project.id,
      artifactType: 'DISCOVERY_REPORT',
      name: 'Artifact',
      status: 'GENERATED',
      createdBy: 'alice',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
    artifactsStore.set(artifact.id, artifact);

    const versions = versionOverrides.map((v, index) => ({
      id: randomUUID() as ArtifactVersion['id'],
      artifactId: artifact.id,
      version: index + 1,
      contentType: 'application/json',
      contentUri: 'mem://x',
      contentHash: 'hash',
      createdBy: 'alice',
      createdAt: now,
      ...v,
    }));
    versionsStore.set(artifact.id, versions);

    return artifact;
  };

  return { deps, project, addKnowledgeSource, addArtifact };
}

describe('buildContext', () => {
  it('assembles project context and active knowledge sources, ordered by authority, with no run', async () => {
    const { deps, project, addKnowledgeSource } = createDeps();
    addKnowledgeSource({ name: 'Standards' });

    const context = await buildContext(deps, { projectId: project.id });

    expect(context.sources.map((s) => s.type)).toEqual(['PROJECT_CONTEXT', 'KNOWLEDGE_SOURCE']);
    expect(context.sources.every((s) => s.authorityLevel === 2)).toBe(true);
  });

  it('places lower-authority ARTIFACT sources after higher-authority ones', async () => {
    const { deps, project, addKnowledgeSource, addArtifact } = createDeps();
    const runId = randomUUID() as WorkflowRunId;
    addKnowledgeSource({ name: 'Standards' });
    addArtifact({ workflowRunId: runId, name: 'Discovery Report' }, [{ metadata: { a: 1 } }]);

    const context = await buildContext(deps, { projectId: project.id, workflowRunId: runId });

    expect(context.sources.map((s) => s.type)).toEqual([
      'PROJECT_CONTEXT',
      'KNOWLEDGE_SOURCE',
      'ARTIFACT',
    ]);
    expect(context.sources[2]!.authorityLevel).toBeGreaterThan(context.sources[0]!.authorityLevel);
  });

  it('is deterministic — the same repository state always produces the same ordered result', async () => {
    const { deps, project, addKnowledgeSource } = createDeps();
    addKnowledgeSource({ key: 'a', name: 'A' });
    addKnowledgeSource({ key: 'b', name: 'B' });

    const first = await buildContext(deps, { projectId: project.id });
    const second = await buildContext(deps, { projectId: project.id });

    expect(first).toEqual(second);
  });

  it('caps the number of sources at maxSources, keeping the highest-authority ones', async () => {
    const { deps, project, addKnowledgeSource } = createDeps();
    addKnowledgeSource({ key: 'a', name: 'A' });
    addKnowledgeSource({ key: 'b', name: 'B' });
    addKnowledgeSource({ key: 'c', name: 'C' });

    const context = await buildContext(deps, { projectId: project.id }, { maxSources: 2 });

    expect(context.sources).toHaveLength(2);
    expect(context.sources[0]!.type).toBe('PROJECT_CONTEXT');
  });

  it('caps total content length, dropping lowest-authority sources first', async () => {
    const { deps, project, addKnowledgeSource, addArtifact } = createDeps();
    const runId = randomUUID() as WorkflowRunId;
    addKnowledgeSource({ name: 'Standards', content: 'short' });
    addArtifact({ workflowRunId: runId, name: 'Discovery Report' }, [
      { metadata: { big: 'x'.repeat(1000) } },
    ]);

    const context = await buildContext(
      deps,
      { projectId: project.id, workflowRunId: runId },
      { maxContentLength: 200 },
    );

    expect(context.sources.some((s) => s.type === 'ARTIFACT')).toBe(false);
    expect(context.sources.some((s) => s.type === 'KNOWLEDGE_SOURCE')).toBe(true);
  });

  it('returns an empty source list for an unknown project', async () => {
    const { deps } = createDeps();

    const context = await buildContext(deps, { projectId: randomUUID() as ProjectId });

    expect(context.sources).toEqual([]);
  });
});
