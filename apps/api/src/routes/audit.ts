import type { ProjectId } from '@devos/contracts';
import { listAuditRecordsForProject, type AuditUseCaseDeps } from '@devos/application';
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
  ];
}
