import type { ProjectId, WorkflowRunId } from '@devos/contracts';
import type { RetrievalDeps } from '../retrieval/deps.js';
import { retrieveActiveKnowledgeSources } from '../retrieval/retrieve-knowledge-sources.js';
import { retrieveArtifactsForRun } from '../retrieval/retrieve-run-artifacts.js';
import { retrieveProjectContext } from '../retrieval/retrieve-project-context.js';
import type { RetrievedSource } from '../retrieval/retrieved-source.js';
import { authorityLevelFor } from './authority.js';
import type { AssembledContext, AssembledContextSource } from './assembled-context.js';

export interface ContextBuildInput {
  projectId: ProjectId;
  workflowRunId?: WorkflowRunId;
}

export interface ContextBuildOptions {
  maxSources?: number;
  maxContentLength?: number;
}

const DEFAULT_MAX_SOURCES = 50;
const DEFAULT_MAX_CONTENT_LENGTH = 20_000;

/**
 * Implements the Context Assembly pipeline's source-gathering and
 * precedence/limiting steps (specs/architecture/system-context-engineering-knowledge.md
 * §22, steps 2–8 and 11) using DEVOS-040's retrieval functions. Step 3
 * ("Identify Applicable Policies") is a no-op today — no policy model
 * exists yet (DEVOS-043/044) — and steps 9/10 ("Detect Conflicts",
 * "Validate Context Sufficiency") are explicitly deferred to DEVOS-048
 * (Uncertainty Handling), this sprint's own dedicated task for exactly that
 * concern, rather than half-built here.
 *
 * "The context assembler [is] a deterministic platform capability" (§22):
 * given the same repository state, this always produces the same ordered
 * source list — no model call is involved.
 */
export async function buildContext(
  deps: RetrievalDeps,
  input: ContextBuildInput,
  options: ContextBuildOptions = {},
): Promise<AssembledContext> {
  const maxSources = options.maxSources ?? DEFAULT_MAX_SOURCES;
  const maxContentLength = options.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;

  const candidates: RetrievedSource[] = [];

  const projectContext = await retrieveProjectContext(deps, input.projectId);
  if (projectContext) candidates.push(projectContext);

  candidates.push(...(await retrieveActiveKnowledgeSources(deps, input.projectId)));

  if (input.workflowRunId !== undefined) {
    candidates.push(...(await retrieveArtifactsForRun(deps, input.projectId, input.workflowRunId)));
  }

  // Apply precedence (§18): most authoritative (lowest level number) first.
  // Array.prototype.sort is stable, so equal-authority sources keep their
  // retrieval order — deterministic given deterministic retrieval.
  const tagged: AssembledContextSource[] = candidates
    .map((source) => ({ ...source, authorityLevel: authorityLevelFor(source.type) }))
    .sort((a, b) => a.authorityLevel - b.authorityLevel);

  // Apply source-count and total-content-size limits (§22 step 8's "Retrieve"
  // steps must stay bounded, matching the sprint's own "size limits"
  // acceptance criterion). Lowest-authority sources are dropped first, since
  // `tagged` is already ordered highest-authority-first — a deterministic,
  // reproducible trim, never a truncation of an individual source's content.
  const limited: AssembledContextSource[] = [];
  let totalContentLength = 0;

  for (const source of tagged) {
    if (limited.length >= maxSources) break;

    const contentLength = JSON.stringify(source.content).length;
    if (limited.length > 0 && totalContentLength + contentLength > maxContentLength) break;

    limited.push(source);
    totalContentLength += contentLength;
  }

  return { sources: limited };
}
