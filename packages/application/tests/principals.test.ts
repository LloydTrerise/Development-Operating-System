import { randomUUID } from 'node:crypto';
import type { RegistrationTokenId } from '@devos/contracts';
import type {
  HumanProfile,
  HumanProfileRepository,
  PlatformOperator,
  PlatformOperatorRepository,
  Principal,
  PrincipalRepository,
  RegistrationToken,
  RegistrationTokenRepository,
  UserIdentity,
  UserIdentityRepository,
} from '@devos/domain';
import { describe, expect, it } from 'vitest';
import {
  ensureBootstrapPlatformOperator,
  type EnsureBootstrapPlatformOperatorDeps,
} from '../src/principals/ensure-bootstrap-platform-operator.js';
import { ensureHumanPrincipal } from '../src/principals/ensure-human-principal.js';
import { ensureUserIdentityForLogin } from '../src/principals/ensure-user-identity.js';
import { grantPlatformOperator } from '../src/principals/grant-platform-operator.js';
import { issueRegistrationToken } from '../src/principals/issue-registration-token.js';
import { listPlatformOperators } from '../src/principals/list-platform-operators.js';
import { listRegistrationTokens } from '../src/principals/list-registration-tokens.js';
import { hashRegistrationToken } from '../src/principals/registration-token-crypto.js';
import { revokePlatformOperator } from '../src/principals/revoke-platform-operator.js';
import { revokeRegistrationToken } from '../src/principals/revoke-registration-token.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/errors.js';
import type {
  PlatformOperatorUseCaseDeps,
  RegistrationTokenUseCaseDeps,
} from '../src/principals/deps.js';

function createInMemoryDeps(): {
  principals: PrincipalRepository;
  humanProfiles: HumanProfileRepository;
  userIdentities: UserIdentityRepository;
  principalsStore: Principal[];
  humanProfilesStore: HumanProfile[];
  userIdentitiesStore: UserIdentity[];
} {
  const principalsStore: Principal[] = [];
  const humanProfilesStore: HumanProfile[] = [];
  const userIdentitiesStore: UserIdentity[] = [];

  return {
    principals: {
      getById: async (id) => principalsStore.find((p) => p.id === id) ?? null,
      create: async (principal) => {
        principalsStore.push(principal);
      },
    },
    humanProfiles: {
      getByPrincipalId: async (principalId) =>
        humanProfilesStore.find((p) => p.principalId === principalId) ?? null,
      create: async (profile) => {
        humanProfilesStore.push(profile);
      },
    },
    userIdentities: {
      getByProviderSubject: async (provider, providerSubject) =>
        userIdentitiesStore.find(
          (i) => i.provider === provider && i.providerSubject === providerSubject,
        ) ?? null,
      create: async (identity) => {
        userIdentitiesStore.push(identity);
      },
    },
    principalsStore,
    humanProfilesStore,
    userIdentitiesStore,
  };
}

function createBootstrapDeps(bootstrapSubject: string | undefined): {
  deps: EnsureBootstrapPlatformOperatorDeps;
  platformOperatorsStore: PlatformOperator[];
  principalsStore: Principal[];
  humanProfilesStore: HumanProfile[];
} {
  const base = createInMemoryDeps();
  const platformOperatorsStore: PlatformOperator[] = [];
  const platformOperators: PlatformOperatorRepository = {
    getByPrincipalId: async (principalId) =>
      platformOperatorsStore.find((op) => op.principalId === principalId) ?? null,
    list: async () => [...platformOperatorsStore],
    count: async () => platformOperatorsStore.length,
    create: async (operator) => {
      platformOperatorsStore.push(operator);
    },
    delete: async (principalId) => {
      const index = platformOperatorsStore.findIndex((op) => op.principalId === principalId);
      if (index !== -1) platformOperatorsStore.splice(index, 1);
    },
  };

  return {
    deps: {
      principals: base.principals,
      humanProfiles: base.humanProfiles,
      platformOperators,
      ...(bootstrapSubject === undefined ? {} : { bootstrapSubject }),
    },
    platformOperatorsStore,
    principalsStore: base.principalsStore,
    humanProfilesStore: base.humanProfilesStore,
  };
}

