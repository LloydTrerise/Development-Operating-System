import type { OrganisationId } from '@devos/contracts';
import { listWorkflowsForOrganisation, type WorkflowLibraryUseCaseDeps } from '@devos/application';
import { toWorkflowLibraryEntryDto } from '../dto/workflow.js';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * Sprint 41 gap closure: real, org-scoped aggregate data for
 * `WorkflowLibraryPage.tsx` — mirrors `routes/search.ts`'s own minimal
 * single-route shape (a differently-shaped deps object than
 * `WorkflowUseCaseDeps`, so a dedicated file, same precedent).
 */
export function createWorkflowLibraryRoutes(
  prefix: string,
  deps: WorkflowLibraryUseCaseDeps,
): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId/workflow-library`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const entries = await listWorkflowsForOrganisation(
          deps,
          user.id,
          params.organisationId as OrganisationId,
        );
        return entries.map(toWorkflowLibraryEntryDto);
      },
    },
  ];
}
