/**
 * DEVOS-284: the durable identity row behind an actor id. `id` is
 * deliberately the same opaque string this codebase already uses as
 * `Membership.principalId`/`AuditRecord.actorId` (an OIDC `sub` claim, or a
 * bare dev-mode bearer token — see `@devos/identity`'s own `Principal`,
 * which represents "who is calling right now," not this durable row) rather
 * than a freshly-minted UUID: no code path anywhere in this codebase keys
 * membership/audit lookups by anything other than that exact string, so
 * reusing it as the primary key is what makes this a real resolution-path
 * change rather than a data migration of every existing reference.
 *
 * `principalType` only ever writes `'HUMAN'` in this sprint — `'AGENT'`
 * exists for Sprint 48 (DEVOS-295) to use, not built or written here.
 */
export type PrincipalType = 'HUMAN' | 'AGENT';

export interface Principal {
  id: string;
  principalType: PrincipalType;
  createdAt: string;
  updatedAt: string;
}

export interface PrincipalRepository {
  getById: (id: string) => Promise<Principal | null>;
  create: (principal: Principal) => Promise<void>;
}

/**
 * DEVOS-284: one per `Principal` with `principalType: 'HUMAN'`. `email`/
 * `displayName` are optional — no email is resolvable for any actor id
 * backfilled from existing `memberships`/`audit_records` data (neither
 * table has ever stored one), so every backfilled row's `email` is
 * genuinely absent, not fabricated; DEVOS-285 is what starts populating it
 * for real, from a real OIDC login's own `email` claim.
 */
export interface HumanProfile {
  principalId: string;
  email?: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HumanProfileRepository {
  getByPrincipalId: (principalId: string) => Promise<HumanProfile | null>;
  create: (profile: HumanProfile) => Promise<void>;
}
