/**
 * Conceptual authority ordering (specs/architecture/system-context-engineering-knowledge.md
 * §17/§18): lower number = higher authority. The spec itself calls this "a
 * conceptual model rather than a universal ordering" and defers concrete
 * per-context-type precedence to "a later technical specification" that
 * does not exist in this repo — this mapping from `RetrievedSource.type` to
 * a level is therefore an implementation choice, not a spec-mandated table.
 *
 * `ARTIFACT` is deliberately placed at "Generated / Proposed Information"
 * (8), not "Approved Architecture / Technical Design" (4): the planning
 * artifacts DevOS produces today (DISCOVERY_REPORT/PRD/TECHNICAL_DESIGN/
 * IMPLEMENTATION_PLAN) are schema-validated but not yet human-approved —
 * DEVOS-047 introduces the approval gate that would earn them the higher
 * tier. Treating "generated" as "approved" ahead of that gate would
 * overstate their authority.
 */
const AUTHORITY_LEVELS: Record<string, number> = {
  KNOWLEDGE_SOURCE: 2, // Project Constitution / Standards
  PROJECT_CONTEXT: 2, // Project Constitution / Standards
  ARTIFACT: 8, // Generated / Proposed Information (not yet human-approved)
  WORK_ITEM: 6, // Current Work Item
};

const DEFAULT_AUTHORITY_LEVEL = 9; // Transient Agent Reasoning — lowest, for any unrecognized type

export function authorityLevelFor(sourceType: string): number {
  return AUTHORITY_LEVELS[sourceType] ?? DEFAULT_AUTHORITY_LEVEL;
}
