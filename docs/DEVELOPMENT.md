# Local Development

This is the canonical setup guide for running DevOS locally: infrastructure,
migrations, seed data, the dev servers, and how to run every category of
test this repository has (unit, contract, and the full end-to-end control
loop).

## Prerequisites

- Node.js `>=22.22.2 <23` (see `package.json`'s `engines` field)
- pnpm `11.22.0` (see `packageManager` — `corepack enable` will pick this up
  automatically if you don't already have pnpm installed)
- Docker (for local Postgres via Docker Compose, and if you want to build
  the container images from `apps/api/Dockerfile` / `apps/worker/Dockerfile`)

## 1. Install dependencies

```sh
pnpm install
```

## 2. Start infrastructure (Postgres)

```sh
pnpm docker:up
```

This runs `infrastructure/docker/docker-compose.yml` in the background — a
single `postgres:16-alpine` container (`devos`/`devos`/`devos` for
user/password/database, port `5432`). `pnpm docker:down` stops it; the data
volume persists across restarts (`docker compose ... down -v` to wipe it).

## 3. Set `DATABASE_URL`

Nothing in this repository auto-loads a `.env` file — `.env.example` at the
repo root documents every variable, but you need to export them into your
own shell yourself (or use a tool like `direnv`/`dotenv-cli` if you prefer).
For local development against the Compose Postgres:

```sh
# bash
export DATABASE_URL="postgresql://devos:devos@localhost:5432/devos"
```

```powershell
# PowerShell
$env:DATABASE_URL = "postgresql://devos:devos@localhost:5432/devos"
```

Every command below that touches the database (`db:migrate`, `db:seed`,
`pnpm dev`'s API/worker, `pnpm test`) needs this set in that shell session.

## 4. Migrate and seed

```sh
pnpm db:migrate   # applies every migration under packages/database/migrations
pnpm db:seed      # idempotent — safe to re-run; inserts one org/project/
                  # membership/published workflow for local development
```

Steps 1–4 can be run together as `pnpm bootstrap` (install + docker:up +
migrate + seed).

## 5. Run the dev servers

```sh
pnpm dev
```

Runs every app's `dev` script in parallel via Turborepo: the API on
`:3000`, the worker (no HTTP port — it polls the task queue), and the web
app on Vite's default dev port (`:5173`). Requires `DATABASE_URL` to already
be set in the shell you run this from (step 3).

The web app has no login screen yet — it authenticates every request as a
fixed local principal (`seed-user` by default; see
`apps/web/src/api-client.ts`'s `DEV_PRINCIPAL_ID`, overridable via
`VITE_DEV_PRINCIPAL_ID`), matching the API's own local dev auth provider
(bearer-token-as-principal-id, no real credential check).

## 6. Smoke test

Once the API is up (either via `pnpm dev` or just
`pnpm --filter @devos/api dev`):

```sh
pnpm smoke
```

Polls `GET /api/v1/health` (default `http://localhost:3000`, override with
`DEVOS_API_URL`) until it reports healthy or times out after ~10s. Confirms
both "the API process is up" and "the API can reach Postgres" in one command
— useful right after `pnpm bootstrap && pnpm dev` to confirm the environment
is actually working before diving into a task.

## 7. Run the tests

```sh
pnpm test
```

Runs every package's `test` script via Turborepo. This includes:

- **Unit tests** (most packages) — no external dependencies, run against
  in-memory fakes.
- **`@devos/e2e-tests`** (`tests/e2e/`) — the automated proof of the entire
  Sprint 1 control loop (DEVOS-021): it spawns real API and worker
  processes and drives them purely over HTTP against a real Postgres
  database. **This requires `DATABASE_URL` to be set and Postgres to be
  running and migrated** (steps 2–4 above) — it is not a fake/mocked test.

To run just the end-to-end proof on its own:

```sh
pnpm --filter @devos/e2e-tests test
```

## 8. Manual browser verification (Playwright)

`apps/web` has no automated UI test suite yet, and no agent working in
this repo has a browser available by default (see DEVOS-007/DEVOS-020/
DEVOS-036's build-state entries) — Playwright is a devDependency
specifically so a real browser check is possible when one is needed,
not because CI runs it.

```sh
npx playwright install chromium   # one-time, downloads the browser binary
```

Then drive it with a short script, e.g.:

```js
// verify-ui.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto('http://localhost:5173');
await page.waitForSelector('[data-testid="api-status"]:has-text("online")');
await page.screenshot({ path: 'screenshot.png' });
await browser.close();
```

```sh
node verify-ui.mjs
```

Requires the dev servers running (`pnpm dev`, step 5) and, for anything
touching agent-task UI, either a real `GEMINI_API_KEY` or a stand-in
model adapter — see DEVOS-036's build-state entry for how that was done
when Gemini's free-tier daily quota was exhausted.

## 9. Other useful commands

| Command                             | What it does                                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                    | `tsc --noEmit` across every package                                                                                          |
| `pnpm lint`                         | ESLint across the repo                                                                                                       |
| `pnpm format` / `pnpm format:check` | Prettier write / check                                                                                                       |
| `pnpm build`                        | Compiles every package (`tsc`) and builds the web app (`vite build`)                                                         |
| `pnpm ci`                           | Runs format:check, lint, typecheck, test, and build in sequence — the same gate CI enforces (see `.github/workflows/ci.yml`) |

## 10. Building the container images

```sh
docker build -f apps/api/Dockerfile -t devos-api .
docker build -f apps/worker/Dockerfile -t devos-worker .
```

Both images build the whole workspace and run the compiled entrypoint —
see the comment at the top of `apps/api/Dockerfile` for why. Run them with
`DATABASE_URL` (and, for the worker, `ARTIFACT_STORAGE_DIR` if you want
artifacts written somewhere other than `./data/artifacts`) pointed at a
reachable Postgres instance.

## Troubleshooting

- **`pnpm install --frozen-lockfile` (or any fresh install) fails with
  `ERR_PNPM_IGNORED_BUILDS`**: this shouldn't happen — `pnpm-workspace.yaml`
  already allowlists `esbuild`'s install script (`allowBuilds: { esbuild:
true }`). If a new dependency introduces another native/build-script
  package, the fix is the same: add it to that map, not
  `dangerouslyAllowAllBuilds` (which disables the safety check for every
  dependency, not just the one you're trying to unblock).
- **Stray `tsx watch`/API/worker processes after killing a dev server on
  Windows**: `taskkill`/Ctrl+C sometimes doesn't reach every child process
  git-bash's `ps` doesn't reliably enumerate. `Get-CimInstance
Win32_Process | Where-Object {$_.CommandLine -like "*main.ts*"}` in
  PowerShell finds them reliably; pipe to `Stop-Process -Id $_.ProcessId
-Force`.
- **`pnpm test` fails on `@devos/e2e-tests` specifically**: almost always
  means `DATABASE_URL` isn't set in the shell running the command, or
  Postgres isn't up/migrated. Run steps 2–4 first.
- **`pnpm dev` crashes immediately with `ConfigValidationError: DATABASE_URL
is required`, even though you exported it**: Turborepo 2.x defaults to
  strict env-var filtering — a task only receives an environment variable
  if it's listed in `turbo.json`'s `globalEnv` (or the task's own `env`).
  `DATABASE_URL`/`PORT`/`ARTIFACT_STORAGE_DIR`/`VITE_API_BASE_URL`/
  `VITE_DEV_PRINCIPAL_ID` are already listed there; if you add a new env
  var some app depends on at runtime, it needs to be added to that list too
  or `turbo run dev`/`turbo run test` will silently strip it before the
  child process ever sees it.
