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

export interface VaultCredentialResolverOptions {
  /** e.g. http://localhost:8200 (infrastructure/docker/docker-compose.yml's `vault` service). */
  address: string;
  token: string;
  /** KV v2 mount point. Defaults to 'secret' (Vault dev mode's own default mount). */
  mountPath?: string;
  /** Injectable for tests — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

interface VaultKvV2ReadResponse {
  data?: {
    data?: Record<string, unknown>;
  };
}

/**
 * DEVOS-106: a real secret-management backend, alongside
 * `createEnvCredentialResolver`. Changes what `credentialReference` *means*
 * for an `Integration` that uses this resolver — no longer an environment
 * variable name, but a path under this KV v2 mount (e.g. `github/pat`)
 * whose secret payload has a `value` key holding the actual credential.
 * `createEnvCredentialResolver`'s own interpretation (a literal env var
 * name) is unchanged and remains what tests/local dev use by default — the
 * two resolvers keep satisfying the same `resolve(reference): Promise<string
 * | null>` contract while interpreting the reference string differently, per
 * this task's own flagged gap.
 *
 * Never throws the Vault token or a resolved secret value into a log line —
 * a network/auth failure's error message includes only the HTTP status, not
 * the response body, per AGENTS.md §22.
 */
export function createVaultCredentialResolver(
  options: VaultCredentialResolverOptions,
): CredentialResolver {
  const address = options.address.replace(/\/+$/, '');
  const mountPath = options.mountPath ?? 'secret';
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async resolve(credentialReference) {
      const path = credentialReference.replace(/^\/+/, '');
      const url = `${address}/v1/${mountPath}/data/${path}`;

      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: { 'X-Vault-Token': options.token },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown network error.';
        throw new Error(`Vault secret lookup failed for "${path}": ${message}`, { cause: error });
      }

      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Vault secret lookup for "${path}" failed with status ${response.status}.`);
      }

      const body = (await response.json()) as VaultKvV2ReadResponse;
      const value = body.data?.data?.['value'];
      return typeof value === 'string' ? value : null;
    },
  };
}
