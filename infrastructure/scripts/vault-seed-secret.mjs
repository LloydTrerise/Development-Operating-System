#!/usr/bin/env node
// DEVOS-106: writes one real secret into the real local Vault (see
// infrastructure/docker/docker-compose.yml's `vault` service) via its KV v2
// HTTP API — this is how a real secret actually gets created in the real
// secret-management backend for DEVOS-104/105's live verification, and for
// local dev generally. Never logs the secret value itself.
//
// Usage:
//   node infrastructure/scripts/vault-seed-secret.mjs <path> <value>
//   node infrastructure/scripts/vault-seed-secret.mjs github/pat ghp_xxx...
//
// Reads VAULT_ADDR/VAULT_TOKEN from the environment, matching
// @devos/config's own variable names and .env.example's local defaults.

const vaultAddr = (process.env.VAULT_ADDR ?? 'http://localhost:8200').replace(/\/+$/, '');
const vaultToken = process.env.VAULT_TOKEN ?? 'devos-dev-root-token';
const mountPath = process.env.VAULT_MOUNT_PATH ?? 'secret';

const [, , path, value] = process.argv;

if (!path || !value) {
  console.error('Usage: node infrastructure/scripts/vault-seed-secret.mjs <path> <value>');
  process.exit(1);
}

async function main() {
  const url = `${vaultAddr}/v1/${mountPath}/data/${path.replace(/^\/+/, '')}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Vault-Token': vaultToken,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ data: { value } }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Vault write failed with status ${response.status}: ${bodyText}`);
  }

  console.log(`Vault secret written at "${mountPath}/${path}" (value not logged).`);
}

main().catch((error) => {
  console.error(`vault-seed-secret failed: ${error.message}`);
  process.exit(1);
});
