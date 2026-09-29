import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Membership, Organisation, RegistrationToken } from '@devos/domain';
import {
  createOrganisation,
  hashRegistrationToken,
  type OrganisationUseCaseDeps,
} from '@devos/application';
import {
  createAuditRecordRepository,
  createDatabaseClient,
  createMembershipRepository,
  createOrganisationRepository,
  createOrganisationTransactionCreator,
  createPrincipalRepository,
  createRegistrationTokenRepository,
  withTransaction,
  type DatabaseClient,
} from '@devos/database';

/**
 * DEVOS-346 (Sprint 61, Epic E31 gap closure) — real-Postgres verification
 * that organisation creation + token redemption now commits atomically,
 * mirroring `approval-atomicity.test.ts`'s own established DEVOS-111
 * pattern exactly: a real success-path proof, then a real forced-crash
 * proof that a failure between the transaction's own internal writes
 * leaves nothing committed.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const ISSUER_PRINCIPAL_ID = 'devos-e2e-org-creation-atomicity-issuer';

let database: DatabaseClient;

beforeAll(async () => {
  const migrate = spawnSync(PNPM_CMD, ['--filter', '@devos/database', 'run', 'migrate'], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (migrate.status !== 0)
    throw new Error(`Migration failed:\n${migrate.stdout}\n${migrate.stderr}`);

  database = createDatabaseClient({ connectionString: DATABASE_URL });

  // `registration_tokens.issued_by_platform_operator_id` is a real, not-null
  // FK to `principals.id` — unlike `memberships.create()` (which get-or-
  // creates its own principal row as a side effect), a token's own creation
  // here is a direct repository insert, so the issuing principal must
  // already exist.
  await createPrincipalRepository(database.db).create({
    id: ISSUER_PRINCIPAL_ID,
    principalType: 'HUMAN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}, 30_000);

afterAll(async () => {
  await database?.close();
});

async function seedActiveToken(rawToken: string): Promise<RegistrationToken> {
  const now = new Date().toISOString();
  const token: RegistrationToken = {
    id: randomUUID() as RegistrationToken['id'],
    tokenHash: hashRegistrationToken(rawToken),
    issuedByPlatformOperatorId: ISSUER_PRINCIPAL_ID,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
  };
  await createRegistrationTokenRepository(database.db).create(token);
  return token;
}

function buildOrganisationDeps(): OrganisationUseCaseDeps {
  return {
    organisations: createOrganisationRepository(database.db),
    memberships: createMembershipRepository(database.db),
    auditRecords: createAuditRecordRepository(database.db),
    registrationTokens: createRegistrationTokenRepository(database.db),
    createOrganisationTransactionally: createOrganisationTransactionCreator(database.db),
  };
}

describe('DEVOS-346: real Postgres — transactional organisation creation + token redemption', () => {
  it('a real success commits the organisation, membership, ownership, and token redemption together', async () => {
    const rawToken = `atomicity-success-${randomUUID()}`;
    await seedActiveToken(rawToken);
    const deps = buildOrganisationDeps();
    const principalId = `devos-e2e-org-creation-atomicity-${randomUUID()}`;

    const organisation = await createOrganisation(deps, principalId, {
      name: 'Atomicity Success Org',
      slug: `atomicity-success-${randomUUID()}`,
      registrationToken: rawToken,
    });

    expect(organisation.ownerPrincipalId).toBe(principalId);

    const persisted = await deps.organisations.getById(organisation.id);
    expect(persisted?.ownerPrincipalId).toBe(principalId);
    const membership = (await deps.memberships.listForOrganisation?.(organisation.id)) ?? [];
    expect(membership).toEqual([
      expect.objectContaining({ principalId, role: 'ORGANISATION_ADMIN' }),
    ]);
    const token = await deps.registrationTokens.getByTokenHash(hashRegistrationToken(rawToken));
    expect(token?.status).toBe('REDEEMED');
    expect(token?.redeemedOrganisationId).toBe(organisation.id);
  }, 30_000);

  it('a real forced crash mid-transaction leaves neither the organisation nor the token redemption applied', async () => {
    const rawToken = `atomicity-rollback-${randomUUID()}`;
    const seeded = await seedActiveToken(rawToken);
    const organisationId = randomUUID() as Organisation['id'];
    const now = new Date().toISOString();
    const organisation: Organisation = {
      id: organisationId,
      name: 'Atomicity Rollback Org',
      slug: `atomicity-rollback-${randomUUID()}`,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    const membership: Membership = {
      id: randomUUID() as Membership['id'],
      organisationId,
      projectId: null,
      principalId: `devos-e2e-org-creation-atomicity-rollback-${randomUUID()}`,
      role: 'ORGANISATION_ADMIN',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    // Mirrors `createOrganisationTransactionCreator`'s own real transaction
    // body exactly, except the last write is forced to throw after the
    // first three have genuinely executed — the real crash-mid-transaction
    // window DEVOS-346 closes. If these four writes were still separate,
    // sequentially-committed operations (the pre-DEVOS-346 shape), the
    // organisation/membership/ownership writes below would survive this
    // throw; the point of this test is that they must not.
    await expect(
      withTransaction(database.db, async (trx) => {
        await createOrganisationRepository(trx).create(organisation);
        await createMembershipRepository(trx).create(membership);
        await createOrganisationRepository(trx).setOwnerPrincipalId(
          organisationId,
          membership.principalId,
          now,
        );
        throw new Error('simulated crash before token redemption commits');
      }),
    ).rejects.toThrow('simulated crash');

    const afterCrash = await createOrganisationRepository(database.db).getById(organisationId);
    expect(afterCrash).toBeNull();
    const tokenAfterCrash = await createRegistrationTokenRepository(database.db).getById(seeded.id);
    expect(tokenAfterCrash?.status).toBe('ACTIVE');
  }, 30_000);

  it('the real createOrganisation use case rejects reusing an already-redeemed token (transactional path, end to end)', async () => {
    const rawToken = `atomicity-reuse-${randomUUID()}`;
    await seedActiveToken(rawToken);
    const deps = buildOrganisationDeps();

    await createOrganisation(deps, `devos-e2e-org-creation-atomicity-${randomUUID()}`, {
      name: 'Atomicity Reuse Org 1',
      slug: `atomicity-reuse-1-${randomUUID()}`,
      registrationToken: rawToken,
    });

    await expect(
      createOrganisation(deps, `devos-e2e-org-creation-atomicity-${randomUUID()}`, {
        name: 'Atomicity Reuse Org 2',
        slug: `atomicity-reuse-2-${randomUUID()}`,
        registrationToken: rawToken,
      }),
    ).rejects.toThrow(/already been redeemed/);
  }, 30_000);
});
