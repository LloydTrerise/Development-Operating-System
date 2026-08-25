import type {
  ProjectId,
  ToolCapabilityId,
  ToolCapabilityRiskClass,
  ToolCapabilityStatus,
} from '@devos/contracts';

/**
 * "A discrete action that an integration or internal service exposes to
 * DevOS" (specs/architecture/domain-model.md §11.2), e.g. repo-read,
 * repo-write, git-commit, pull-request-create. Matches
 * specs/database/poc-database-schema.md §14.1's exact column shape — no
 * `integration_id` column is documented there, so a capability is scoped
 * directly to a project rather than through an Integration row (DEVOS-053).
 *
 * §11.3 also defines a "Tool Permission" concept ("which agent versions,
 * workflows, tasks, or users may invoke a capability"), but no
 * `tool_permissions` table exists anywhere in the documented schema. Binding
 * authority to a capability is DEVOS-052's job (the Tool Gateway consults
 * DEVOS-044's policy evaluator), not a separate permissions table — flagged
 * per DEVOS-051's own spec rather than fabricating one here.
 */
export interface ToolCapability {
  id: ToolCapabilityId;
  projectId: ProjectId;
  key: string;
  name: string;
  riskClass: ToolCapabilityRiskClass;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  status: ToolCapabilityStatus;
  createdAt: string;
}

export interface ToolCapabilityRepository {
  getById: (id: ToolCapabilityId) => Promise<ToolCapability | null>;
  getByProjectAndKey: (projectId: ProjectId, key: string) => Promise<ToolCapability | null>;
  listForProject: (projectId: ProjectId) => Promise<ToolCapability[]>;
  create: (capability: ToolCapability) => Promise<void>;
}
