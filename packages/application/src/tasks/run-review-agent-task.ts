import { randomUUID } from 'node:crypto';
import type { Artifact, ArtifactVersion, WorkflowTask } from '@devos/domain';
import { retrieveActiveKnowledgeSources } from '@devos/knowledge';
import { runAgentTask } from './run-agent-task.js';
import type { ReviewAgentTaskHandlerDeps } from './deps.js';
import { startRunForVersion } from '../workflows/run-creation.js';

const CONTENT_TYPE = 'application/json';

// Matches every other stage's identical constant — the agent runtime
// acting without a human principal.
const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

/**
 * DEVOS-068: no numeric rework/retry bound is specified anywhere in the
 * spec corpus (flagged in this sprint's README) — an explicit, small
 * assumption: up to 2 automatic rework cycles per work item (3 development
 * attempts total, including the first) before requiring human escalation
 * rather than looping indefinitely.
 */
const MAX_AUTOMATIC_REWORK_CYCLES = 2;

function latestOfType<T extends { artifactType: string; createdAt: string }>(
  artifacts: T[],
  artifactType: string,
): T | undefined {
  return artifacts
    .filter((artifact) => artifact.artifactType === artifactType)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

/**
 * Stage 9 — Engineering Review (specs/workflows/software-change-workflow.md
 * §19): "Independently assess the implementation against the approved
 * specification and engineering standards." A normal agent (`role:
 * 'REVIEW'`), exactly like DEVOS-031–034/057 — this is DEVOS-065's own
 * task, combined with DEVOS-066's evidence publishing (the source backlog
 * lists them separately, but every prior stage already publishes its own
 * output in the same handler that produces it — splitting them here would
 * be an artificial seam, see this sprint's decision log).
 *
 * Every input is looked up project-scoped, latest-by-type (mirroring
 * DEVOS-061/064's plan/code-change lookups) rather than run-scoped, so
 * this task makes no assumption about whether it shares a run with
 * development/validation. `testEvidence` is optional — §19 lists
 * "validation evidence" as an input, but the source description says
 * "review diff against PRD/design/standards," and this prompt's own text
 * allows it to be absent.
 *
 * "Engineering standards" (§19's own input list) has no concrete source
 * anywhere in the spec corpus — satisfied by whatever `ACTIVE` project
 * knowledge sources DEVOS-040's `retrieveActiveKnowledgeSources` already
 * resolves, the first real caller of that function (Sprint 3's context
 * builder was live-verified standalone but never wired into a live task).
 *
 * The model's `decision` is normalized defensively: anything other than
 * the literal string `"PASS"` is treated as `CHANGES_REQUIRED` — a
 * schema-conformant but semantically ambiguous decision fails closed
 * (requires rework) rather than silently passing.
 */
export async function runReviewAgentTask(
  deps: ReviewAgentTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const workItem = await deps.workItems.getById(run.workItemId);
  if (!workItem) throw new Error(`Work item ${run.workItemId} not found.`);

  const projectArtifacts = await deps.artifacts.listForProject(run.projectId);

  const codeChangeArtifact = latestOfType(projectArtifacts, 'CODE_CHANGE');
  if (!codeChangeArtifact) {
    throw new Error(
      `No CODE_CHANGE artifact found in project ${run.projectId}; review requires a development output.`,
    );
  }

  const prdArtifact = latestOfType(projectArtifacts, 'PRD');
  const technicalDesignArtifact = latestOfType(projectArtifacts, 'TECHNICAL_DESIGN');
  const planArtifact = latestOfType(projectArtifacts, 'IMPLEMENTATION_PLAN');
  const testEvidenceArtifact = latestOfType(projectArtifacts, 'TEST_EVIDENCE');

  async function latestVersion(
    artifact: Artifact | undefined,
  ): Promise<ArtifactVersion | undefined> {
    if (!artifact) return undefined;
    const versions = await deps.artifactVersions.listForArtifact(artifact.id);
    return versions.sort((a, b) => b.version - a.version)[0];
  }

  const [codeChangeVersion, prdVersion, technicalDesignVersion, planVersion, testEvidenceVersion] =
    await Promise.all([
      latestVersion(codeChangeArtifact),
      latestVersion(prdArtifact),
      latestVersion(technicalDesignArtifact),
      latestVersion(planArtifact),
      latestVersion(testEvidenceArtifact),
    ]);
  if (!codeChangeVersion) {
    throw new Error(`Code change artifact ${codeChangeArtifact.id} has no versions.`);
  }

  const knowledgeSources = await retrieveActiveKnowledgeSources(deps, run.projectId);

  const sources = [
    {
      type: 'ARTIFACT' as const,
      ref: `artifact:${codeChangeArtifact.id}:v${codeChangeVersion.version}`,
    },
    ...(prdArtifact && prdVersion
      ? [{ type: 'ARTIFACT' as const, ref: `artifact:${prdArtifact.id}:v${prdVersion.version}` }]
      : []),
    ...(technicalDesignArtifact && technicalDesignVersion
      ? [
          {
            type: 'ARTIFACT' as const,
            ref: `artifact:${technicalDesignArtifact.id}:v${technicalDesignVersion.version}`,
          },
        ]
      : []),
    ...(planArtifact && planVersion
      ? [{ type: 'ARTIFACT' as const, ref: `artifact:${planArtifact.id}:v${planVersion.version}` }]
      : []),
    ...(testEvidenceArtifact && testEvidenceVersion
      ? [
          {
            type: 'ARTIFACT' as const,
            ref: `artifact:${testEvidenceArtifact.id}:v${testEvidenceVersion.version}`,
          },
        ]
      : []),
    ...knowledgeSources.map((source) => ({ type: source.type, ref: source.ref })),
  ];

  const { agentExecutionId, agentVersionId, ...modelOutput } = await runAgentTask(deps, task, {
    input: {
      prd: prdVersion?.metadata ?? null,
      technicalDesign: technicalDesignVersion?.metadata ?? null,
      implementationPlan: planVersion?.metadata ?? null,
      codeChange: codeChangeVersion.metadata ?? {},
      testEvidence: testEvidenceVersion?.metadata ?? null,
      engineeringStandards: knowledgeSources.map((source) => source.content),
    },
    sources,
  });

  const decision = modelOutput.decision === 'PASS' ? 'PASS' : 'CHANGES_REQUIRED';
  const findings = Array.isArray(modelOutput.findings) ? modelOutput.findings : [];

  const now = new Date().toISOString();
  const content = {
    artifactType: 'REVIEW_EVIDENCE',
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    derivedFromArtifactId: codeChangeArtifact.id,
    derivedFromArtifactVersionId: codeChangeVersion.id,
    summary: modelOutput.summary,
    decision,
    findings,
    agentExecutionId,
    agentVersionId,
    generatedAt: now,
  };

  const stored = await deps.storage.put(JSON.stringify(content), CONTENT_TYPE);

  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: run.projectId,
    artifactType: 'REVIEW_EVIDENCE',
    name: `Review Evidence — ${workItem.title}`,
    status: 'GENERATED',
    workflowRunId: run.id,
    workflowTaskId: task.id,
    createdBy: SYSTEM_ACTOR_ID,
    createdAt: now,
    updatedAt: now,
  };

  const version: ArtifactVersion = {
    id: randomUUID() as ArtifactVersion['id'],
    artifactId: artifact.id,
    version: 1,
    contentType: CONTENT_TYPE,
    contentUri: stored.uri,
    contentHash: stored.hash,
    metadata: content,
    createdBy: SYSTEM_ACTOR_ID,
    createdAt: now,
  };

  await deps.publishArtifact(artifact, version);

  // DEVOS-067/068: "a new task execution is created" (§20) for a
  // CHANGES_REQUIRED decision — implemented as a new run of this same
  // workflow version for the same work item (see this file's own doc
  // comment: dynamically inserting a task into the already-running run
  // isn't possible with this engine, so this mirrors DEVOS-061's own
  // separate-run resolution to an equivalent constraint), bounded by
  // `MAX_AUTOMATIC_REWORK_CYCLES`. The rework count lives in the work
  // item's own `metadata` — simpler and more precise than scanning
  // historical artifacts, which have no direct work-item link of their own.
  let reworkTriggered: { runId: string } | undefined;
  let escalated = false;
  if (decision === 'CHANGES_REQUIRED') {
    const reworkCount =
      typeof workItem.metadata.reworkCount === 'number' ? workItem.metadata.reworkCount : 0;
    const reworkNow = new Date().toISOString();

    if (reworkCount < MAX_AUTOMATIC_REWORK_CYCLES) {
      await deps.workItems.update(
        workItem.id,
        { metadata: { ...workItem.metadata, reworkCount: reworkCount + 1 } },
        reworkNow,
      );

      const workflowVersion = await deps.workflowVersions.getById(run.workflowVersionId);
      if (!workflowVersion) {
        throw new Error(`Workflow version ${run.workflowVersionId} not found.`);
      }

      const reworkRun = await startRunForVersion(deps, SYSTEM_ACTOR_ID, workflowVersion, {
        workItemId: workItem.id,
        inputs: run.input,
        idempotencyKey: `${task.id}:rework-${reworkCount + 1}`,
      });
      reworkTriggered = { runId: reworkRun.id };
    } else {
      await deps.workItems.update(workItem.id, { status: 'REWORK_LIMIT_REACHED' }, reworkNow);
      escalated = true;
    }
  }

  return {
    status: 'SUCCEEDED',
    artifactId: artifact.id,
    artifactVersionId: version.id,
    artifactType: artifact.artifactType,
    contentHash: stored.hash,
    decision,
    findings,
    agentExecutionId,
    agentVersionId,
    ...(reworkTriggered ? { reworkRunId: reworkTriggered.runId } : {}),
    ...(escalated ? { escalated: true } : {}),
  };
}
