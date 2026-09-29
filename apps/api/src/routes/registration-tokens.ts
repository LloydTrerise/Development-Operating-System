import {
  issueRegistrationToken,
  listRegistrationTokens,
  revokeRegistrationToken,
  type RegistrationTokenUseCaseDeps,
} from '@devos/application';
import type { RegistrationTokenId } from '@devos/contracts';
import { toIssuedRegistrationTokenDto, toRegistrationTokenDto } from '../dto/registration-token.js';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-331 (Sprint 57, candidate epic E31): the registration-token
 * management surface — mirrors `platform-operators.ts`'s own "authorization
 * lives in the use case, not the route" split exactly. `expiryDays` is
 * resolved once at `app.ts`'s composition time from `config.registrationTokens`
 * (the backlog's own §9 "sensible configurable default... not hardcoded"
 * resolution) and closed over here, not re-read per request.
 */
export function createRegistrationTokenRoutes(
  prefix: string,
  deps: RegistrationTokenUseCaseDeps,
  expiryDays: number,
): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/registration-tokens`,
      protected: true,
      handler: async ({ principal }) => {
        const user = requirePrincipal(principal);
        const tokens = await listRegistrationTokens(deps, user.id);
        return tokens.map(toRegistrationTokenDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/registration-tokens`,
      protected: true,
      handler: async ({ principal }) => {
        const user = requirePrincipal(principal);
        const result = await issueRegistrationToken(deps, user.id, expiryDays);
        return toIssuedRegistrationTokenDto(result);
      },
    },
    {
      method: 'DELETE',
      pattern: `${prefix}/registration-tokens/:tokenId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        await revokeRegistrationToken(deps, user.id, params.tokenId as RegistrationTokenId);
        return { revoked: true };
      },
    },
  ];
}
