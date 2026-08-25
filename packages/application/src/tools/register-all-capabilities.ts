import type { ProjectId } from '@devos/contracts';
import type { ToolCapability } from '@devos/domain';
import { capabilityDefinitions } from '@devos/tools';
import { registerCapability } from './register-capability.js';
import type { ToolUseCaseDeps } from './deps.js';

/**
 * Registers every known capability definition against a project,
 * idempotently (`registerCapability` is get-or-create). Used by the
 * database seed script to populate `tool_capabilities` for the seeded
 * project, and reusable by any future onboarding flow that provisions a new
 * project's tool capabilities.
 *
 * Lives here, not in `packages/tools` (where it originally lived in
 * DEVOS-051) — `packages/tools` must not depend on `packages/application`
 * (the documented dependency direction is the other way around), a
 * violation that only surfaced once DEVOS-057 gave `application` its own,
 * correctly-directed reason to depend on `tools`, producing a real
 * circular dependency `turbo` refused to build. Moving this orchestration
 * helper here — importing `capabilityDefinitions` (pure data) from
 * `@devos/tools` — fixes the direction without changing what it does.
 */
export async function registerAllCapabilities(
  deps: ToolUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<ToolCapability[]> {
  const registered: ToolCapability[] = [];
  for (const definition of capabilityDefinitions) {
    registered.push(await registerCapability(deps, principalId, projectId, definition));
  }
  return registered;
}
