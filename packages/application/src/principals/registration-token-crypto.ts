import { createHash, randomBytes } from 'node:crypto';

/**
 * DEVOS-329/DEVOS-330/DEVOS-331 (Sprint 57, candidate epic E31): shared
 * between issuance (`issueRegistrationToken`) and redemption
 * (`createOrganisation`) — both need the exact same raw-token-to-hash
 * mapping. A plain, unsalted SHA-256 digest is sufficient here (unlike a
 * user password, which needs a slow, salted KDF against low-entropy
 * guesses): `generateRegistrationToken()`'s 256 bits of real randomness
 * makes an unsalted-hash dictionary/rainbow-table attack meaningless, the
 * same reasoning this codebase's own bearer-token/API-key conventions
 * already rely on. Disclosed as the implementation choice
 * `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §9 left open at
 * conversion time.
 */
export function generateRegistrationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRegistrationToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