describe('ensureHumanPrincipal (DEVOS-286)', () => {
  it('creates a real PRINCIPAL + HUMAN_PROFILE row for a never-before-seen actor id', async () => {
    const deps = createInMemoryDeps();

    await ensureHumanPrincipal(deps, { id: 'alice' });

    expect(deps.principalsStore).toHaveLength(1);
    expect(deps.principalsStore[0]).toMatchObject({ id: 'alice', principalType: 'HUMAN' });
    expect(deps.humanProfilesStore).toHaveLength(1);
    expect(deps.humanProfilesStore[0]).toMatchObject({ principalId: 'alice' });
    expect(deps.humanProfilesStore[0]?.email).toBeUndefined();
  });

  it('is idempotent for an already-known actor id', async () => {
    const deps = createInMemoryDeps();

    await ensureHumanPrincipal(deps, { id: 'alice', email: 'alice@example.com' });
    await ensureHumanPrincipal(deps, { id: 'alice' });

    expect(deps.principalsStore).toHaveLength(1);
    expect(deps.humanProfilesStore).toHaveLength(1);
    expect(deps.humanProfilesStore[0]?.email).toBe('alice@example.com');
  });
});

describe('ensureUserIdentityForLogin (DEVOS-285)', () => {
  it('records a real USER_IDENTITY row alongside its backing principal on first login', async () => {
    const deps = createInMemoryDeps();

    await ensureUserIdentityForLogin(deps, { id: 'sub-123', email: 'bob@example.com' }, 'oidc');

    expect(deps.principalsStore).toHaveLength(1);
    expect(deps.humanProfilesStore[0]).toMatchObject({
      principalId: 'sub-123',
      email: 'bob@example.com',
    });
    expect(deps.userIdentitiesStore).toHaveLength(1);
    expect(deps.userIdentitiesStore[0]).toMatchObject({
      principalId: 'sub-123',
      provider: 'oidc',
      providerSubject: 'sub-123',
    });
  });

  it('does not duplicate a USER_IDENTITY row across repeated logins', async () => {
    const deps = createInMemoryDeps();

    await ensureUserIdentityForLogin(deps, { id: 'sub-123' }, 'oidc');
    await ensureUserIdentityForLogin(deps, { id: 'sub-123' }, 'oidc');

    expect(deps.userIdentitiesStore).toHaveLength(1);
  });

  it('keys distinct providers separately for the same subject', async () => {
    const deps = createInMemoryDeps();

    await ensureUserIdentityForLogin(deps, { id: 'sub-123' }, 'oidc');
    await ensureUserIdentityForLogin(deps, { id: 'sub-123' }, 'other-provider');

    expect(deps.userIdentitiesStore).toHaveLength(2);
  });
});

describe('ensureBootstrapPlatformOperator (DEVOS-326)', () => {
  it('(a) never grants when the bootstrap env var is unset', async () => {
    const { deps, platformOperatorsStore } = createBootstrapDeps(undefined);

    await ensureBootstrapPlatformOperator(deps, 'alice');

    expect(platformOperatorsStore).toHaveLength(0);
  });

  it('(b) never grants a second bootstrap operator once platform_operators is non-empty, even for the matching principal', async () => {
    const { deps, platformOperatorsStore } = createBootstrapDeps('alice');
    platformOperatorsStore.push({ principalId: 'someone-else', grantedAt: '2026-01-01T00:00:00Z' });

    await ensureBootstrapPlatformOperator(deps, 'alice');

    expect(platformOperatorsStore).toHaveLength(1);
    expect(platformOperatorsStore[0]?.principalId).toBe('someone-else');
  });

  it('(c) grants exactly one row with no grantor, for a matching principal on an empty table, creating the backing principal as a side effect', async () => {
    const { deps, platformOperatorsStore, principalsStore, humanProfilesStore } =
      createBootstrapDeps('alice');

    await ensureBootstrapPlatformOperator(deps, 'alice');

    expect(platformOperatorsStore).toHaveLength(1);
    expect(platformOperatorsStore[0]).toMatchObject({ principalId: 'alice' });
    expect(platformOperatorsStore[0]?.grantedByPrincipalId).toBeUndefined();
    expect(principalsStore).toHaveLength(1);
    expect(humanProfilesStore).toHaveLength(1);
  });

  it('never grants for a non-matching principal', async () => {
    const { deps, platformOperatorsStore } = createBootstrapDeps('alice');

    await ensureBootstrapPlatformOperator(deps, 'bob');

    expect(platformOperatorsStore).toHaveLength(0);
  });

  it('is idempotent for the matching principal across repeated calls', async () => {
    const { deps, platformOperatorsStore } = createBootstrapDeps('alice');

    await ensureBootstrapPlatformOperator(deps, 'alice');
    await ensureBootstrapPlatformOperator(deps, 'alice');

    expect(platformOperatorsStore).toHaveLength(1);
  });
});

