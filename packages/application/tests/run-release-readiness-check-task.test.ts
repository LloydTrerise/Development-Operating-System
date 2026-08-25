import { randomUUID } from 'node:crypto';
import type {
  Artifact,
  ArtifactRepository,
  ArtifactVersion,
  ArtifactVersionRepository,
  ProjectId,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
} from '@devos/domain';
import { describe, expect, it } from 'vitest';
import type { ToolTaskHandlerDeps } from '../src/tasks/deps.js';
import { runReleaseReadinessCheckTask } from '../src/tasks/run-release-readiness-check-task.js';

function buildScenario() {
  const projectId = randomUUID() as ProjectId;
  const now = new Date(0).toISOString();

  const run: WorkflowRun = {
    id: randomUUID() as WorkflowRun['id'],
    projectId,
    workflowVersionId: randomUUID() as WorkflowRun['workflowVersionId'],
    workItemId: randomUUID() as WorkflowRun['workItemId'],
    status: 'PENDING',
    input: {},
    createdAt: now,
    updatedAt: now,
  };

  const task: WorkflowTask = {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey: 'release-readiness-check',
    taskType: 'TOOL_TASK',
    status: 'RUNNING',
    attempt: 1,
    input: {},
    createdAt: now,
    updatedAt: now,
  };

  function makeArtifact(artifactType: string, offsetMs: number): Artifact {
    return {
      id: randomUUID() as Artifact['id'],
      projectId,
      artifactType,
      name: artifactType,
      status: 'GENERATED',
      createdBy: 'devos-agent-runtime',
      createdAt: new Date(offsetMs).toISOString(),
      updatedAt: new Date(offsetMs).toISOString(),
    };
  }
  function makeVersion(artifact: Artifact, metadata: Record<string, unknown>): ArtifactVersion {
    return {
      id: randomUUID() as ArtifactVersion['id'],
      artifactId: artifact.id,
      version: 1,
      contentType: 'application/json',
      contentUri: `file:///${artifact.artifactType}.json`,
      contentHash: 'a'.repeat(64),
      metadata,
      createdBy: 'devos-agent-runtime',
      createdAt: artifact.createdAt,
    };
  }

  let projectArtifacts: Artifact[] = [];
  const artifactVersionsByArtifactId = new Map<string, ArtifactVersion[]>();

  function seedPassingEvidence(): void {
    const testEvidenceArtifact = makeArtifact('TEST_EVIDENCE', 1);
    const testEvidenceVersion = makeVersion(testEvidenceArtifact, { passed: true });
    const reviewEvidenceArtifact = makeArtifact('REVIEW_EVIDENCE', 2);
    const reviewEvidenceVersion = makeVersion(reviewEvidenceArtifact, {
      decision: 'PASS',
      findings: [],
    });
    projectArtifacts = [testEvidenceArtifact, reviewEvidenceArtifact];
    artifactVersionsByArtifactId.set(testEvidenceArtifact.id, [testEvidenceVersion]);
    artifactVersionsByArtifactId.set(reviewEvidenceArtifact.id, [reviewEvidenceVersion]);
  }

  function seedBlockerFinding(): void {
    const testEvidenceArtifact = makeArtifact('TEST_EVIDENCE', 1);
    const testEvidenceVersion = makeVersion(testEvidenceArtifact, { passed: true });
    const reviewEvidenceArtifact = makeArtifact('REVIEW_EVIDENCE', 2);
    const reviewEvidenceVersion = makeVersion(reviewEvidenceArtifact, {
      decision: 'PASS',
      findings: [{ severity: 'BLOCKER', description: 'Should not have shipped.' }],
    });
    projectArtifacts = [testEvidenceArtifact, reviewEvidenceArtifact];
    artifactVersionsByArtifactId.set(testEvidenceArtifact.id, [testEvidenceVersion]);
    artifactVersionsByArtifactId.set(reviewEvidenceArtifact.id, [reviewEvidenceVersion]);
  }

  const workflowRuns: WorkflowRunRepository = {
    getById: async (id) => (id === run.id ? run : null),
    getByVersionAndIdempotencyKey: async () => null,
    create: async () => {},
  };
  const artifacts: ArtifactRepository = {
    getById: async (id) => projectArtifacts.find((a) => a.id === id) ?? null,
    listForProject: async () => projectArtifacts,
    create: async () => {},
  };
  const artifactVersions: ArtifactVersionRepository = {
    getById: async () => null,
    listForArtifact: async (artifactId) => artifactVersionsByArtifactId.get(artifactId) ?? [],
    create: async () => {},
  };

  const deps: ToolTaskHandlerDeps = {
    workflowRuns,
    workItems: { getById: async () => null, listForProject: async () => [] } as never,
    storage: {} as never,
    publishArtifact: async () => {},
    artifacts,
    artifactVersions,
    projects: {} as never,
    memberships: {} as never,
    policies: {} as never,
    toolCapabilities: {} as never,
    toolInvocations: {} as never,
    auditRecords: {} as never,
    integrations: {} as never,
  };

  return { deps, task, seedPassingEvidence, seedBlockerFinding };
}

describe('runReleaseReadinessCheckTask (DEVOS-073)', () => {
  it('succeeds when the project has passing test evidence and a PASS review with no blockers', async () => {
    const { deps, task, seedPassingEvidence } = buildScenario();
    seedPassingEvidence();

    const output = await runReleaseReadinessCheckTask(deps, task);

    expect(output).toMatchObject({ status: 'SUCCEEDED', ready: true });
  });

  it('throws with the reason when no evidence exists at all', async () => {
    const { deps, task } = buildScenario();

    await expect(runReleaseReadinessCheckTask(deps, task)).rejects.toThrow(
      'No test evidence found.',
    );
  });

  it('throws with the reason when an unresolved BLOCKER finding remains', async () => {
    const { deps, task, seedBlockerFinding } = buildScenario();
    seedBlockerFinding();

    await expect(runReleaseReadinessCheckTask(deps, task)).rejects.toThrow(
      'unresolved BLOCKER finding',
    );
  });

  it('throws clearly when the workflow run does not exist', async () => {
    const { deps, task } = buildScenario();
    const missingTask = { ...task, workflowRunId: randomUUID() as typeof task.workflowRunId };

    await expect(runReleaseReadinessCheckTask(deps, missingTask)).rejects.toThrow('not found');
  });
});
