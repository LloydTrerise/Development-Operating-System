import type {
  HumanProfile,
  HumanProfileRepository,
  Principal,
  PrincipalRepository,
  UserIdentity,
  UserIdentityRepository,
} from '@devos/domain';
import { describe, expect, it } from 'vitest';
import { ensureHumanPrincipal } from '../src/principals/ensure-human-principal.js';
import { ensureUserIdentityForLogin } from '../src/principals/ensure-user-identity.js';

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
