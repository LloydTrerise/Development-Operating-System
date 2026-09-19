import type { OrganisationId, ProjectId } from '@devos/contracts';
import {
  listAuditRecordsForOrganisation,
  listAuditRecordsForProject,
  type AuditUseCaseDeps,
} from '@devos/application';
import { toAuditRecordDto } from '../dto/audit.js';
import { requirePrincipal, type Route } from '../http/router.js';

export function createAuditRoutes(prefix: string, deps: AuditUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/audit`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const records = await listAuditRecordsForProject(
          deps,
          user.id,
          params.projectId as ProjectId,
        );
        return records.map(toAuditRecordDto);
      },
    },
    // DEVOS-147: cross-project compliance reporting — real, organisation-scoped.
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId/audit`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const records = await listAuditRecordsForOrganisation(
          deps,
          user.id,
          params.organisationId as OrganisationId,
        );
        return records.map(toAuditRecordDto);
      },
    },
  ];
}
