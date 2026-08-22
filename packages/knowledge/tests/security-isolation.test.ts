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
import { buildContext } from '../src/context/build-context.js';
import type { RetrievalDeps } from '../src/retrieval/deps.js';
import { retrieveActiveKnowledgeSources } from '../src/retrieval/retrieve-knowledge-sources.js';
import { retrieveArtifactsForRun } from '../src/retrieval/retrieve-run-artifacts.js';

/**
 * DEVOS-049 — proves specs/architecture/system-context-engineering-knowledge.md
 * §26's "project context must remain isolated between projects" and Domain
 * Invariant §37.7 hold across two genuinely separate, fully populated
 * projects — not just the single-unrelated-project "expect 0" checks
 * DEVOS-040/041's own tests already carry incidentally, but a dedicated
 * cross-contamination proof in both directions.
 */
function createTwoProjectDeps(): {
  deps: RetrievalDeps;
  projectA: Project;
  projectB: Project;
  runA: WorkflowRunId;
  runB: WorkflowRunId;
} {
  const projectA: Project = {
    id: randomUUID() as ProjectId,
    organisationId: randomUUID() as OrganisationId,
    name: 'Project A',
    slug: 'project-a',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const projectB: Project = {
    id: randomUUID() as ProjectId,
    organisationId: randomUUID() as OrganisationId,
    name: 'Project B',
    slug: 'project-b',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const projects = new Map([
    [projectA.id, projectA],
    [projectB.id, projectB],
  ]);

  const projectRepository: ProjectRepository = {
    getById: async (id) => projects.get(id) ?? null,
    listForOrganisation: async (organisationId) =>
      [...projects.values()].filter((p) => p.organisationId === organisationId),
    create: async () => {},
    update: async () => {},
  };

  const now = new Date().toISOString();
  const sourceA: KnowledgeSource = {
    id: randomUUID() as KnowledgeSource['id'],
    projectId: projectA.id,
    key: 'standards',
    name: 'Project A Standards',
    sourceType: 'STANDARD',
    content: "Project A's confidential coding standard.",
    status: 'ACTIVE',
    createdBy: 'alice',
    createdAt: now,
    updatedAt: now,
  };
  const sourceB: KnowledgeSource = {
    id: randomUUID() as KnowledgeSource['id'],
    projectId: projectB.id,
    key: 'standards',
    name: 'Project B Standards',
    sourceType: 'STANDARD',
    content: "Project B's confidential coding standard.",
    status: 'ACTIVE',
    createdBy: 'bob',
    createdAt: now,
    updatedAt: now,
  };
  const knowledgeSources: KnowledgeSourceRepository = {
    getById: async (id) => [sourceA, sourceB].find((s) => s.id === id) ?? null,
    getByProjectAndKey: async (projectId, key) =>
      [sourceA, sourceB].find((s) => s.projectId === projectId && s.key === key) ?? null,
    listForProject: async (projectId) =>
      [sourceA, sourceB].filter((s) => s.projectId === projectId),
    create: async () => {},
  };

  const runA = randomUUID() as WorkflowRunId;
  const runB = randomUUID() as WorkflowRunId;

  const artifactA: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: projectA.id,
    workflowRunId: runA,
    artifactType: 'DISCOVERY_REPORT',
    name: "Project A's discovery report",
    status: 'GENERATED',
    createdBy: 'alice',
    createdAt: now,
    updatedAt: now,
  };
  const artifactB: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: projectB.id,
    workflowRunId: runB,
    artifactType: 'DISCOVERY_REPORT',
    name: "Project B's discovery report",
    status: 'GENERATED',
    createdBy: 'bob',
    createdAt: now,
    updatedAt: now,
  };
  const artifacts: ArtifactRepository = {
    getById: async (id) => [artifactA, artifactB].find((a) => a.id === id) ?? null,
    listForProject: async (projectId) =>
      [artifactA, artifactB].filter((a) => a.projectId === projectId),
    create: async () => {},
  };

  const versionA: ArtifactVersion = {
    id: randomUUID() as ArtifactVersion['id'],
    artifactId: artifactA.id,
    version: 1,
    contentType: 'application/json',
    contentUri: 'mem://a',
    contentHash: 'hash-a',
    metadata: { secret: "Project A's confidential finding." },
    createdBy: 'alice',
    createdAt: now,
  };
  const versionB: ArtifactVersion = {
    id: randomUUID() as ArtifactVersion['id'],
    artifactId: artifactB.id,
    version: 1,
    contentType: 'application/json',
    contentUri: 'mem://b',
    contentHash: 'hash-b',
    metadata: { secret: "Project B's confidential finding." },
    createdBy: 'bob',
    createdAt: now,
  };
  const artifactVersions: ArtifactVersionRepository = {
    getById: async (id) => [versionA, versionB].find((v) => v.id === id) ?? null,
    listForArtifact: async (artifactId) =>
      [versionA, versionB].filter((v) => v.artifactId === artifactId),
    create: async () => {},
  };

  return {
    deps: { projects: projectRepository, knowledgeSources, artifacts, artifactVersions },
    projectA,
    projectB,
    runA,
    runB,
  };
}

describe('cross-project isolation (security)', () => {
  it('retrieveActiveKnowledgeSources never returns another project’s sources', async () => {
    const { deps, projectA, projectB } = createTwoProjectDeps();

    const sourcesForA = await retrieveActiveKnowledgeSources(deps, projectA.id);
    const sourcesForB = await retrieveActiveKnowledgeSources(deps, projectB.id);

    expect(sourcesForA).toHaveLength(1);
    expect(sourcesForA[0]!.content).toContain('Project A');
    expect(sourcesForB).toHaveLength(1);
    expect(sourcesForB[0]!.content).toContain('Project B');
  });

  it("retrieveArtifactsForRun never returns another project's run artifacts", async () => {
    const { deps, projectA, projectB, runA, runB } = createTwoProjectDeps();

    const artifactsForA = await retrieveArtifactsForRun(deps, projectA.id, runA);
    const artifactsForB = await retrieveArtifactsForRun(deps, projectB.id, runB);

    expect(artifactsForA).toHaveLength(1);
    expect(JSON.stringify(artifactsForA[0]!.content)).toContain('Project A');
    expect(artifactsForB).toHaveLength(1);
    expect(JSON.stringify(artifactsForB[0]!.content)).toContain('Project B');
  });

  it('buildContext for project A never surfaces project B’s data, and vice versa', async () => {
    const { deps, projectA, projectB, runA, runB } = createTwoProjectDeps();

    const contextA = await buildContext(deps, { projectId: projectA.id, workflowRunId: runA });
    const contextB = await buildContext(deps, { projectId: projectB.id, workflowRunId: runB });

    const contentA = JSON.stringify(contextA.sources);
    const contentB = JSON.stringify(contextB.sources);

    expect(contentA).toContain('Project A');
    expect(contentA).not.toContain('Project B');
    expect(contentB).toContain('Project B');
    expect(contentB).not.toContain('Project A');
  });

  it("cannot cross-retrieve by supplying another project's run id to the wrong project", async () => {
    const { deps, projectA, runB } = createTwoProjectDeps();

    // Project A's caller mistakenly (or maliciously) supplies Project B's
    // run id — retrieval must not silently return Project B's artifacts
    // just because a run id happened to be passed.
    const result = await retrieveArtifactsForRun(deps, projectA.id, runB);

    expect(result).toEqual([]);
  });
});
