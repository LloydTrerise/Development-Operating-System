import {
  grantPlatformOperator,
  listPlatformOperators,
  revokePlatformOperator,
  type PlatformOperatorUseCaseDeps,
} from '@devos/application';
import { parseGrantPlatformOperatorBody, toPlatformOperatorDto } from '../dto/platform-operator.js';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-327 (Sprint 56, candidate epic E31): the platform-operator tier's
 * own narrowly-scoped management surface. Every route is gated by the
 * use-case layer itself (`grantPlatformOperator`/`revokePlatformOperator`/
 * `listPlatformOperators`, all `ForbiddenError` for a non-operator actor) —
 * nothing here re-checks it, mirroring `organisation-llm-providers.ts`'s own
 * established "authorization lives in the use case, not the route" split.
 */
export function createPlatformOperatorRoutes(
  prefix: string,
  deps: PlatformOperatorUseCaseDeps,
): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/platform-operators`,
      protected: true,
      handler: async ({ principal }) => {
        const user = requirePrincipal(principal);
        const operators = await listPlatformOperators(deps, user.id);
        return operators.map(toPlatformOperatorDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/platform-operators`,
      protected: true,
      handler: async ({ principal, body }) => {
        const user = requirePrincipal(principal);
        const input = parseGrantPlatformOperatorBody(body);
        const operator = await grantPlatformOperator(deps, user.id, input.principalId);
        return toPlatformOperatorDto(operator);
      },
    },
    {
      method: 'DELETE',
      pattern: `${prefix}/platform-operators/:principalId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        await revokePlatformOperator(deps, user.id, params.principalId as string);
        return { revoked: true };
      },
    },
  ];
}
