import type { HumanProfileRepository, PrincipalRepository } from '@devos/domain';

export interface EnsureHumanPrincipalDeps {
  principals: PrincipalRepository;
  humanProfiles: HumanProfileRepository;
}

export interface EnsureHumanPrincipalInput {
  id: string;
  email?: string;
}

/**
 * DEVOS-285/DEVOS-286: get-or-create for a real `PRINCIPAL`+`HUMAN_PROFILE`
 * row. Idempotent and side-effect-only — callers' own return values are
 * unaffected either way, which is what keeps this a real resolution-path
 * change rather than a behavior change (`specs/DEVOS-ACCESS-CONTROL-MODEL-
 * BACKLOG.md` §6.1). An existing profile's `email` is never overwritten by a
 * later call with no email (or a different one) — this sprint only ever
 * fills a genuinely empty field, never reconciles conflicting logins.
 */
export async function ensureHumanPrincipal(
  deps: EnsureHumanPrincipalDeps,
  input: EnsureHumanPrincipalInput,
): Promise<void> {
  const now = new Date().toISOString();

  const existingPrincipal = await deps.principals.getById(input.id);
  if (!existingPrincipal) {
    await deps.principals.create({
      id: input.id,
      principalType: 'HUMAN',
      createdAt: now,
      updatedAt: now,
    });
  }

  const existingProfile = await deps.humanProfiles.getByPrincipalId(input.id);
  if (!existingProfile) {
    await deps.humanProfiles.create({
      principalId: input.id,
      ...(input.email !== undefined ? { email: input.email } : {}),
      createdAt: now,
      updatedAt: now,
    });
  }
}