function createPlatformOperatorUseCaseDeps(seedOperatorPrincipalIds: string[] = []): {
  deps: PlatformOperatorUseCaseDeps;
  platformOperatorsStore: PlatformOperator[];
} {
  const { deps, platformOperatorsStore } = createBootstrapDeps(undefined);
  for (const principalId of seedOperatorPrincipalIds) {
    platformOperatorsStore.push({ principalId, grantedAt: '2026-01-01T00:00:00Z' });
  }
  return { deps, platformOperatorsStore };
}

describe('grantPlatformOperator (DEVOS-327)', () => {
  it('rejects a non-operator actor', async () => {
    const { deps } = createPlatformOperatorUseCaseDeps([]);

    await expect(grantPlatformOperator(deps, 'not-an-operator', 'bob')).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('grants a second operator, attributing the acting operator as grantor, and creates the backing principal', async () => {
    const { deps, platformOperatorsStore } = createPlatformOperatorUseCaseDeps(['alice']);

    const granted = await grantPlatformOperator(deps, 'alice', 'bob');

    expect(granted).toMatchObject({ principalId: 'bob', grantedByPrincipalId: 'alice' });
    expect(platformOperatorsStore).toHaveLength(2);
  });

  it('rejects granting a principal who is already a platform operator', async () => {
    const { deps } = createPlatformOperatorUseCaseDeps(['alice', 'bob']);

    await expect(grantPlatformOperator(deps, 'alice', 'bob')).rejects.toThrow(ValidationError);
  });
});

describe('revokePlatformOperator (DEVOS-327)', () => {
  it('rejects a non-operator actor', async () => {
    const { deps } = createPlatformOperatorUseCaseDeps(['alice']);

    await expect(revokePlatformOperator(deps, 'not-an-operator', 'alice')).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('rejects revoking an unknown target', async () => {
    const { deps } = createPlatformOperatorUseCaseDeps(['alice']);

    await expect(revokePlatformOperator(deps, 'alice', 'nobody')).rejects.toThrow(NotFoundError);
  });

  it('blocks revoking the sole remaining operator', async () => {
    const { deps, platformOperatorsStore } = createPlatformOperatorUseCaseDeps(['alice']);

    await expect(revokePlatformOperator(deps, 'alice', 'alice')).rejects.toThrow(ValidationError);
    expect(platformOperatorsStore).toHaveLength(1);
  });

  it('revokes a non-sole operator successfully', async () => {
    const { deps, platformOperatorsStore } = createPlatformOperatorUseCaseDeps(['alice', 'bob']);

    await revokePlatformOperator(deps, 'alice', 'bob');

    expect(platformOperatorsStore).toHaveLength(1);
    expect(platformOperatorsStore[0]?.principalId).toBe('alice');
  });
});

describe('listPlatformOperators (DEVOS-327)', () => {
  it('rejects a non-operator actor', async () => {
    const { deps } = createPlatformOperatorUseCaseDeps(['alice']);

    await expect(listPlatformOperators(deps, 'not-an-operator')).rejects.toThrow(ForbiddenError);
  });

  it('returns the full list for an existing operator', async () => {
    const { deps } = createPlatformOperatorUseCaseDeps(['alice', 'bob']);

    const result = await listPlatformOperators(deps, 'alice');

    expect(result.map((op) => op.principalId).sort()).toEqual(['alice', 'bob']);
  });
});

function createRegistrationTokenUseCaseDeps(seedOperatorPrincipalIds: string[] = []): {
  deps: RegistrationTokenUseCaseDeps;
  tokensStore: RegistrationToken[];
} {
  const { deps: platformOperatorDeps } =
    createPlatformOperatorUseCaseDeps(seedOperatorPrincipalIds);
  const tokensStore: RegistrationToken[] = [];

  const registrationTokens: RegistrationTokenRepository = {
    getByTokenHash: async (tokenHash) => tokensStore.find((t) => t.tokenHash === tokenHash) ?? null,
    getById: async (id) => tokensStore.find((t) => t.id === id) ?? null,
    list: async () => [...tokensStore],
    create: async (token) => {
      tokensStore.push(token);
    },
    markRedeemed: async (id, redeemedByPrincipalId, redeemedOrganisationId, updatedAt) => {
      const index = tokensStore.findIndex((t) => t.id === id);
      if (index !== -1) {
        tokensStore[index] = {
          ...tokensStore[index]!,
          status: 'REDEEMED',
          redeemedByPrincipalId,
          redeemedOrganisationId,
          updatedAt,
        };
      }
    },
    markRevoked: async (id, updatedAt) => {
      const index = tokensStore.findIndex((t) => t.id === id);
      if (index !== -1)
        tokensStore[index] = { ...tokensStore[index]!, status: 'REVOKED', updatedAt };
    },
  };

  return {
    deps: { platformOperators: platformOperatorDeps.platformOperators, registrationTokens },
    tokensStore,
  };
}

describe('issueRegistrationToken (DEVOS-331)', () => {
  it('rejects a non-operator actor', async () => {
    const { deps } = createRegistrationTokenUseCaseDeps([]);

    await expect(issueRegistrationToken(deps, 'not-an-operator', 7)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('issues a token, persisting only its hash, and returns the raw value once', async () => {
    const { deps, tokensStore } = createRegistrationTokenUseCaseDeps(['alice']);

    const { token, rawToken } = await issueRegistrationToken(deps, 'alice', 7);

    expect(tokensStore).toHaveLength(1);
    expect(tokensStore[0]).toMatchObject({
      status: 'ACTIVE',
      issuedByPlatformOperatorId: 'alice',
    });
    expect(tokensStore[0]?.tokenHash).toBe(hashRegistrationToken(rawToken));
    expect(token.tokenHash).not.toBe(rawToken);
    expect(rawToken.length).toBeGreaterThan(0);
  });

  it('sets expiresAt from the given expiryDays', async () => {
    const { deps } = createRegistrationTokenUseCaseDeps(['alice']);

    const before = Date.now();
    const { token } = await issueRegistrationToken(deps, 'alice', 1);
    const expiresAt = new Date(token.expiresAt).getTime();

    expect(expiresAt).toBeGreaterThan(before);
    expect(expiresAt).toBeLessThanOrEqual(before + 2 * 24 * 60 * 60 * 1000);
  });
});

describe('listRegistrationTokens (DEVOS-331)', () => {
  it('rejects a non-operator actor', async () => {
    const { deps } = createRegistrationTokenUseCaseDeps([]);

    await expect(listRegistrationTokens(deps, 'not-an-operator')).rejects.toThrow(ForbiddenError);
  });

  it('returns every issued token for an existing operator, without exposing a raw value', async () => {
    const { deps } = createRegistrationTokenUseCaseDeps(['alice']);
    await issueRegistrationToken(deps, 'alice', 7);
    await issueRegistrationToken(deps, 'alice', 7);

    const result = await listRegistrationTokens(deps, 'alice');

    expect(result).toHaveLength(2);
    for (const token of result) {
      expect(Object.keys(token)).not.toContain('rawToken');
    }
  });
});

describe('revokeRegistrationToken (DEVOS-331)', () => {
  it('rejects a non-operator actor', async () => {
    const { deps, tokensStore } = createRegistrationTokenUseCaseDeps([]);
    tokensStore.push({
      id: randomUUID() as RegistrationTokenId,
      tokenHash: 'hash',
      issuedByPlatformOperatorId: 'alice',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 1000).toISOString(),
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });

    await expect(
      revokeRegistrationToken(deps, 'not-an-operator', tokensStore[0]!.id),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects an unknown token id', async () => {
    const { deps } = createRegistrationTokenUseCaseDeps(['alice']);

    await expect(
      revokeRegistrationToken(deps, 'alice', randomUUID() as RegistrationTokenId),
    ).rejects.toThrow(NotFoundError);
  });

  it('revokes an ACTIVE token', async () => {
    const { deps, tokensStore } = createRegistrationTokenUseCaseDeps(['alice']);
    const { token } = await issueRegistrationToken(deps, 'alice', 7);

    await revokeRegistrationToken(deps, 'alice', token.id);

    expect(tokensStore.find((t) => t.id === token.id)?.status).toBe('REVOKED');
  });

  it('rejects revoking an already-redeemed or already-revoked token', async () => {
    const { deps, tokensStore } = createRegistrationTokenUseCaseDeps(['alice']);
    const { token } = await issueRegistrationToken(deps, 'alice', 7);
    await revokeRegistrationToken(deps, 'alice', token.id);

    await expect(revokeRegistrationToken(deps, 'alice', token.id)).rejects.toThrow(ValidationError);
    expect(tokensStore.find((t) => t.id === token.id)?.status).toBe('REVOKED');
  });
});
