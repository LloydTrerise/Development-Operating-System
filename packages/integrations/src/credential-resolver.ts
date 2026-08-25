/**
 * "Provider adapters receive credentials through injected interfaces"
 * (specs/architecture/repository-code-structure.md §47). No
 * secret-management mechanism is named or designed anywhere in the spec
 * corpus (specs/database/poc-database-schema.md §13.1 only says
 * "Secrets are referenced through a secret-management mechanism"), so this
 * resolves an `Integration.credentialReference` from an environment
 * variable of that same name — a generalization of the existing
 * `GEMINI_API_KEY`-via-`@devos/config` precedent (DEVOS-027) to an
 * arbitrary, per-integration reference name, not a secrets-manager
 * integration. An explicit implementation choice, not a spec-mandated
 * design (flagged in DEVOS-053's own task spec).
 */
export interface CredentialResolver {
  resolve: (credentialReference: string) => Promise<string | null>;
}

export function createEnvCredentialResolver(): CredentialResolver {
  return {
    async resolve(credentialReference) {
      return process.env[credentialReference] ?? null;
    },
  };
}
