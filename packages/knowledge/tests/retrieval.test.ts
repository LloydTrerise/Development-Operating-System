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
import { retrieveActiveKnowledgeSources } from '../src/retrieval/retrieve-knowledge-sources.js';
import { retrieveProjectContext } from '../src/retrieval/retrieve-project-context.js';
import { retrieveArtifactsForRun } from '../src/retrieval/retrieve-run-artifacts.js';

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
    description: 'A project for retrieval tests.',
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
    update: async (id, changes, updatedAt) => {
      const existing = knowledgeSourcesStore.get(id);
      if (!existing) return;
      knowledgeSourcesStore.set(id, { ...existing, ...changes, updatedAt });
    },
    // DEVOS-187: a plain in-memory stand-in for the real Postgres full-text
    // search — proves `retrieveActiveKnowledgeSources`'s own fallback logic
    // without needing a real database in this package's unit tests (the
    // real `tsvector`/`ts_rank` mechanics are verified for real in the
    // Sprint 25 e2e pilot instead).
    searchForProject: async (projectId, query) => {
      // A plain word-overlap stand-in for real `ts_rank` keyword matching —
      // good enough to prove `retrieveActiveKnowledgeSources`'s own
      // narrow/fallback logic without a real database in this unit test.
      const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      return [...knowledgeSourcesStore.values()].filter((s) => {
        if (s.projectId !== projectId || s.status !== 'ACTIVE') return false;
        const haystack = `${s.name} ${s.content}`.toLowerCase();
        return words.some((word) => haystack.includes(word));
      });
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

describe('retrieveActiveKnowledgeSources', () => {
  it('returns only ACTIVE sources for the project, normalized to RetrievedSource', async () => {
    const { deps, project, addKnowledgeSource } = createDeps();
    const active = addKnowledgeSource({ key: 'a', name: 'Active', content: 'be explicit' });
    addKnowledgeSource({ key: 'b', name: 'Archived', status: 'ARCHIVED' });

    const sources = await retrieveActiveKnowledgeSources(deps, project.id);

    expect(sources).toEqual([
      {
        type: 'KNOWLEDGE_SOURCE',
        ref: `knowledge-source:${active.id}`,
        name: 'Active',
        content: 'be explicit',
      },
    ]);
  });

  it('is isolated between projects', async () => {
    const { deps } = createDeps();
    const otherProjectId = randomUUID() as ProjectId;

    const sources = await retrieveActiveKnowledgeSources(deps, otherProjectId);

    expect(sources).toEqual([]);
  });

  // DEVOS-187: real query-scoped relevance retrieval.
  it('narrows to real, query-matching sources when a non-empty query is supplied and the repository supports search', async () => {
    const { deps, project, addKnowledgeSource } = createDeps();
    const matching = addKnowledgeSource({
      key: 'matching',
      name: 'Timeout Handling',
      content: 'How to diagnose slow query timeouts.',
    });
    addKnowledgeSource({ key: 'unrelated', name: 'Unrelated', content: 'Naming conventions.' });

    const sources = await retrieveActiveKnowledgeSources(deps, project.id, 'slow query timeout');

    expect(sources).toEqual([
      {
        type: 'KNOWLEDGE_SOURCE',
        ref: `knowledge-source:${matching.id}`,
        name: matching.name,
        content: matching.content,
      },
    ]);
  });

  it('falls back to unconditional inclusion on zero query matches — never a surprising empty context', async () => {
    const { deps, project, addKnowledgeSource } = createDeps();
    const unrelated = addKnowledgeSource({
      key: 'unrelated',
      name: 'Naming',
      content: 'Naming conventions.',
    });

    const sources = await retrieveActiveKnowledgeSources(
      deps,
      project.id,
      'a query matching nothing at all',
    );

    expect(sources).toEqual([
      {
        type: 'KNOWLEDGE_SOURCE',
        ref: `knowledge-source:${unrelated.id}`,
        name: unrelated.name,
        content: unrelated.content,
      },
    ]);
  });

  it('falls back to unconditional inclusion when no query is supplied — zero regression for every existing caller', async () => {
    const { deps, project, addKnowledgeSource } = createDeps();
    const active = addKnowledgeSource({ key: 'a', name: 'Active', content: 'be explicit' });

    const sources = await retrieveActiveKnowledgeSources(deps, project.id);

    expect(sources).toEqual([
      {
        type: 'KNOWLEDGE_SOURCE',
        ref: `knowledge-source:${active.id}`,
        name: active.name,
        content: active.content,
      },
    ]);
  });

  it('falls back to unconditional inclusion when the repository has no searchForProject support', async () => {
    const { project, addKnowledgeSource } = createDeps();
    const active = addKnowledgeSource({ key: 'a', name: 'Active', content: 'be explicit' });
    const noSearchKnowledgeSources: KnowledgeSourceRepository = {
      getById: async () => null,
      getByProjectAndKey: async () => null,
      listForProject: async () => [active],
      create: async () => {},
      update: async () => {},
    };
    const depsWithoutSearch: RetrievalDeps = {
      projects: { getById: async () => null, listForOrganisation: async () => [], create: async () => {}, update: async () => {} },
      knowledgeSources: noSearchKnowledgeSources,
      artifacts: { getById: async () => null, listForProject: async () => [], create: async () => {} },
      artifactVersions: { getById: async () => null, listForArtifact: async () => [], create: async () => {} },
    };

    const sources = await retrieveActiveKnowledgeSources(depsWithoutSearch, project.id, 'anything');

    expect(sources).toEqual([
      {
        type: 'KNOWLEDGE_SOURCE',
        ref: `knowledge-source:${active.id}`,
        name: active.name,
        content: active.content,
      },
    ]);
  });
});

describe('retrieveProjectContext', () => {
  it('returns the project as a single normalized source', async () => {
    const { deps, project } = createDeps();

    const source = await retrieveProjectContext(deps, project.id);

    expect(source).toEqual({
      type: 'PROJECT_CONTEXT',
      ref: `project:${project.id}`,
      name: project.name,
      content: { name: project.name, description: project.description },
    });
  });

  it('returns null for an unknown project', async () => {
    const { deps } = createDeps();

    const source = await retrieveProjectContext(deps, randomUUID() as ProjectId);

    expect(source).toBeNull();
  });
});

describe('retrieveArtifactsForRun', () => {
  it('returns the latest version of each artifact belonging to the run', async () => {
    const { deps, project, addArtifact } = createDeps();
    const runId = randomUUID() as WorkflowRunId;
    const artifact = addArtifact({ workflowRunId: runId, name: 'Discovery Report' }, [
      { metadata: { summary: 'v1' } },
      { metadata: { summary: 'v2' } },
    ]);
    addArtifact({ workflowRunId: randomUUID() as WorkflowRunId }, [{ metadata: {} }]);

    const sources = await retrieveArtifactsForRun(deps, project.id, runId);

    expect(sources).toEqual([
      {
        type: 'ARTIFACT',
        ref: `artifact:${artifact.id}:v2`,
        name: 'Discovery Report',
        content: { summary: 'v2' },
      },
    ]);
  });

  it('returns an empty array when the run has no artifacts', async () => {
    const { deps, project } = createDeps();

    const sources = await retrieveArtifactsForRun(deps, project.id, randomUUID() as WorkflowRunId);

    expect(sources).toEqual([]);
  });
});
