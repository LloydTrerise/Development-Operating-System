import type {
  AgentExecutionId,
  ContextManifestId,
  ProjectId,
  WorkflowTaskId,
} from '@devos/contracts';

/**
 * Mirrors specs/api/poc-api-contracts.md §28's Context Manifest Contract
 * ("sources": [{ "type": "ARTIFACT", "ref": "..." }, ...]) — a source type
 * is a free-form label (e.g. "WORK_ITEM", "AGENT_VERSION", "PROMPT"), not a
 * closed enum, since AGENTS.md §27 requires future context systems to
 * distinguish categories without collapsing them into one shape.
 */
/**
 * The optional `retrievedAt`/`authorityLevel` fields are DEVOS-042's context
 * provenance extension (specs/architecture/system-context-engineering-knowledge.md
 * §21: source type, identifier, version, retrieved-at, authority). A
 * dedicated `sourceVersion` field was deliberately not added — for every
 * source type this codebase currently records, the version (an artifact's
 * version, a prompt's reference) is already embedded in `ref` itself, so a
 * separate field would duplicate the same information without adding
 * capability. `retrievedAt` is required (every source is recorded at a
 * specific moment); `authorityLevel` is optional because not every recorded
 * source represents content with a precedence ranking — `AGENT_VERSION`/
 * `PROMPT` describe how an execution was configured, not retrieved
 * authoritative content, so they are left unranked rather than assigned an
 * arbitrary number.
 */
export interface ContextManifestSource {
  type: string;
  ref: string;
  retrievedAt: string;
  authorityLevel?: number;
}

/**
 * The explicit record of the material context assembled for one agent
 * execution (specs/api/poc-api-contracts.md §27), per AGENTS.md's
 * "Context ≠ Authority" principle: what was supplied is recorded as
 * context, never treated as an authoritative instruction. One manifest per
 * AgentExecution (a retried execution gets its own manifest, same as it
 * gets its own AgentExecution row).
 */
export interface ContextManifest {
  id: ContextManifestId;
  projectId: ProjectId;
  workflowTaskId: WorkflowTaskId;
  agentExecutionId: AgentExecutionId;
  version: number;
  sources: ContextManifestSource[];
  policySnapshot: Record<string, unknown>;
  createdAt: string;
}

export interface ContextManifestRepository {
  getById: (id: ContextManifestId) => Promise<ContextManifest | null>;
  getForExecution: (agentExecutionId: AgentExecutionId) => Promise<ContextManifest | null>;
  create: (manifest: ContextManifest) => Promise<void>;
}
