import type { ProjectId, ToolCapabilityId } from '@devos/contracts';
import {
  listCapabilitiesForProject,
  setToolCapabilityStatus,
  type ToolUseCaseDeps,
} from '@devos/application';
import { parseSetToolCapabilityStatusBody, toToolCapabilityDto } from '../dto/tool-capability.js';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-256: the first-ever `ToolCapability` API routes. `listCapabilitiesForProject`
 * (`@devos/application`) already existed and was already unit-tested since
 * Sprint 7, but — confirmed by grep before this task — was never wired into
 * `apps/api`; nothing in `apps/web` could ever list a project's real
 * capabilities. Mirrors `routes/integrations.ts`'s shape exactly.
 */
export function createToolCapabilityRoutes(prefix: string, deps: ToolUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/tool-capabilities`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const capabilities = await listCapabilitiesForProject(
          deps,
          user.id,
          params.projectId as ProjectId,
        );
        return capabilities.map(toToolCapabilityDto);
      },
    },
    {
      method: 'PATCH',
      pattern: `${prefix}/projects/:projectId/tool-capabilities/:capabilityId`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const status = parseSetToolCapabilityStatusBody(body);
        const capability = await setToolCapabilityStatus(
          deps,
          user.id,
          params.projectId as ProjectId,
          params.capabilityId as ToolCapabilityId,
          status,
        );
        return toToolCapabilityDto(capability);
      },
    },
  ];
}
