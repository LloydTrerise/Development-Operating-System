import type { ToolCapabilityRiskClass } from '@devos/contracts';

/**
 * The static, in-code blueprint for a tool capability
 * (specs/architecture/repository-code-structure.md §16: "Each capability
 * should define: input schema; output schema; risk class; required
 * policy."). This is distinct from `@devos/domain`'s `ToolCapability`, which
 * is the persisted row for a given project — a definition here is
 * registered against a project (via `registerCapability`) to produce one.
 */
export interface ToolCapabilityDefinition {
  key: string;
  name: string;
  riskClass: ToolCapabilityRiskClass;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}
