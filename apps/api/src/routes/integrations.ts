import type { ProjectId } from '@devos/contracts';
import {
  createIntegration,
  listIntegrationsForProject,
  type IntegrationUseCaseDeps,
} from '@devos/application';
import { parseCreateIntegrationBody, toIntegrationDto } from '../dto/integration.js';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-194: the first-ever `Integration` API route. `createIntegration`/
 * `listIntegrationsForProject` (`@devos/application`) already exist and are
 * unit-tested since Sprint 7/9, but — confirmed by grep before this task —
 * were never wired into `apps/api`; every real GitHub/Render integration in
 * this codebase to date was created only by seed/e2e-test code calling the
 * use case directly. `OWNER`-gating is enforced inside `createIntegration`
 * itself (`canRegisterIntegration`) — no new authorization logic here.
 */
export function createIntegrationRoutes(prefix: string, deps: IntegrationUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/integrations`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const integrations = await listIntegrationsForProject(
          deps,
          user.id,
          params.projectId as ProjectId,
        );
        return integrations.map(toIntegrationDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/projects/:projectId/integrations`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseCreateIntegrationBody(body);
        const integration = await createIntegration(
          deps,
          user.id,
          params.projectId as ProjectId,
          input,
        );
        return toIntegrationDto(integration);
      },
    },
  ];
}
