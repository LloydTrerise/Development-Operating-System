import type {
  OrganisationId,
  RegistrationTokenId,
  RegistrationTokenStatus,
} from '@devos/contracts';
import type { RegistrationToken, RegistrationTokenRepository } from '@devos/domain';
import type { RegistrationTokensTable } from '../database.js';
import type { QueryExecutor } from './base.js';

/**
 * DEVOS-329: `EXPIRED` is never a persisted `status` value (see
 * `RegistrationTokensTable`'s own doc comment) — an `ACTIVE` row whose
 * `expires_at` has passed is presented as `EXPIRED` to every caller here,
 * so `createOrganisation` (DEVOS-330) and the issuance listing (DEVOS-331)
 * never need to re-derive this themselves.
 */
function toDomain(row: RegistrationTokensTable): RegistrationToken {
  const persistedStatus = row.status as RegistrationTokenStatus;
  const effectiveStatus: RegistrationTokenStatus =
    persistedStatus === 'ACTIVE' && new Date(row.expires_at).getTime() < Date.now()
      ? 'EXPIRED'
      : persistedStatus;

  return {
    id: row.id as RegistrationTokenId,
    tokenHash: row.token_hash,
    issuedByPlatformOperatorId: row.issued_by_platform_operator_id,
    status: effectiveStatus,
    expiresAt: row.expires_at,
    ...(row.redeemed_by_principal_id !== null
      ? { redeemedByPrincipalId: row.redeemed_by_principal_id }
      : {}),
    ...(row.redeemed_organisation_id !== null
      ? { redeemedOrganisationId: row.redeemed_organisation_id as OrganisationId }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createRegistrationTokenRepository(db: QueryExecutor): RegistrationTokenRepository {
  return {
    async getByTokenHash(tokenHash) {
      const row = await db
        .selectFrom('registration_tokens')
        .selectAll()
        .where('token_hash', '=', tokenHash)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getById(id) {
      const row = await db
        .selectFrom('registration_tokens')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async list() {
      const rows = await db
        .selectFrom('registration_tokens')
        .selectAll()
        .orderBy('created_at', 'desc')
        .execute();
      return rows.map(toDomain);
    },

    async create(token) {
      await db
        .insertInto('registration_tokens')
        .values({
          id: token.id,
          token_hash: token.tokenHash,
          issued_by_platform_operator_id: token.issuedByPlatformOperatorId,
          // A newly-issued token is always persisted ACTIVE — `status` here
          // is the domain layer's already-computed effective status, which
          // for a fresh token is always `ACTIVE` (never `EXPIRED`, since
          // `expiresAt` is always in the future at creation).
          status: 'ACTIVE',
          expires_at: token.expiresAt,
          redeemed_by_principal_id: token.redeemedByPrincipalId ?? null,
          redeemed_organisation_id: token.redeemedOrganisationId ?? null,
          created_at: token.createdAt,
          updated_at: token.updatedAt,
        })
        .execute();
    },

    async markRedeemed(id, redeemedByPrincipalId, redeemedOrganisationId, updatedAt) {
      await db
        .updateTable('registration_tokens')
        .set({
          status: 'REDEEMED',
          redeemed_by_principal_id: redeemedByPrincipalId,
          redeemed_organisation_id: redeemedOrganisationId,
          updated_at: updatedAt,
        })
        .where('id', '=', id)
        .execute();
    },

    async markRevoked(id, updatedAt) {
      await db
        .updateTable('registration_tokens')
        .set({ status: 'REVOKED', updated_at: updatedAt })
        .where('id', '=', id)
        .execute();
    },
  };
}
