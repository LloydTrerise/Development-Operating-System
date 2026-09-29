import { listPlatformAuditRecords, type PlatformOperatorUseCaseDeps } from '@devos/application';
import { toPlatformAuditRecordDto } from '../dto/platform-audit-record.js';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-345 (Sprint 61, Epic E31 gap closure): the platform-operator
 * grant/revoke audit trail's own read surface — gated identically to
 * `platform-operators.ts`'s own routes (authorization lives in the use case,
 * `listPlatformAuditRecords`, not here). Not organisation-scoped at all, so
 * this route carries no `resolveOrganisationId` — mirrors every other
 * platform-tier route's own established "Exempt (not organisation-scoped)"
 * disposition (`specs/sprints/sprint-59/DEVOS-338.md`'s audit table).
 */
export function createPlatformAuditRecordRoutes(
  prefix: string,
  deps: PlatformOperatorUseCaseDeps,
): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/platform-audit-records`,
      protected: true,
      handler: async ({ principal }) => {
        const user = requirePrincipal(principal);
        const records = await listPlatformAuditRecords(deps, user.id);
        return records.map(toPlatformAuditRecordDto);
      },
    },
  ];
}
