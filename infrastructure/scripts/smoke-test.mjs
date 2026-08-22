#!/usr/bin/env node
// Minimal smoke test for a running `pnpm dev` environment: confirms the API
// is reachable and reports its database connection as healthy. Does not
// start anything itself — run `pnpm dev` (or at least the API) first.

const baseUrl = process.env.DEVOS_API_URL ?? 'http://localhost:3000';
const healthUrl = `${baseUrl}/api/v1/health`;
const maxAttempts = 10;
const delayMs = 1000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Smoke test: waiting for ${healthUrl} ...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(healthUrl);
      const body = await response.json();

      if (response.ok && body?.data?.status === 'ok') {
        const dbStatus = body.data.checks?.database ?? 'unknown';
        console.log(`Smoke test PASSED: API is up, database check reports "${dbStatus}".`);
        if (dbStatus !== 'ok') {
          console.warn(
            'Warning: database check did not report "ok" — is Postgres running and migrated?',
          );
          process.exitCode = 1;
        }
        return;
      }

      console.log(
        `Attempt ${attempt}/${maxAttempts}: API responded but not healthy yet (${response.status}).`,
      );
    } catch (error) {
      console.log(`Attempt ${attempt}/${maxAttempts}: API not reachable yet (${error.message}).`);
    }

    if (attempt < maxAttempts) await wait(delayMs);
  }

  console.error(
    `Smoke test FAILED: ${healthUrl} did not become healthy after ${maxAttempts} attempts.`,
  );
  console.error(
    'Is the API running? Try `pnpm dev` (or `pnpm --filter @devos/api dev`) in another terminal.',
  );
  process.exitCode = 1;
}

await main();
