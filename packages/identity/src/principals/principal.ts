/**
 * DEVOS-107's own flagged gap: a real OIDC identity typically carries an
 * email/subject/issuer, not just an opaque id — `email` is added as
 * optional so `createOidcAuthProvider` can populate it from a token's own
 * `email` claim when present, while `createLocalAuthProvider`'s existing
 * minimal `{ id }` construction (and every caller that only ever reads
 * `principal.id`) stays valid unchanged.
 */
export interface Principal {
  id: string;
  email?: string;
}
